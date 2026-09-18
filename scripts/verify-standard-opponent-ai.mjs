import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
function declaration(name){
  const start=source.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`missing ${name}`);
  const body=source.indexOf('{',start);
  let depth=0;
  for(let i=body;i<source.length;i++){
    if(source[i]==='{') depth++;
    if(source[i]==='}'&&--depth===0) return source.slice(start,i+1);
  }
  throw new Error(`unterminated ${name}`);
}

const context={
  state:null,
  SUITS:['C','D','S','H'],
  RANK_VALUE:Object.fromEntries(['2','3','4','5','6','7','8','9','10','J','Q','K','A'].map((r,i)=>[r,i+2])),
  difficultyProfile(){return {lookahead:5,noise:.18,blunder:0,moonThreshold:5};},
  legalCards(){return context.legal;},
  humanHandMetrics(){return context.metrics;},
  spadeVulnerability(m){return {level:m.spadeLevel||'low'};},
  duplicateLiveFor(){return false;},
  currentPenaltyCollectors(){return context.state.players.map((p,i)=>({i,points:p.roundPoints})).filter(x=>x.points>0);},
  evaluateCard(){return 0;}, practiceDefenseAdjustment(){return 0;}, futureHandScore(){return 0;},
  scoreAwareAdjustment(){return 0;}, advancedInferenceAdjustment(){return 0;}, practiceThreatState(){return {credible:false};},
  currentLedSuit(){return context.state.trick[0]?.card.suit||null;},
  cardPoints(c){return c.suit==='H'?1:(c.suit==='S'&&c.rank==='Q'?13:0);},
  Math, console
};
vm.createContext(context);
vm.runInContext([
  declaration('strategyAssessment'),
  declaration('recommendedStrategy'),
  declaration('opponentPassStrategyScore'),
  declaration('resolveFakeCancellation'),
  declaration('currentWinningPlayerIfPlayed'),
  declaration('refreshOpponentPathway'),
  declaration('opponentStrategyPlan'),
  declaration('opponentStrategyAdjustment'),
  declaration('opponentPathwayAdjustment'),
  declaration('standardTacticalAdjustment'),
  declaration('standardMoonThreat'),
  declaration('opponentDecisionOutcome'),
  declaration('traceOpponentDecision'),
  declaration('chooseAiCard')
].join('\n'),context);

const card=(suit,rank,id=`${suit}${rank}`)=>({suit,rank,id});
const metrics=(overrides={})=>({
  hand:[],counts:{C:4,D:4,S:3,H:2},hearts:[],pairs:[],exits:[card('C','2'),card('D','3')],control:2,voidCandidate:'H',spadeLevel:'low',...overrides
});
context.metrics=metrics();
context.state={
  mode:'standard',difficulty:'expert',trickNumber:4,carryoverPoints:0,
  opponentPlans:{},players:Array.from({length:8},(_,i)=>({score:i===2?0:20,roundPoints:0,persona:'The Opportunist',hand:[]})),
  trick:[
    {player:1,card:card('C','K'),cancelled:false},
    {player:2,card:card('C','Q'),cancelled:false},
    {player:3,card:card('C','J'),cancelled:false},
    {player:4,card:card('C','10'),cancelled:false},
    {player:5,card:card('S','Q'),cancelled:false},
    {player:6,card:card('H','2'),cancelled:false},
    {player:7,card:card('H','3'),cancelled:false}
  ]
};
context.legal=[card('C','A','winning-ace'),card('C','2','safe-two')];
assert.equal(context.chooseAiCard(0).id,'safe-two','Expert opponent knowingly won a loaded final-seat trick');
assert.equal(context.state.trick.every(x=>x.cancelled===false),true,'opponent analysis mutated the live trick');

context.state.trickNumber=3;
assert.equal(context.standardMoonThreat([],0,3),false,'point-free control triggered false moon defense');
assert.equal(context.standardMoonThreat([{idx:2,pts:1}],1,2),false,'one incidental point triggered false moon defense');
assert.equal(context.standardMoonThreat([{idx:2,pts:2}],2,2),true,'repeated control plus concentrated points was missed');
context.state.trickNumber=6;
assert.equal(context.standardMoonThreat([{idx:2,pts:4}],4,1),true,'late concentrated scoring was missed');

