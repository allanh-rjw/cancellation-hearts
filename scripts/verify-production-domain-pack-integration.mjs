import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const root=process.env.CANCELLATION_HEARTS_DOMAIN_ROOT;
if(!root)throw new Error("CANCELLATION_HEARTS_DOMAIN_ROOT must point to a built production Domain Pack checkout");
const domain=await import(pathToFileURL(resolve(root,"dist/index.js")).href);
const {
  createCancellationHeartsTrainer,
  cancellationHeartsRules,
  firstSeatLeftOfDealer,
  mayLeadHearts,
  passOffsetForHand,
  resolveCancellationTrick
}=domain;
assert.equal(typeof createCancellationHeartsTrainer,"function");

const appSource=readFileSync(new URL("../app.js",import.meta.url),"utf8");
for(const signature of [
  "players: [], dealer: 0, round: 1, target: 100, difficulty: 'medium'",
  "currentPlayer: 0, leader: 0, trick: [], trickNumber: 0, heartsBroken: false",
  "passOffset: 1",
  "coachStrategy: null",
  "originalStrategy:null",
  "strategyPivots:[]",
  "carryoverPoints:0",
  "practiceType:'solo'",
  "partnerIndex:null",
  "actionLog:[]"
])assert.ok(appSource.includes(signature),`real app state signature changed: ${signature}`);
for(const signature of [
  "function legalCards(playerIndex)",
  "function currentTrickStatus()",
  "function renderCoach()",
  "function startFirstTrick()",
  "function updateCancellation()",
  "state.leader=(state.dealer+1)%8;",
  "state.openingAutoPlayers.add(i);",
  "while(state.openingAutoPlayers.has(state.currentPlayer)) state.currentPlayer=(state.currentPlayer+1)%8;",
  "if(card.suit==='H' && currentLedSuit()) state.heartsBroken=true;",
  "state.carryoverPoints+=trickPoints;"
])assert.ok(appSource.includes(signature),`real app rule boundary changed: ${signature}`);

// Canonical rule edge cases are executed by the Domain Pack while the source
// signatures above prove the real app still exposes the corresponding game
// execution seams. The harness contains no second rules implementation.
assert.equal(cancellationHeartsRules.deckCount,2);
assert.equal(cancellationHeartsRules.playerCount,8);
assert.equal(cancellationHeartsRules.queenOfSpadesPoints,13);
assert.equal(cancellationHeartsRules.openingLead,"player-left-of-dealer-with-both-two-of-clubs-preplayed");
assert.deepEqual(Array.from({length:8},(_,i)=>passOffsetForHand(i)),[1,-1,2,-2,3,-3,4,0]);
assert.equal(firstSeatLeftOfDealer(7),0);
assert.equal(firstSeatLeftOfDealer(3),4);
assert.equal(mayLeadHearts([{suit:"C"}],false),false);
assert.equal(mayLeadHearts([{suit:"C"}],true),true);
assert.equal(mayLeadHearts([{suit:"H"},{suit:"H"}],false),true);

const doubleTwoOpening=resolveCancellationTrick([
  {seat:2,card:{code:"2C",rank:"2",suit:"C"}},
  {seat:5,card:{code:"2C",rank:"2",suit:"C"}},
  {seat:0,card:{code:"8C",rank:"8",suit:"C"}}
]);
assert.deepEqual(doubleTwoOpening.cancelledCodes,["2C"]);
assert.equal(doubleTwoOpening.winnerSeat,0);

const noWinnerCarry=resolveCancellationTrick([
  {seat:2,card:{code:"2C",rank:"2",suit:"C"}},
  {seat:5,card:{code:"2C",rank:"2",suit:"C"}},
  {seat:0,card:{code:"QS",rank:"Q",suit:"S"}}
],4);
assert.equal(noWinnerCarry.winnerSeat,null);
assert.equal(noWinnerCarry.awardedPoints,0);
assert.equal(noWinnerCarry.carriedPoints,17);

const ordinaryLoadedTrick=resolveCancellationTrick([
  {seat:0,card:{code:"7D",rank:"7",suit:"D"}},
  {seat:1,card:{code:"KD",rank:"K",suit:"D"}},
  {seat:2,card:{code:"QS",rank:"Q",suit:"S"}}
],4);
assert.equal(ordinaryLoadedTrick.winnerSeat,1);
assert.equal(ordinaryLoadedTrick.awardedPoints,17);

