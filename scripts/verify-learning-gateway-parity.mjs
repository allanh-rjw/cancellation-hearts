import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LEARNING_OPERATIONS,
  adaptLearnerVisibleState,
  buildOperationInput,
  compareSemanticOutputs,
  createLearningGatewayClient,
  semanticOutput
} from "../learning-gateway-client.mjs";

const appSource=readFileSync(new URL("../app.js",import.meta.url),"utf8");
const runtimeSource=readFileSync(new URL("../learning-gateway-runtime.js",import.meta.url),"utf8");
const productionHarness=readFileSync(new URL("./verify-production-domain-pack-integration.mjs",import.meta.url),"utf8");

for(const signature of [
  "function legalCards(playerIndex)",
  "function renderCoach()",
  "function recommendedStrategy(m)",
  "function renderPassingRecommendations()",
  "function rankHumanLegalCards",
  "function strategyViability(strategy)",
  "function currentMoonThreat()",
  "function renderOpponentAnalysis()",
  "function renderPostHandAnalysis()",
  "function renderPostGameAnalysis()",
  "function playCard(playerIndex,card)"
])assert.ok(appSource.includes(signature),`real app learning seam changed: ${signature}`);

for(const signature of [
  "const DEFAULT_MODE='gateway'",
  "modes:['legacy','gateway','parity']",
  "defaultMode:DEFAULT_MODE",
  "if(runtime.mode==='legacy')",
  "if(runtime.mode==='parity')",
  "learnerVisibleOnly:true",
  "serviceCredentialsInBrowser:false",
  "api.adaptLearnerVisibleState(state)",
  "void execute('evaluate-play',context,captured)",
  "window.CancellationHeartsLearningRuntime"
])assert.ok(runtimeSource.includes(signature),`gateway runtime integration guard failed: ${signature}`);
assert.ok(!runtimeSource.includes("DOMAIN_RUNTIME_SHARED_SECRET"));
assert.ok(!runtimeSource.includes("SUPABASE_SECRET_KEY"));
assert.ok(!runtimeSource.includes("Authorization: Bearer"));
assert.ok(!runtimeSource.includes("realizedOutcome:"),"app runtime must not add realized outcome to evaluate-play");

for(const required of [
  "assessHand","recommendStrategy","rejectedStrategies","recommendPassing","recommendPlay","detectPivot",
  "moonDefense","analyzeOpponents","postHand","postGame","replay","nextActivity"
])assert.ok(productionHarness.includes(required),`real Domain Pack harness lost ${required}`);
for(const rule of [
  "doubleTwoOpening","firstSeatLeftOfDealer","mayLeadHearts","noWinnerCarry","queenOfSpadesPoints","safeExit","leadControl"
])assert.ok(productionHarness.includes(rule),`real Domain Pack rule/integration coverage lost ${rule}`);

const card=(rank,suit,id=`${rank}${suit}`)=>({id,rank,suit});
const learner=[card("2","C"),card("5","C"),card("Q","C"),card("6","D"),card("10","D"),card("K","D"),card("2","S"),card("9","S"),card("Q","S"),card("6","H"),card("7","H"),card("10","H"),card("Q","H")];
const hidden=(seat)=>Array.from({length:13},(_,i)=>card(String((i%9)+2),["C","D","S","H"][i%4],`hidden-${seat}-${i}`));
const players=Array.from({length:8},(_,seat)=>({
  name:seat===0?"You":seat===2?"Partner":`CPU ${seat}`,
  persona:seat===1?"The Moonshot":"The Opportunist",
  score:20+seat,roundPoints:seat===1?13:0,hand:seat===0?learner:hidden(seat),tricks:[]
}));
const state={
  players,dealer:7,round:2,target:100,difficulty:"hard",currentPlayer:0,leader:1,
  trick:[{player:1,card:card("8","C"),cancelled:false}],trickNumber:4,heartsBroken:true,phase:"playing",passOffset:-1,
  carryoverPoints:0,coachStrategy:"avoidance",originalStrategy:"avoidance",strategyPivots:[],mode:"standard",
  practiceType:"solo",practiceStrength:"strong",partnerIndex:null,actionLog:[{player:1,card:card("A","D"),trickNumber:1}]
};
const observable=adaptLearnerVisibleState(state);
const legal=[card("2","C"),card("5","C"),card("Q","C")];
const context={legalCards:legal,strategy:"avoidance",weights:{board:33,score:33,strategy:34},chosenCardCode:"QC",targetSkillId:"cancellation-hearts.strategy.pivot",seed:"parity-seed"};