context.state.opponentPlans={};
context.state.opponentPlans[1]={strategy:'soloMoon',originalStrategy:'soloMoon',voidCandidate:'D',partner:null,pivots:[]};
let plan=context.opponentStrategyPlan(1);
assert.equal(plan.strategy,'soloMoon','opponent did not retain its selected hand strategy');
context.state.players[2].roundPoints=1;
plan=context.opponentStrategyPlan(1);
assert.equal(plan.strategy,'twoMoon','opponent did not pivot from a broken solo moon to a two-player moon');
assert.equal(plan.partner,2,'opponent did not identify the second scorer as its moon partner');
context.state.players[3].roundPoints=1;
plan=context.opponentStrategyPlan(1);
assert.equal(plan.strategy,'avoidance','opponent continued an impossible two-player moon');
assert.equal(plan.pivots.length,2,'opponent strategy pivots were not retained across the hand');

const honors=[card('H','A'),card('H','K'),card('H','Q'),card('H','J'),card('H','10'),card('C','A'),card('D','A'),card('S','A')];
context.state.players.forEach((p,i)=>{p.score=i===2?0:12;p.roundPoints=0;});
let assessment=context.strategyAssessment(metrics({hand:honors,counts:{C:1,D:1,S:1,H:5},hearts:honors.slice(0,5),control:9,exits:[]}),1);
assert.equal(assessment.strategy,'soloMoon','strong continuous control was not classified as a solo moon');
assert.ok(assessment.evidence.length>=3,'solo moon selection lacked evidence');

const twoHand=[card('H','A'),card('H','K'),card('H','8'),card('H','7'),card('C','A'),card('D','A')];
assessment=context.strategyAssessment(metrics({hand:twoHand,counts:{C:3,D:3,S:3,H:4},hearts:twoHand.slice(0,4),control:7}),1);
assert.equal(assessment.strategy,'twoMoon','credible shared control was not classified as a two-player moon');

assessment=context.strategyAssessment(metrics({pairs:['A♣','7♦','5♥'],control:4}),1);
assert.equal(assessment.strategy,'cancellation','useful paired structure was not classified as cancellation');
assessment=context.strategyAssessment(metrics({pairs:['7♣','6♦','5♥'],control:4}),1);
assert.notEqual(assessment.strategy,'cancellation','low pairs without control were treated as a full cancellation strategy');

assessment=context.strategyAssessment(metrics({counts:{C:5,D:5,S:1,H:2},voidCandidate:'S',control:4}),1);
assert.equal(assessment.strategy,'targeting','score gap, void access, control, and exits did not select targeting');
assessment=context.strategyAssessment(metrics({counts:{C:5,D:5,S:1,H:2},voidCandidate:'S',control:4,exits:[]}),1);
assert.equal(assessment.strategy,'avoidance','targeting was selected without an exit pathway');
context.state.players[2].score=6;
assessment=context.strategyAssessment(metrics({counts:{C:5,D:5,S:1,H:2},voidCandidate:'S',control:4}),1);
assert.equal(assessment.strategy,'avoidance','a marginal scoreboard gap triggered targeting');
context.state.players[2].score=0;
assessment=context.strategyAssessment(metrics({counts:{C:5,D:4,S:2,H:2},voidCandidate:'S',control:4}),1);
assert.equal(assessment.strategy,'avoidance','targeting was selected without immediate void access');

assessment=context.strategyAssessment(metrics({hand:honors,counts:{C:1,D:1,S:1,H:5},hearts:honors.slice(0,5),control:9,exits:[],spadeLevel:'severe'}),1);
assert.equal(assessment.strategy,'avoidance','severe spade exposure was ignored in moon selection');