const card=(rank,suit,id=`${rank}${suit}-a`)=>({id,rank,suit});
const learnerHand=[card("2","C"),card("5","C"),card("Q","C"),card("6","D"),card("10","D"),card("K","D"),card("2","S"),card("9","S"),card("Q","S"),card("6","H"),card("7","H"),card("10","H"),card("Q","H")];
const hidden=(seat)=>["2","3","4","5","6","7","8","9","10","J","Q","K","A"].map((rank,i)=>card(rank,["C","D","S","H"][i%4],`hidden-${seat}-${i}`));
const players=Array.from({length:8},(_,seat)=>({
  name:seat===0?"You":seat===2?"Partner":`CPU ${seat}`,
  persona:seat===1?"The Moonshot":"The Opportunist",
  score:seat===1?15:20+seat,
  roundPoints:seat===1?13:0,
  hand:seat===0?learnerHand:hidden(seat),
  tricks:[]
}));
function appState(patch={}){
  return {
    players,dealer:7,round:2,target:100,difficulty:"hard",currentPlayer:0,leader:1,
    trick:[{player:1,card:card("8","C","trick-8c"),cancelled:false}],trickNumber:4,heartsBroken:true,
    phase:"playing",selected:new Set(),passOffset:-1,gameOver:false,coachStrategy:"avoidance",
    coachWeights:{board:33,score:33,strategy:34},actionLog:[
      {player:1,card:card("A","D","seen-ad"),trickNumber:1},
      {player:1,card:card("K","C","seen-kc"),trickNumber:2}
    ],humanDecisionLog:[],roundStartMetrics:null,lastPostAnalysis:null,playSpeed:1,scoreHistory:[],showPersonas:false,
    currentTrickAward:null,audioContext:null,mode:"standard",practiceType:"solo",practiceStrength:"strong",partnerIndex:null,
    practiceEnded:false,carryoverPoints:0,carryoverCards:[],originalStrategy:"avoidance",strategyPivots:[],pendingPivot:null,
    openingAutoPlayers:new Set(),openingLeadSuit:null,opponentHistory:{},learningProfile:null,handAnalysisHistory:[],currentHandPathway:null,
    ...patch
  };
}
const trainer=createCancellationHeartsTrainer();
const state=appState();

const observable=trainer.adaptState(state);
const observableText=JSON.stringify(observable);
assert.equal(observable.learnerHand.length,13);
assert.equal(observable.players.length,8);
assert.ok(!observableText.includes("hidden-1-0"),"opponent hidden hand leaked across app boundary");
assert.ok(!observableText.includes("The Moonshot"),"persona truth leaked across app boundary");

const assessment=trainer.assessHand(state);
assert.ok(assessment.summary);
const strategy=trainer.recommendStrategy(state);
assert.ok(strategy);
const rejected=trainer.rejectedStrategies(state);
assert.equal(rejected.length,4);
assert.ok(rejected.every((entry)=>entry.fit&&entry.missing&&entry.trap));

const passing=trainer.recommendPassing(state,strategy);
assert.equal(passing.primary.length,3);
assert.equal(passing.secondary.length,3);

const legalCards=[card("2","C","2c"),card("5","C","5c"),card("Q","C","qc")].map((c)=>({...c,code:`${c.rank}${c.suit}`}));
const play=trainer.recommendPlay(state,legalCards,{strategy,weights:state.coachWeights});
assert.ok(play.recommended?.card?.code);
assert.ok(play.alternatives.length>0);

const pivot=trainer.detectPivot(appState({coachStrategy:"soloMoon",originalStrategy:"soloMoon"}),"soloMoon");
assert.equal(pivot.needed,true);
assert.ok(["twoMoon","avoidance"].includes(pivot.to));
const defense=trainer.moonDefense(state);
assert.equal(defense.required,true);
assert.equal(defense.threat.hiddenIntentClaimed,false);

const opponents=trainer.analyzeOpponents(state);
assert.equal(opponents.length,7);
assert.ok(opponents.every((row)=>row.deterministicPersonaClaim===false&&row.confidence<1));

const postHand=trainer.postHand(state);
const postGame=trainer.postGame(state);
assert.equal(postHand.outcomeUsedAsDecisionQuality,false);
assert.equal(postGame.outcomeUsedAsDecisionQuality,false);

assert.equal(trainer.recommendStrategy(appState({mode:"practice",practiceType:"solo"})),"soloMoon");
assert.equal(trainer.recommendStrategy(appState({mode:"practice",practiceType:"two",partnerIndex:2})),"twoMoon");

const replayBefore=trainer.replay(state,legalCards,"QC");
const replayAfter=trainer.replay(state,legalCards,"QC",{realizedOutcome:{bad:true,hiddenInformationRevealedLater:true}});
assert.equal(replayAfter.recommendedCardCode,replayBefore.recommendedCardCode);
assert.equal(replayAfter.chosenDecisionScore,replayBefore.chosenDecisionScore);
assert.equal(replayAfter.realizedOutcomeUsedForScoring,false);

const activityA=trainer.nextActivity("cancellation-hearts.strategy.pivot","app-harness-seed");
const activityB=trainer.nextActivity("cancellation-hearts.strategy.pivot","app-harness-seed");
assert.deepEqual(activityA,activityB);
assert.equal(activityA.familyId,"strategy-pivot");
assert.equal(activityA.generatedState.gameState.learnerHand.length,13);
const safeExit=trainer.nextActivity("cancellation-hearts.tactics.safe-exit","safe-exit-seed");
const leadControl=trainer.nextActivity("cancellation-hearts.tactics.lead-control","lead-control-seed");
assert.equal(safeExit.familyId,"safe-exit");
assert.equal(leadControl.familyId,"lead-control");

for(const required of ["assessHand","recommendStrategy","rejectedStrategies","recommendPassing","recommendPlay","detectPivot","moonDefense","analyzeOpponents","postHand","postGame","replay","nextActivity"])
  assert.equal(typeof trainer[required],"function",`missing production trainer surface ${required}`);

console.log("production-domain-pack-app-integration: OK");
