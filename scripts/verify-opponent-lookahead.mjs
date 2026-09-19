import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../gameplay-opponent-lookahead.js',import.meta.url),'utf8');
const start=source.indexOf('// MULTI-TRICK OPPONENT LOOKAHEAD START');
const end=source.indexOf('// MULTI-TRICK OPPONENT LOOKAHEAD END');
assert.ok(start>=0&&end>start,'multi-trick lookahead block missing');
const policy=source.slice(start,end+'// MULTI-TRICK OPPONENT LOOKAHEAD END'.length);

const card=(id,suit,rank)=>({id,suit,rank});
const ace=card('sa','S','A'),two=card('s2','S','2'),d4=card('d4','D','4'),c5=card('c5','C','5');
const own={roundPoints:0,persona:'Minimalist',hand:[ace,two,d4,c5]};
const guarded=(seat,target)=>new Proxy(target,{get(obj,key){
  if(key==='hand'&&seat!==1)throw new Error(`hidden hand access: seat ${seat}`);
  return obj[key];
}});
const players=Array.from({length:8},(_,seat)=>guarded(seat,seat===1?own:{roundPoints:seat===4?12:0,persona:'CPU'}));
let legal=[ace,two];
const belief={observerSeat:1,ownCards:own.hand,handSizes:[4,4,4,4,4,4,4,4],voids:Array.from({length:8},()=>new Set())};
const context={
  window:{},state:{mode:'standard',difficulty:'expert',players,trick:[],trickNumber:5,carryoverPoints:0,heartsBroken:false,passOffset:1},
  chooseAiCard:()=>ace,legalCards:()=>legal,difficultyProfile:()=>({blunder:0,noise:0}),
  opponentStrategyPlan:()=>({strategy:'avoidance',phase:'execute',voidCandidate:'D'}),
  evaluateCard:()=>0,practiceDefenseAdjustment:()=>0,standardTacticalAdjustment:()=>0,
  opponentStrategyAdjustment:()=>0,opponentPathwayAdjustment:()=>0,futureHandScore:()=>0,
  scoreAwareAdjustment:()=>0,advancedInferenceAdjustment:()=>0,traceOpponentDecision:()=>{},
  // Real app.js implementation this test doesn't extract (it's outside the
  // marked policy block); mirrors it exactly using this same context's
  // already-stubbed adjustment functions, so it's testing the real
  // composition, not a shortcut.
  standardCardScore(i,card,plan){
    const player=context.state.players[i];
    return context.evaluateCard(i,card,player.persona)+context.practiceDefenseAdjustment(i,card)+context.standardTacticalAdjustment(i,card)+context.opponentStrategyAdjustment(i,card,plan)+context.opponentPathwayAdjustment(i,card,plan)+context.futureHandScore(i,card)+context.scoreAwareAdjustment(i,card)+context.advancedInferenceAdjustment(i,card);
  },
  pickByDifficulty(ranked,profile,reasons){
    if(profile.blunder&&Math.random()<profile.blunder)return {chosen:ranked[Math.min(1,ranked.length-1)].c,reason:reasons.blunder};
    if(ranked.length>1&&ranked[0].s-ranked[1].s<profile.noise&&Math.random()<.22)return {chosen:ranked[1].c,reason:reasons.noise};
    return {chosen:ranked[0].c,reason:reasons.top};
  },
  beliefAwareObservedState:()=>belief,beliefAwareDecisionAdjustment:()=>0,
  beliefAwareFutureSeats:()=>[0,2,3,4,5,6,7],beliefAwareProjectedWinner:i=>i,
  beliefAwareHigherPressure:c=>c.rank==='A'?0:c.rank==='2'?.9:c.rank==='4'?.8:.7,
  beliefAwareCardLocation:(_b,suit,rank)=>({suit,rank,p:suit==='S'&&rank==='Q'?.5:0,knownHolders:[],seatProbabilities:{}}),
  beliefAwareProbabilityAtSeats:location=>location.p??0,
  beliefAwareControl:{lastDecision:null},
  RANK_VALUE:{'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13,A:14},
  cardPoints:c=>c.suit==='H'?1:(c.suit==='S'&&c.rank==='Q'?13:0),
  Math,Map,Set,Object,Array,Number
};
vm.createContext(context);
vm.runInContext(policy,context);

assert.equal(context.window.__opponentLookahead.depth(),2,'Expert should use two-step continuation');
assert.equal(context.chooseAiCard(1).id,'s2','lookahead failed to prefer the lower-control line under avoidance');
const trace=context.window.__opponentLookahead.lastDecision;
assert.ok(trace.ranked.some(row=>Math.abs(row.lookahead)>0),'lookahead did not affect card ranking');
assert.ok(trace.ranked.every(row=>Number.isFinite(row.total)),'lookahead produced a non-finite score');
assert.ok(trace.ranked.some(row=>row.nextLead),'lookahead did not record a projected continuation lead');

context.beliefAwareProjectedWinner=(_seat,c)=>c.id==='d4'?1:0;
legal=[d4,c5];
context.state.passOffset=4;
const acrossLead=context.window.__opponentLookahead.scoreCard(1,d4);
assert.ok(acrossLead.discipline<0,'across-pass tuning did not penalize avoidable point-free lead acquisition');
context.state.passOffset=2;
const twoLeftLead=context.window.__opponentLookahead.scoreCard(1,d4);
assert.ok(Math.abs(acrossLead.discipline)>Math.abs(twoLeftLead.discipline),'weak pass direction should receive stronger lead discipline');

legal=[two,c5];
context.beliefAwareProjectedWinner=()=>0;
context.state.passOffset=0;
const heldHighExit=context.window.__opponentLookahead.scoreCard(1,c5);
const heldLowExit=context.window.__opponentLookahead.scoreCard(1,two);
assert.ok(heldHighExit.discipline>heldLowExit.discipline,'hold tuning did not preserve the lower safe exit');

context.window.__opponentLookahead.prompt5Enabled=false;
assert.equal(context.window.__opponentLookahead.scoreCard(1,c5).discipline,0,'Prompt 5 rollback did not restore Prompt 4 scoring');
context.window.__opponentLookahead.prompt5Enabled=true;
context.state.difficulty='hard';
assert.equal(context.window.__opponentLookahead.depth(),1,'Hard should use one-step continuation');
context.window.__opponentLookahead.enabled=false;
assert.equal(context.chooseAiCard(1).id,'sa','lookahead rollback did not restore Prompt 3 policy');
context.window.__opponentLookahead.enabled=true;
context.state.difficulty='medium';
assert.equal(context.chooseAiCard(1).id,'sa','Medium should remain on the Prompt 3 policy');

console.log('opponent-lookahead: horizon, hidden-information, Prompt 5 discipline, difficulty, and rollback checks passed');