const legacy={
  "assess-hand":{strategy:"avoidance",summary:"Legacy wording may differ."},
  "recommend-strategy":"avoidance",
  "rejected-strategies":[{strategy:"targeting"},{strategy:"cancellation"},{strategy:"soloMoon"},{strategy:"twoMoon"}],
  "recommend-passing":{primary:[{card:{code:"QS"}},{card:{code:"QH"}},{card:{code:"10H"}}],secondary:[{card:{code:"9S"}},{card:{code:"7H"}},{card:{code:"6H"}}]},
  "recommend-play":{recommended:{card:{code:"QC"}},alternatives:[{card:{code:"5C"}},{card:{code:"2C"}}]},
  "detect-pivot":{needed:false,from:"avoidance",to:"avoidance"},
  "moon-defense":{required:true,objective:"Force penalty points to a different collector."},
  "analyze-opponents":players.slice(1).map((player,index)=>({seat:index+1,name:player.name})),
  "post-hand":{originalStrategy:"avoidance",pivot:{needed:false}},
  "post-game":{learnerScore:20,placement:1},
  "evaluate-play":{recommendedCardCode:"QC",chosenCardCode:"QC",chosenDecisionScore:91,ambiguous:false,realizedOutcomeUsedForScoring:false},
  "next-activity":{familyId:"strategy-pivot",targetSkillId:"cancellation-hearts.strategy.pivot"}
};

const gatewayOutputs={
  "assess-hand":{strategy:"avoidance",summary:"Prefer avoidance from the current hand structure."},
  "recommend-strategy":"avoidance",
  "rejected-strategies":[{strategy:"targeting"},{strategy:"cancellation"},{strategy:"soloMoon"},{strategy:"twoMoon"}],
  "recommend-passing":legacy["recommend-passing"],
  "recommend-play":legacy["recommend-play"],
  "detect-pivot":legacy["detect-pivot"],
  "moon-defense":legacy["moon-defense"],
  "analyze-opponents":legacy["analyze-opponents"].map(row=>({...row,observations:0,personaCandidates:["insufficient-evidence"],confidence:0})),
  "post-hand":{originalStrategy:"avoidance",pivot:{needed:false},handPoints:0,outcomeUsedAsDecisionQuality:false},
  "post-game":{learnerScore:20,placement:1,outcomeUsedAsDecisionQuality:false},
  "evaluate-play":legacy["evaluate-play"],
  "next-activity":legacy["next-activity"]
};

let currentOperation=null;
const client=createLearningGatewayClient({
  baseUrl:"https://gateway.example",
  idFactory:()=>"parity",
  fetchImpl:async(url,init)=>{
    const operation=url.split('/').pop();currentOperation=operation;
    const request=JSON.parse(String(init.body));
    assert.equal(request.learnerVisibleState.informationBoundary,"learner-observable");
    assert.ok(!JSON.stringify(request).includes("hidden-1-0"));
    assert.ok(!JSON.stringify(request).includes("The Moonshot"));
    if(operation==="evaluate-play")assert.ok(!Object.hasOwn(request.operationInput,"realizedOutcome"));
    return new Response(JSON.stringify({
      domainId:"cancellation-hearts",packVersion:"0.1.0",operation,requestId:"gateway-request",correlationId:"gateway-correlation",
      disposition:"completed",output:operation==="next-activity"?undefined:gatewayOutputs[operation],
      activityResult:operation==="next-activity"?gatewayOutputs[operation]:undefined,provenanceRefs:["domain-runtime:test"]
    }),{status:200,headers:{"content-type":"application/json"}});
  }
});

const parity={};
for(const operation of LEARNING_OPERATIONS){
  const input=buildOperationInput(operation,context);
  const result=await client.execute(operation,observable,input);
  assert.equal(currentOperation,operation);
  const comparison=compareSemanticOutputs(operation,legacy[operation],result);
  parity[operation]=comparison;
}

// Assessment prose intentionally differs between the old coach and Domain Pack.
// The parity gate compares the strategy decision, not sentence wording.
assert.equal(semanticOutput("assess-hand",legacy["assess-hand"]).strategy,semanticOutput("assess-hand",{
  disposition:"completed",output:gatewayOutputs["assess-hand"]
}).strategy);
parity["assess-hand"]={...parity["assess-hand"],equal:true,knownDifference:"explanatory wording"};

for(const [operation,result] of Object.entries(parity))assert.equal(result.equal,true,`${operation} semantic parity failed: ${JSON.stringify(result)}`);

console.log(`learning-gateway-parity: OK (${Object.keys(parity).length} operations; Gateway default with explicit legacy parity oracle retained)`);
