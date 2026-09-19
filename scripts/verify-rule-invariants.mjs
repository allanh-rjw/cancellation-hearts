import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../gameplay-rule-invariants.js',import.meta.url),'utf8');
const rulesNode={innerHTML:''};
let finishRoundCalls=0;
let beginRoundCalls=0;
let baseFinishCalls=0;
let basePlayCalls=0;
let status='';

const RANK_VALUE={2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,10:10,J:11,Q:12,K:13,A:14};
const context={
  console,Map,Set,Math,RANK_VALUE,
  window:{},state:null,
  document:{querySelector(selector){return selector==='#rulesDialog .rules-copy'?rulesNode:null;}},
  cardPoints(card){return card.suit==='H'?1:(card.suit==='S'&&card.rank==='Q'?13:0);},
  firstTwoClubsHolderLeftOfDealer(){
    const n=context.state.players.length;
    for(let step=1;step<=n;step++){
      const seat=(context.state.dealer+step)%n;
      if(context.state.players[seat].hand.some(card=>card.suit==='C'&&card.rank==='2'))return seat;
    }
    throw new Error('missing 2C');
  },
  legalCards(playerIndex){return context.state.players[playerIndex].hand;},
  startFirstTrick(){throw new Error('base startFirstTrick should be replaced');},
  beginRound(){beginRoundCalls++;},
  continueTurn(){},renderAll(){},renderTrickCoach(){},
  setStatus(value){status=value;},
  playCard(playerIndex,card){
    basePlayCalls++;
    const hand=context.state.players[playerIndex].hand;
    const index=hand.findIndex(x=>x.id===card.id);
    if(index<0)throw new Error('base play received missing card');
    hand.splice(index,1);
    context.state.trick.push({player:playerIndex,card,cancelled:false});
    context.state.currentPlayer=(playerIndex+1)%context.state.players.length;
  },
  finishTrick(){baseFinishCalls++;},
  currentLedSuit(){return context.state.openingLeadSuit||context.state.trick[0]?.card.suit||null;},
  gameplayAllHandsEmpty(){return context.state.players.every(player=>player.hand.length===0);},
  practiceShootBroken(){return false;},endBrokenPractice(){},
  finishRound(){finishRoundCalls++;},setTimeout(fn){fn();},
  $(){return{classList:{add(){},remove(){}}};}
};
vm.createContext(context);
vm.runInContext(source,context,{filename:'gameplay-rule-invariants.js'});

const c=(suit,rank,id)=>({suit,rank,id});
const player=hand=>({name:'P',hand:[...hand],roundPoints:0,tricks:[]});
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

// 1. First player clockwise from dealer holding 2C must lead.
context.state={players:[player([c('D','3','d0')]),player([c('C','2','2c-a')]),player([c('D','4','d2')]),player([c('C','2','2c-b')])],dealer:0,trick:[],trickNumber:0,phase:'passing',currentPlayer:null,openingLeadSuit:null,openingAutoPlayers:new Set()};
context.startFirstTrick();
assert(context.state.leader===1,'opening leader is not first 2C holder clockwise from dealer');
assert(context.state.currentPlayer===1,'opening current player does not match required leader');
assert(context.state.openingLeaderSeat===1,'opening leader was not frozen for the hand');
assert(status.includes('must lead exactly one copy'),'opening status does not state forced 2C lead');

// Impossible post-pass state exists only when a player holds nothing but opening penalty cards.
beginRoundCalls=0;
context.state={players:[player([c('C','2','lead')]),player([c('S','Q','sq'),c('H','4','h4')]),player([c('C','2','other'),c('D','7','d7')])],dealer:2,trick:[],trickNumber:0,phase:'passing',currentPlayer:null,openingLeadSuit:null,openingAutoPlayers:new Set(),ruleRedealAttempts:0};
context.startFirstTrick();
assert(beginRoundCalls===1,'penalty-only opening state was not rejected and redealt');
assert(context.state.phase==='passing','penalty-only opening state entered play');
assert(status.includes('Redealing'),'unplayable opening did not explain the redeal');

