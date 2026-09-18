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
  RANK_VALUE:Object.fromEntries(['2','3','4','5','6','7','8','9','10','J','Q','K','A'].map((r,i)=>[r,i+2])),
  difficultyProfile(){return {lookahead:5,noise:.18,blunder:0,moonThreshold:5};},
  legalCards(){return context.legal;},
  humanHandMetrics(){return {voidCandidate:'D'};}, recommendedStrategy(){return context.nextStrategy||'avoidance';},
  currentPenaltyCollectors(){return context.state.players.map((p,i)=>({i,points:p.roundPoints})).filter(x=>x.points>0);},
  evaluateCard(){return 0;}, practiceDefenseAdjustment(){return 0;}, futureHandScore(){return 0;},
  scoreAwareAdjustment(){return 0;}, advancedInferenceAdjustment(){return 0;}, practiceThreatState(){return {credible:false};},
  currentLedSuit(){return context.state.trick[0]?.card.suit||null;},
  cardPoints(c){return c.suit==='H'?1:(c.suit==='S'&&c.rank==='Q'?13:0);},
  Math, console
};
vm.createContext(context);
vm.runInContext([
  declaration('resolveFakeCancellation'),
  declaration('currentWinningPlayerIfPlayed'),
  declaration('opponentStrategyPlan'),
  declaration('opponentStrategyAdjustment'),
  declaration('standardTacticalAdjustment'),
  declaration('standardMoonThreat'),
  declaration('chooseAiCard')
].join('\n'),context);

const card=(suit,rank,id=`${suit}${rank}`)=>({suit,rank,id});
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
context.nextStrategy='soloMoon';
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

console.log('standard-opponent-ai: 11 deterministic cases passed');
