import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function fakeClassList(){return {add(){},remove(){},toggle(){},contains(){return false;}};}
function fakeElement(id=''){
  return {
    id, value:'', checked:false, disabled:false, open:false, textContent:'', innerHTML:'', dataset:{}, style:{},
    classList:fakeClassList(), previousElementSibling:{textContent:''},
    addEventListener(){}, setAttribute(){}, focus(){}, select(){}, appendChild(){}, insertAdjacentHTML(){},
    showModal(){this.open=true;}, close(){this.open=false;}, after(){}, querySelector(){return fakeElement();}, querySelectorAll(){return [];}
  };
}
const elements=new Map();
const defaults={personaMode:'balanced',gameMode:'standard',practiceType:'solo',practiceStrength:'strong',targetScore:'100',difficulty:'medium',playSpeed:'1',boardWeight:'33',scoreWeight:'33',strategyWeight:'34'};
function element(id){
  if(!elements.has(id)){const node=fakeElement(id);if(id in defaults)node.value=defaults[id];elements.set(id,node);}
  return elements.get(id);
}
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};};
const context={
  console, Math, Date, JSON, Set, Map, Object, Array, String, Number, Boolean, RegExp, Promise,
  localStorage:storage(),sessionStorage:storage(),
  document:{body:{classList:fakeClassList()},getElementById:element,querySelector:()=>fakeElement(),querySelectorAll:()=>[],createElement:()=>fakeElement()},
  setTimeout(){return 0;},clearTimeout(){},requestAnimationFrame(fn){return fn();},
  AudioContext:undefined,webkitAudioContext:undefined
};
context.window=context;context.window.location={reload(){}};
vm.createContext(context);
const source=fs.readFileSync('app.js','utf8')+`\n;globalThis.__engine={state,makeDeck,legalCards,updateCancellation,finishTrick,finishRound,cardPoints,startFirstTrick,PASS_CYCLE,RANK_VALUE};`;
vm.runInContext(source,context,{filename:'app.js'});
const {state,makeDeck,legalCards,updateCancellation,finishTrick,finishRound,startFirstTrick,PASS_CYCLE}=context.__engine;

function playersFromDeck(){
  const players=Array.from({length:8},(_,i)=>({name:i===0?'You':`CPU ${i}`,persona:'The Opportunist',score:0,roundPoints:0,hand:[],tricks:[]}));
  for(const card of makeDeck())players[card.id%8].hand.push(card);
  return players;
}
function reset(){
  state.players=playersFromDeck();state.dealer=7;state.round=1;state.target=999;state.currentPlayer=0;state.leader=0;
  state.trick=[];state.trickNumber=0;state.heartsBroken=false;state.phase='playing';state.gameOver=false;state.mode='standard';
  state.carryoverPoints=0;state.carryoverCards=[];state.openingAutoPlayers=new Set();state.openingLeadSuit=null;state.actionLog=[];state.humanDecisionLog=[];
  state.scoreHistory=[];state.strategyPivots=[];state.opponentHistory={};state.handAnalysisHistory=[];
  state.learningProfile={version:1,games:0,hands:0,persona:{},defenseBoost:0,targetingBoost:0,passingBoost:0};
}

{
  const deck=makeDeck();
  assert.equal(deck.length,104,'two decks must contain 104 physical cards');
  assert.equal(new Set(deck.map(card=>card.id)).size,104,'physical card ids must be unique');
  for(const suit of ['C','D','S','H'])for(const rank of ['2','3','4','5','6','7','8','9','10','J','Q','K','A']){
    const copies=deck.filter(card=>card.suit===suit&&card.rank===rank);
    assert.equal(copies.length,2,`${rank}${suit} must have two copies`);
    assert.equal(copies.map(card=>card.copy).sort().join(','),'0,1');
  }
  assert.equal(Array.from(PASS_CYCLE).join(','),'1,-1,2,-2,3,-3,4,0');
}