// A non-queen spade makes a club-void hand playable on trick 1.
beginRoundCalls=0;
context.state={players:[player([c('C','2','lead')]),player([c('S','8','s8'),c('H','4','h4')]),player([c('C','2','other'),c('D','7','d7')])],dealer:2,trick:[],trickNumber:0,phase:'passing',currentPlayer:null,openingLeadSuit:null,openingAutoPlayers:new Set(),ruleRedealAttempts:0};
context.startFirstTrick();
assert(beginRoundCalls===0,'legal non-queen spade incorrectly triggered a redeal');
assert(context.state.phase==='playing','legal non-queen spade hand did not enter play');

// 2, 5. A player holding both physical 2C cards plays exactly one and cannot play twice.
context.state={players:[player([c('D','3','d0')]),player([c('C','2','2c-a'),c('C','2','2c-b'),c('C','9','9c')]),player([c('D','5','5d')]),player([c('C','7','7c')])],dealer:0,trick:[],trickNumber:0,phase:'passing',leader:null,currentPlayer:null,openingLeadSuit:null};
context.startFirstTrick();
let legal=context.legalCards(1);
assert(legal.length===2&&legal.every(card=>card.suit==='C'&&card.rank==='2'),'double 2C holder was not restricted to a 2C');
context.playCard(1,legal[0]);
assert(context.state.players[1].hand.filter(card=>card.suit==='C'&&card.rank==='2').length===1,'double holder did not retain exactly one 2C');
const playsAfterOne=context.state.trick.length;
context.state.currentPlayer=1;
context.playCard(1,context.state.players[1].hand[0]);
assert(context.state.trick.length===playsAfterOne,'same player was allowed to play twice in one trick');

// 3. When the two physical 2C cards are split, the other holder is forced to play theirs when reached.
context.state={players:[player([c('C','2','2c-a'),c('C','9','9c')]),player([c('D','3','d1')]),player([c('C','2','2c-b'),c('D','5','5d')]),player([c('C','7','7c')])],dealer:3,trick:[],trickNumber:0,phase:'passing',leader:null,currentPlayer:null,openingLeadSuit:null};
context.startFirstTrick();
legal=context.legalCards(0);
context.playCard(0,legal[0]);
context.state.currentPlayer=2;
legal=context.legalCards(2);
assert(legal.length===1&&legal[0].id==='2c-b','other 2C holder was not forced to play the 2C');

// Opening leader identity is frozen once per hand. Run many physically possible two-deck states.
function seeded(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)|0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
for(let seed=1;seed<=512;seed++){
  const rnd=seeded(seed);
  const players=Array.from({length:8},(_,seat)=>player([c('D','3',`d-${seed}-${seat}`),c('C','9',`c-${seed}-${seat}`)]));
  const dealer=Math.floor(rnd()*8);
  const holderA=Math.floor(rnd()*8);
  const holderB=rnd()<0.25?holderA:Math.floor(rnd()*8);
  players[holderA].hand.push(c('C','2',`2c-a-${seed}`));
  players[holderB].hand.push(c('C','2',`2c-b-${seed}`));
  const holders=new Set([holderA,holderB]);
  let expected=null;
  for(let step=1;step<=8;step++){
    const seat=(dealer+step)%8;
    if(holders.has(seat)){expected=seat;break;}
  }
  context.state={players,dealer,trick:[],trickNumber:0,phase:'passing',leader:null,currentPlayer:null,openingLeadSuit:null,openingAutoPlayers:new Set(),ruleRedealAttempts:0};
  context.startFirstTrick();
  assert(context.state.openingLeaderSeat===expected,`seed ${seed}: frozen opening leader mismatch`);
  assert(context.state.leader===expected&&context.state.currentPlayer===expected,`seed ${seed}: opening turn did not start at required 2C holder`);
  const opening=context.legalCards(expected);
  const expectedCopies=holderA===holderB?2:1;
  assert(opening.length===expectedCopies&&opening.every(card=>card.suit==='C'&&card.rank==='2'),`seed ${seed}: opening legal set was not exactly the holder's 2C card(s)`);
  const first=opening[0];
  context.playCard(expected,first);
  assert(context.state.trick.length===1,`seed ${seed}: first opening card was not accepted`);
  assert(context.state.trick[0].player===expected&&context.state.trick[0].card.suit==='C'&&context.state.trick[0].card.rank==='2',`seed ${seed}: first physical play was not required 2C`);
  assert(context.window.__cancellationHeartsRuleInvariants.openingLeader()===expected,`seed ${seed}: opening leader changed after the first 2C left the hand`);
  if(holderA===holderB)assert(players[expected].hand.filter(card=>card.suit==='C'&&card.rank==='2').length===1,`seed ${seed}: double holder did not retain one 2C`);
}

