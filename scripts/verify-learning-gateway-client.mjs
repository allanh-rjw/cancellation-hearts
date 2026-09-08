import assert from "node:assert/strict";
import {
  LEARNING_OPERATIONS,
  LearningGatewayError,
  adaptLearnerVisibleState,
  buildOperationInput,
  compareSemanticOutputs,
  createLearningGatewayClient,
  normalizeMigrationMode,
  semanticOutput
} from "../learning-gateway-client.mjs";

const card=(rank,suit,id=`${rank}${suit}`)=>({id,rank,suit});
const hidden=(seat)=>Array.from({length:13},(_,i)=>card(String((i%9)+2),["C","D","S","H"][i%4],`hidden-${seat}-${i}`));
const learner=[card("2","C"),card("5","C"),card("Q","C"),card("6","D"),card("10","D"),card("K","D"),card("2","S"),card("9","S"),card("Q","S"),card("6","H"),card("7","H"),card("10","H"),card("Q","H")];
const players=Array.from({length:8},(_,seat)=>({
  name:seat===0?"You":`CPU ${seat}`,
  persona:seat===1?"The Moonshot":"The Opportunist",
  score:20+seat,
  roundPoints:seat===1?13:0,
  hand:seat===0?learner:hidden(seat),
  tricks:seat===1?[{}]:[]
}));
const state={
  players,dealer:7,round:2,target:100,difficulty:"hard",currentPlayer:0,leader:1,
  trick:[{player:1,card:card("8","C","trick-8c"),cancelled:false}],trickNumber:4,heartsBroken:true,
  phase:"playing",passOffset:-1,carryoverPoints:0,coachStrategy:"avoidance",originalStrategy:"avoidance",
  strategyPivots:[],mode:"standard",practiceType:"solo",practiceStrength:"strong",partnerIndex:null,
  actionLog:[{player:1,card:card("A","D","seen-ad"),trickNumber:1}]
};

const observable=adaptLearnerVisibleState(state);
assert.equal(observable.schemaVersion,1);
assert.equal(observable.informationBoundary,"learner-observable");
assert.equal(observable.learnerHand.length,13);
assert.equal(observable.players.length,8);
assert.equal(observable.players[1].cardCount,13);
assert.equal(observable.observedActions[0].card.code,"AD");
const text=JSON.stringify(observable);
assert.ok(!text.includes("hidden-1-0"),"opponent hidden hand leaked into gateway payload");
assert.ok(!text.includes("The Moonshot"),"persona truth leaked into gateway payload");
assert.ok(!text.includes("persona"),"persona field leaked into gateway payload");

assert.equal(normalizeMigrationMode("legacy"),"legacy");
assert.equal(normalizeMigrationMode("gateway"),"gateway");
assert.equal(normalizeMigrationMode("parity"),"parity");
assert.equal(normalizeMigrationMode("mystery"),"legacy");

const legal=[card("2","C"),card("5","C"),card("Q","C")];
const playInput=buildOperationInput("recommend-play",{
  legalCards:legal,strategy:"avoidance",weights:{board:33,score:33,strategy:34}
});
assert.deepEqual(playInput.legalCards.map(c=>c.code),["2C","5C","QC"]);
assert.equal(playInput.strategy,"avoidance");
assert.deepEqual(playInput.weights,{board:33,score:33,strategy:34});

const evaluateInput=buildOperationInput("evaluate-play",{
  legalCards:legal,
  chosenCardCode:"QC",
  strategy:"avoidance",
  weights:{board:33,score:33,strategy:34},
  realizedOutcome:{bad:true,hiddenInformationRevealedLater:true}
});
assert.equal(evaluateInput.chosenCardCode,"QC");
assert.ok(!Object.hasOwn(evaluateInput,"realizedOutcome"),"realized future outcome must not cross the app evaluation boundary");
assert.deepEqual(buildOperationInput("next-activity",{targetSkillId:"cancellation-hearts.strategy.pivot",seed:"seed"}),{
  targetSkillId:"cancellation-hearts.strategy.pivot",seed:"seed"
});
for(const operation of LEARNING_OPERATIONS)assert.doesNotThrow(()=>buildOperationInput(operation,{legalCards:legal}));

let captured=null;
const fakeFetch=async(url,init)=>{
  captured={url,init,body:JSON.parse(String(init.body))};
  return new Response(JSON.stringify({
    domainId:"cancellation-hearts",
    packVersion:"0.1.0",
    operation:"recommend-strategy",
    requestId:"server-request",
    correlationId:"server-correlation",
    disposition:"completed",
    output:"avoidance",
    provenanceRefs:["domain-runtime:test"],
    learning:{snapshotVersion:1,evidenceIds:[]}
  }),{status:200,headers:{"content-type":"application/json"}});
};
const client=createLearningGatewayClient({baseUrl:"https://gateway.example",fetchImpl:fakeFetch,idFactory:(()=>{let i=0;return()=>String(++i);})()});
const result=await client.execute("recommend-strategy",observable,{});
assert.equal(result.output,"avoidance");
assert.equal(captured.url,"https://gateway.example/v1/domains/cancellation-hearts/recommend-strategy");
assert.equal(captured.init.method,"POST");
assert.equal(captured.init.credentials,"include");
assert.equal(captured.init.headers.authorization,undefined,"browser client must not send a service bearer token");
assert.equal(captured.body.learnerVisibleState.informationBoundary,"learner-observable");
assert.ok(!Object.hasOwn(captured.body,"learnerRef"),"browser must not manufacture learner identity");
assert.ok(!Object.hasOwn(captured.body,"accountId"),"browser must not manufacture account identity");
assert.deepEqual(Object.keys(captured.body).sort(),["learnerVisibleState","operationInput"]);

const unauthorized=createLearningGatewayClient({
  fetchImpl:async()=>new Response(JSON.stringify({code:"authentication-required"}),{status:401,headers:{"content-type":"application/json"}})
});
await assert.rejects(()=>unauthorized.execute("assess-hand",observable,{}),error=>{
  assert.ok(error instanceof LearningGatewayError);
  assert.equal(error.code,"authentication-required");
  assert.equal(error.status,401);
  assert.equal(error.retryable,false);
  return true;
});

const malformed=createLearningGatewayClient({
  fetchImpl:async()=>new Response(JSON.stringify({domainId:"wrong",operation:"assess-hand",disposition:"completed"}),{status:200,headers:{"content-type":"application/json"}})
});
await assert.rejects(()=>malformed.execute("assess-hand",observable,{}),error=>error instanceof LearningGatewayError&&error.code==="malformed-response");

const legacyPlay={recommended:{card:{code:"QC"}},alternatives:[{card:{code:"5C"}}]};
const gatewayPlay={disposition:"completed",output:{recommended:{card:{code:"QC"}},alternatives:[{card:{code:"5C"}}]}};
assert.deepEqual(semanticOutput("recommend-play",legacyPlay),{recommended:"QC",alternatives:["5C"]});
assert.equal(compareSemanticOutputs("recommend-play",legacyPlay,gatewayPlay).equal,true);

console.log("learning-gateway-client: OK");