context.state.trickNumber=6;context.metrics=metrics({control:1,counts:{C:4,D:4,S:3,H:2}});
context.state.opponentPlans={1:{strategy:'targeting',originalStrategy:'targeting',target:2,voidCandidate:'S',partner:null,pivots:[]}};
context.state.players[2].roundPoints=10;context.state.players[3].score=0;
plan=context.opponentStrategyPlan(1);
assert.equal(plan.strategy,'avoidance','targeting continued after its target and control pathway disappeared');
assert.match(plan.pivots[0].reason,/target|pathway/i,'targeting pivot did not record evidence');

context.state.trickNumber=5;
context.state.opponentPlans={1:{strategy:'targeting',originalStrategy:'targeting',target:2,voidCandidate:'S',partner:null,pivots:[]}};
plan=context.opponentStrategyPlan(1);
assert.equal(plan.strategy,'targeting','targeting pivoted after one poor early position');

context.metrics=metrics({pairs:[]});
context.state.trickNumber=7;
context.state.opponentPlans={1:{strategy:'cancellation',originalStrategy:'cancellation',voidCandidate:'D',partner:null,pivots:[]}};
plan=context.opponentStrategyPlan(1);
assert.equal(plan.strategy,'avoidance','cancellation continued without useful paired structure');

context.state.trickNumber=5;context.state.carryoverPoints=0;
context.state.trick=[{player:2,card:card('C','9'),cancelled:false}];
context.legal=[card('C','8','safe-high'),card('C','2','saved-exit')];
context.state.players[1].hand=[...context.legal];
plan={strategy:'avoidance',phase:'execute',voidCandidate:'D',pathway:{entryId:null,exitId:'saved-exit'}};
assert.ok(context.opponentPathwayAdjustment(1,context.legal[0],plan)>context.opponentPathwayAdjustment(1,context.legal[1],plan),'pathway spent a low exit instead of the highest safe loser');

context.state.trick=[{player:2,card:card('C','5'),cancelled:false}];
context.legal=[card('C','8','needless-entry'),card('C','2','safe-loss')];
context.state.players[1].hand=[...context.legal];
plan.pathway={entryId:'needless-entry',exitId:'safe-loss'};
assert.ok(context.opponentPathwayAdjustment(1,context.legal[0],plan)<context.opponentPathwayAdjustment(1,context.legal[1],plan),'pathway acquired a point-free lead without an objective');

context.state.trick=[{player:2,card:card('D','9'),cancelled:false}];
context.legal=[card('D','5','complete-void')];context.state.players[1].hand=[context.legal[0],card('C','4')];
plan={strategy:'avoidance',phase:'establish',voidCandidate:'D',pathway:{entryId:null,exitId:null}};
assert.ok(context.opponentPathwayAdjustment(1,context.legal[0],plan)>0,'pathway did not reward safe completion of the intended void');

context.state.opponentPlans={1:plan};context.state.opponentDiagnostics={enabled:true,shadowPolicy:'greedy',rows:[]};
const gameplayBefore=JSON.stringify({trick:context.state.trick,players:context.state.players,carryoverPoints:context.state.carryoverPoints});
const tracedChoice=context.chooseAiCard(1);
assert.equal(JSON.stringify({trick:context.state.trick,players:context.state.players,carryoverPoints:context.state.carryoverPoints}),gameplayBefore,
  'shadow evaluation mutated gameplay state');
assert.equal(context.state.opponentDiagnostics.rows.length,1,'enabled diagnostics did not record one decision');
const trace=context.state.opponentDiagnostics.rows[0];
assert.equal(trace.selected.cardId,tracedChoice.id,'trace did not record the production selection');
assert.equal(trace.shadow.cardId,trace.legalActions[0].cardId,'greedy shadow did not select the highest-ranked candidate');
assert.ok(Object.hasOwn(trace.selected,'strategyProgress'),'trace omitted strategy progress');
assert.ok(Object.hasOwn(trace.tieBreak,'scoreGap'),'trace omitted deterministic tie-breaking evidence');

console.log('standard-opponent-ai: 35 deterministic cases passed');