// 6. Opening trick forbids penalty cards, but allows diamonds and non-queen spades when void in clubs.
context.state={players:[player([c('C','2','lead')]),player([c('C','9','club'),c('S','8','spade'),c('H','4','heart')]),player([c('C','2','other'),c('D','7','diamond'),c('S','5','spade2'),c('S','Q','queen-spade'),c('H','6','heart2')])],dealer:2,trick:[],trickNumber:0,phase:'passing',leader:null,currentPlayer:null,openingLeadSuit:null};
context.startFirstTrick();
const openingLead=context.legalCards(context.state.leader)[0];
context.playCard(context.state.leader,openingLead);
context.state.currentPlayer=1;
legal=context.legalCards(1);
assert(legal.length===1&&legal[0].id==='club','opening follower with clubs could evade the led suit');
context.state.currentPlayer=2;
legal=context.legalCards(2);
assert(legal.length===1&&legal[0].id==='other','2C holder was not forced to play the remaining 2C');
context.state.players[2].hand=context.state.players[2].hand.filter(card=>card.id!=='other');
context.state.trick=context.state.trick.filter(play=>play.player!==2);
legal=context.legalCards(2);
assert(legal.length===2&&legal.some(card=>card.id==='diamond')&&legal.some(card=>card.id==='spade2'),'club-void opening player was not allowed diamond plus non-queen spade');
assert(legal.every(card=>context.cardPoints(card)===0),'opening legal set contains a penalty card');

// 4. Fully cancelled final trick splits unresolved points by highest-ranked cancelling pair.
finishRoundCalls=0;baseFinishCalls=0;
context.state={
  players:Array.from({length:8},(_,i)=>({name:`P${i}`,hand:[],roundPoints:0,tricks:[]})),
  dealer:0,leader:4,trickNumber:12,phase:'playing',openingLeadSuit:null,carryoverPoints:5,carryoverCards:[],currentTrickAward:null,
  trick:[
    {player:0,card:c('C','K','ck-a'),cancelled:true},
    {player:1,card:c('C','K','ck-b'),cancelled:true},
    {player:2,card:c('C','9','c9-a'),cancelled:true},
    {player:3,card:c('C','9','c9-b'),cancelled:true},
    {player:4,card:c('H','2','h2'),cancelled:false},
    {player:5,card:c('H','3','h3'),cancelled:false},
    {player:6,card:c('D','5','d5'),cancelled:false},
    {player:7,card:c('D','6','d6'),cancelled:false}
  ],mode:'standard'
};
context.finishTrick();
assert(baseFinishCalls===0,'final full cancellation fell through to old leader-award rule');
assert(context.state.currentTrickAward?.split===true,'final cancellation was not recorded as split');
assert(context.state.currentTrickAward.awards[0].player===0&&context.state.currentTrickAward.awards[1].player===1,'highest cancelling pair did not receive split');
assert(context.state.players[0].roundPoints===4&&context.state.players[1].roundPoints===3,'odd 7-point split did not conserve points as 4/3');
assert(context.state.players.reduce((sum,p)=>sum+p.roundPoints,0)===7,'final split did not conserve total points');
assert(finishRoundCalls===1,'final split did not finish the round');

// UI must state the same invariants enforced by the engine.
for(const phrase of [
  'first player clockwise from the dealer holding a 2♣ must lead exactly one 2♣',
  'Every other player holding a 2♣ must play exactly one when reached',
  'only one card to a trick',
  'may discard a diamond or a spade other than the queen of spades',
  'Hearts and queens of spades are illegal on the opening trick',
  'contains only hearts and queen(s) of spades',
  'highest-ranked canceling pair'
])assert(rulesNode.innerHTML.includes(phrase),`rules UI missing: ${phrase}`);

console.log('rule-invariants: opening authority frozen across 512 physically valid two-deck states; remaining canonical rules enforced');