{
  reset();
  startFirstTrick();
  const twos=state.trick.filter(play=>play.card.suit==='C'&&play.card.rank==='2');
  assert.equal(twos.length,2,'both 2C must be prelaid');
  assert(twos.every(play=>play.prelaid&&play.cancelled),'both opening 2C cards must be marked prelaid and cancelled');
  assert.equal(state.openingAutoPlayers.size,2,'both 2C holders must count as having played');
  assert(!state.openingAutoPlayers.has(state.currentPlayer),'next actor must skip any prelaid 2C holder');
  assert.equal(state.leader,0,'opening logical leader is immediately left of dealer 7');
}

{
  reset();state.trickNumber=1;state.leader=3;state.currentPlayer=3;
  const deck=makeDeck();
  const get=(suit,rank,copy=0)=>deck.find(card=>card.suit===suit&&card.rank===rank&&card.copy===copy);
  state.trick=[
    {player:3,card:get('C','5',0),cancelled:false},{player:4,card:get('C','5',1),cancelled:false},
    {player:5,card:get('H','4',0),cancelled:false},{player:6,card:get('H','7',0),cancelled:false},
    {player:7,card:get('D','8',0),cancelled:false},{player:0,card:get('S','9',0),cancelled:false},
    {player:1,card:get('D','10',0),cancelled:false},{player:2,card:get('S','J',0),cancelled:false}
  ];
  updateCancellation();finishTrick();
  assert.equal(state.leader,3,'same leader must lead again when every led-suit card cancels');
  assert.equal(state.carryoverPoints,2,'penalty points from a no-winner trick must carry forward');
  assert.equal(state.currentTrickAward.winner,null,'no-winner trick must not invent a winner');

  state.trick=[
    {player:3,card:get('D','3',0),cancelled:false},{player:4,card:get('D','6',0),cancelled:false},
    {player:5,card:get('H','8',0),cancelled:false},{player:6,card:get('D','9',0),cancelled:false},
    {player:7,card:get('S','4',0),cancelled:false},{player:0,card:get('D','J',0),cancelled:false},
    {player:1,card:get('C','8',0),cancelled:false},{player:2,card:get('D','K',0),cancelled:false}
  ];
  updateCancellation();finishTrick();
  assert.equal(state.players[2].roundPoints,3,'winner must collect current trick points plus carryover');
  assert.equal(state.carryoverPoints,0,'carryover must clear after a winner collects it');
  assert.equal(state.leader,2,'winner becomes next leader');
}

{
  reset();state.trickNumber=2;state.openingLeadSuit=null;state.heartsBroken=false;
  const hand=state.players[0].hand;
  assert(hand.some(card=>card.suit==='H')&&hand.some(card=>card.suit!=='H'));
  assert(legalCards(0).every(card=>card.suit!=='H'),'hearts cannot be led before broken while a non-heart is available');
  state.heartsBroken=true;
  assert(legalCards(0).some(card=>card.suit==='H'),'hearts may be led after hearts are broken');

  const club=hand.find(card=>card.suit==='C'&&card.rank!=='2');
  state.trick=[{player:1,card:club,cancelled:false}];state.heartsBroken=false;
  assert(legalCards(0).every(card=>card.suit==='C'),'follow-suit must be enforced when learner has the led suit');
}

{
  reset();state.players[0].roundPoints=52;finishRound();
  assert.equal(state.players[0].score,0,'solo shooter receives no added points');
  assert(state.players.slice(1).every(player=>player.score===104),'all seven solo-moon opponents receive 104');

  reset();state.players[1].roundPoints=26;state.players[5].roundPoints=26;finishRound();
  assert.equal(state.players[1].score,0);assert.equal(state.players[5].score,0);
  assert(state.players.filter((_,i)=>i!==1&&i!==5).every(player=>player.score===26),'six non-shooters receive 26 on a two-player moon');
}

console.log('Cancellation Hearts executable game-engine conformance gate passed.');
