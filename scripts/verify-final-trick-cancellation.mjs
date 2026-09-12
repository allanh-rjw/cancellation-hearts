import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../gameplay-standard-fixes.js',import.meta.url),'utf8');
const hidden=new Set();
const buttons={nextTrickBtn:{classList:{add:x=>hidden.add(x),remove:x=>hidden.delete(x)}}};
let status='';
let finishRoundCalls=0;
let brokenCalls=0;
let baseFinishCalls=0;

const context={
  console,
  Math,
  Set,
  state:null,
  startFirstTrick(){},startTrick(){},continueTurn(){},playCard(){},renderSeats(){},renderTrick(){},
  finishTrick(){baseFinishCalls++;},
  currentLedSuit(){return 'C';},
  cardPoints(c){return c.suit==='H'?1:(c.suit==='S'&&c.rank==='Q'?13:0);},
  renderTrickCoach(){},renderAll(){},renderHand(){},updateCancellation(){},chooseAiCard(){},legalCards(){return[];},
  rankHumanLegalCards(){return[];},buildHandPathway(){return{phase:'',immediate:''};},cardLabel(){return'';},playCardSound(){},
  currentTrickScoreFor(){return 0;},handScoreBeforeCurrentTrick(){return 0;},cardHtml(){return'';},
  setStatus(x){status=x;},
  practiceShootBroken(winner,points){
    if(context.state.mode!=='practice'||points<=0)return false;
    return !(context.state.shooters||[]).includes(winner);
  },
  endBrokenPractice(){brokenCalls++;context.state.practiceEnded=true;context.state.gameOver=true;context.state.phase='practice-end';},
  finishRound(){finishRoundCalls++;},
  setTimeout(fn){fn();},
  $:id=>buttons[id]??{classList:{add(){},remove(){}},innerHTML:'',appendChild(){},append(){}},
  document:{
    querySelector(){return null;},
    getElementById(){return null;},
    createElement(){return{id:'',className:'',textContent:'',append(){},appendChild(){}};},
    head:{appendChild(){}}
  }
};
vm.createContext(context);
vm.runInContext(source,context,{filename:'gameplay-standard-fixes.js'});

const c=(suit,rank,id)=>({suit,rank,id:id??`${suit}${rank}-${Math.random()}`});
const baseCancelled=()=>[
  {player:0,card:c('C','5','c5a'),cancelled:true},
  {player:1,card:c('C','5','c5b'),cancelled:true}
];

function reset({leader=3,carry=0,trick=[],mode='standard',shooters=[],initialPoints={}}={}){
  status='';finishRoundCalls=0;brokenCalls=0;baseFinishCalls=0;hidden.clear();
  const players=Array.from({length:8},(_,i)=>({name:`P${i}`,hand:[],tricks:[],roundPoints:initialPoints[i]??0,score:0}));
  context.state={
    mode,players,leader,trickNumber:12,trick:[...baseCancelled(),...trick],carryoverPoints:carry,
    carryoverCards:carry?[c('H','2','carry-card')]:[],phase:'playing',shooters,practiceEnded:false,gameOver:false,currentTrickAward:null
  };
  return context.state;
}
function assert(ok,msg){if(!ok)throw new Error(msg);}
function runFinalCase(name,opts,expectedPoints,{expectBroken=false}={}){
  const state=reset(opts);
  const before=state.players.reduce((n,p)=>n+p.roundPoints,0);
  context.finishTrick();
  assert(baseFinishCalls===0,`${name}: fell through to ordinary finishTrick`);
  assert(state.currentTrickAward?.finalCancellation===true,`${name}: final cancellation award not recorded`);
  assert(state.currentTrickAward.winner===state.leader,`${name}: wrong award recipient`);
  assert(state.currentTrickAward.points===expectedPoints,`${name}: expected ${expectedPoints} awarded points, got ${state.currentTrickAward.points}`);
  assert(state.carryoverPoints===0,`${name}: carryover points not cleared`);
  assert(state.carryoverCards.length===0,`${name}: carryover cards not cleared`);
  assert(state.trickNumber===13,`${name}: trick number did not advance to 13`);
  assert(hidden.has('hidden'),`${name}: next-trick control was not hidden`);
  const after=state.players.reduce((n,p)=>n+p.roundPoints,0);
  assert(after-before===expectedPoints,`${name}: score conservation failed; delta ${after-before}`);
  if(expectBroken){
    assert(brokenCalls===1,`${name}: Practice break was not triggered`);
    assert(finishRoundCalls===0,`${name}: broken Practice incorrectly finished the round`);
  }else{
    assert(brokenCalls===0,`${name}: unexpected Practice break`);
    assert(finishRoundCalls===1,`${name}: round did not finish exactly once`);
  }
  assert(status.includes('final-trick leader'),`${name}: status does not explain canonical fallback`);
}

runFinalCase('zero-point cancellation',{},0);
runFinalCase('hearts-only cancellation',{trick:[
  {player:2,card:c('H','2','h2'),cancelled:false},
  {player:4,card:c('H','3','h3'),cancelled:false}
]},2);
runFinalCase('single-queen cancellation',{trick:[{player:2,card:c('S','Q','sq1'),cancelled:false}]},13);
runFinalCase('double-queen cancellation',{trick:[
  {player:2,card:c('S','Q','sq1'),cancelled:true},
  {player:4,card:c('S','Q','sq2'),cancelled:true}
]},26);
runFinalCase('pre-existing carryover',{carry:7},7);
runFinalCase('carryover plus new points totaling 52',{carry:22,trick:[
  {player:2,card:c('S','Q','sq1'),cancelled:true},
  {player:4,card:c('S','Q','sq2'),cancelled:true},
  {player:5,card:c('H','2','h2'),cancelled:false},
  {player:6,card:c('H','3','h3'),cancelled:false},
  {player:7,card:c('H','4','h4'),cancelled:false},
  {player:3,card:c('H','5','h5'),cancelled:false}
]},52);

reset({leader:3,trick:[{player:3,card:c('C','A','ca'),cancelled:false}]});
context.finishTrick();
assert(baseFinishCalls===1,'ordinary non-cancelled final trick did not use ordinary finishTrick');
assert(finishRoundCalls===0,'ordinary fallback test unexpectedly invoked focused final-rule finishRound');

runFinalCase('solo moon final allocation',{leader:0,carry:22,mode:'practice',shooters:[0],trick:[
  {player:1,card:c('S','Q','sq1'),cancelled:true},
  {player:2,card:c('S','Q','sq2'),cancelled:true},
  {player:3,card:c('H','2','h2'),cancelled:false},
  {player:4,card:c('H','3','h3'),cancelled:false},
  {player:5,card:c('H','4','h4'),cancelled:false},
  {player:6,card:c('H','5','h5'),cancelled:false}
]},52);
runFinalCase('two-player second scorer',{leader:1,mode:'practice',shooters:[0,1],initialPoints:{0:39},trick:[
  {player:4,card:c('S','Q','sq1'),cancelled:false}
]},13);
runFinalCase('outsider breaks moon',{leader:2,mode:'practice',shooters:[0],trick:[
  {player:4,card:c('H','2','h2'),cancelled:false}
]},1,{expectBroken:true});

console.log('final-trick-cancellation: 10 deterministic cases passed');
