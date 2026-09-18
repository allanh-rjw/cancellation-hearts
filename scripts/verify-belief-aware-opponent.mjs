import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../gameplay-standard-fixes.js',import.meta.url),'utf8');
const start=source.indexOf('// BELIEF-AWARE OPPONENT POLICY START');
const end=source.indexOf('// BELIEF-AWARE OPPONENT POLICY END');
assert.ok(start>=0&&end>start,'belief-aware policy block missing');
const policy=source.slice(start,end+'// BELIEF-AWARE OPPONENT POLICY END'.length);

const card=(id,suit,rank)=>({id,suit,rank});
const p1={roundPoints:0,persona:'Minimalist',hand:[
  card('sa','S','A'),card('s2','S','2'),card('d4','D','4'),card('h5','H','5'),card('c6','C','6')
]};
const guardedPlayer=(seat,target)=>new Proxy(target,{get(obj,key){
  if(key==='hand'&&seat!==1)throw new Error(`omniscient hand access: seat ${seat}`);
  return obj[key];
}});
const players=Array.from({length:8},(_,seat)=>guardedPlayer(seat,seat===1?p1:{roundPoints:seat===4?12:0,persona:'CPU'}));
const c5=card('c5','C','5'),h7=card('h7','H','7'),s3=card('s3','S','3');
const action=(player,played,trick,position,before=[])=>({player,card:played,trick,position,round:1,before:{trick:before}});
const state={
  mode:'standard',difficulty:'expert',passOffset:1,round:1,players,
  actionLog:[
    action(0,c5,1,0),
    action(3,h7,1,1,[{player:0,card:c5}]),
    action(0,s3,4,0)
  ],
  trick:[{player:0,card:s3,cancelled:false}],carryoverPoints:0,trickNumber:3
};
const legal=[p1.hand[0],p1.hand[1]];
const context={
  window:{},state,RANK_VALUE:{'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13,A:14},
  choosePassCards:player=>player.hand.slice(-3),chooseAiCard:()=>legal[0],legalCards:()=>legal,
  difficultyProfile:()=>({blunder:0,noise:0}),opponentStrategyPlan:()=>null,
  evaluateCard:()=>0,practiceDefenseAdjustment:()=>0,standardTacticalAdjustment:()=>0,
  opponentStrategyAdjustment:()=>0,opponentPathwayAdjustment:()=>0,futureHandScore:()=>0,
  scoreAwareAdjustment:()=>0,advancedInferenceAdjustment:()=>0,traceOpponentDecision:()=>{},
  cardPoints:c=>c.suit==='H'?1:(c.suit==='S'&&c.rank==='Q'?13:0),Math,Map,Set,Object,Array,Number
};
vm.createContext(context);
vm.runInContext(policy,context);

const clubs=context.window.__opponentBeliefAware.inspectCard(1,'C','A');
assert.ok(!clubs.possibleSeats.includes(3),'known club void remained a possible holder');
const probabilitySum=Object.values(clubs.seatProbabilities).reduce((sum,p)=>sum+p,0);
assert.ok(Math.abs(probabilitySum-1)<1e-12,'card-location probabilities are not normalized');

const chosen=context.chooseAiCard(1);
assert.equal(chosen.id,'s2','belief-aware policy failed to avoid exposed high-spade control');
assert.equal(context.window.__opponentBeliefAware.lastDecision.chosen,'s2');
assert.ok(context.window.__opponentBeliefAware.lastDecision.ranked.some(row=>row.belief!==0),'belief score did not affect ranking');

const passed=context.choosePassCards(players[1]);
p1.hand=p1.hand.filter(c=>!passed.some(x=>x.id===c.id));
const passedLocation=context.window.__opponentBeliefAware.inspectCard(1,passed[2].suit,passed[2].rank);
assert.deepEqual([...passedLocation.knownHolders],[2],'own pass evidence did not preserve exact recipient knowledge');

context.window.__opponentBeliefAware.enabled=false;
assert.equal(context.chooseAiCard(1).id,'sa','diagnostic off switch did not restore baseline policy');
console.log('belief-aware-opponent: public-information, void, pass, ranking, and rollback checks passed');
