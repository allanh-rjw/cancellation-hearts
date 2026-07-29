// Client-side access gate. Change this value before publishing if desired.
// This deters casual access only; anyone who inspects the downloaded JavaScript can find it.
const APP_PASSWORD = 'G@me Night 4U';

function initializePasswordGate(){
  const gate = document.getElementById('passwordGate');
  const app = document.getElementById('app');
  const form = document.getElementById('passwordForm');
  const input = document.getElementById('appPassword');
  const error = document.getElementById('passwordError');
  const toggle = document.getElementById('togglePasswordBtn');

  const unlock = ()=>{
    sessionStorage.setItem('cancellationHeartsUnlocked','1');
    document.body.classList.remove('locked');
    gate.classList.add('hidden');
    app.setAttribute('aria-hidden','false');
  };

  if(sessionStorage.getItem('cancellationHeartsUnlocked')==='1'){ unlock(); return; }

  toggle.addEventListener('click',()=>{
    const showing=input.type==='text';
    input.type=showing?'password':'text';
    toggle.textContent=showing?'Show':'Hide';
    input.focus();
  });

  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(input.value===APP_PASSWORD){ unlock(); }
    else {
      error.textContent='Incorrect password.';
      input.select();
    }
  });
}

initializePasswordGate();

const SUITS = ['C','D','S','H'];
const SUIT_SYMBOL = {C:'♣', D:'♦', S:'♠', H:'♥'};
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK_VALUE = Object.fromEntries(RANKS.map((r,i)=>[r,i+2]));
const PERSONAS = ['The Minimalist','The Hunter','The Moonshot','The Canceller','The Suit Engineer','The Enforcer','The Opportunist'];
const FIXED_CPU_NAMES = ['Melissa','Matt','Wilson','Dane','Tony','Judy'];
const RANDOM_NAMES = ['Alex','Casey','Jordan','Morgan','Riley','Taylor','Cameron','Avery','Blake','Quinn','Reese','Parker','Skyler','Jamie'];
const PASS_CYCLE = [1,-1,2,-2,3,-3,4,0];
const PERSONA_DESCRIPTIONS = {
  'The Minimalist':'Strongly prefers avoiding personal points and surrendering control. It can target or pursue a moon, but only when the hand is unusually strong and the scoreboard clearly rewards the risk.',
  'The Hunter':'Leans toward directing points at the current game leader. It still protects itself when targeting is unreliable or would hand points to the wrong player.',
  'The Moonshot':'Investigates moon opportunities with a lower starting threshold than other players. It commits only when control, heart strength, and suit coverage are credible, and should abandon the attempt when the evidence turns against it.',
  'The Canceller':'Gives extra value to plays that exploit known duplicate locations and cancellation chains. It does not create a cancellation merely for spectacle when the next uncancelled card would produce a worse result.',
  'The Suit Engineer':'Prefers passes and plays that create useful voids and preserve exits. It avoids forcing a void when the suit is strategically dangerous, especially exposed spades.',
  'The Enforcer':'More readily sacrifices a small amount of safety to break a solo or two-player moon. Outside a credible moon threat, it plays a more ordinary defensive game.',
  'The Opportunist':'Uses the smallest persona bias. It changes plans according to hand structure, live trick information, and the scoreboard rather than requiring the game to indulge one favorite idea.'
};

const state = {
  players: [], dealer: 0, round: 1, target: 100, difficulty: 'medium',
  currentPlayer: 0, leader: 0, trick: [], trickNumber: 0, heartsBroken: false,
  phase: 'idle', selected: new Set(), passOffset: 1, gameOver: false, coachStrategy: null,
  coachWeights:{board:33,score:33,strategy:34}, actionLog:[], humanDecisionLog:[], roundStartMetrics:null, lastPostAnalysis:null, playSpeed:1, scoreHistory:[], showPersonas:false, currentTrickAward:null, audioContext:null, mode:'standard', practiceType:'solo', practiceStrength:'strong', partnerIndex:null, practiceEnded:false, carryoverPoints:0, carryoverCards:[], originalStrategy:null, strategyPivots:[], pendingPivot:null
};

const $ = id => document.getElementById(id);

$('newGameBtn').onclick = startGame;
$('startOverBtn').onclick = ()=>window.location.reload();
$('confirmPassBtn').onclick = confirmHumanPass;
$('nextTrickBtn').onclick = ()=>{ $('nextTrickBtn').classList.add('hidden'); startTrick(); };
$('nextRoundBtn').onclick = ()=>{ $('nextRoundBtn').classList.add('hidden'); beginRound(); };
$('rulesBtn').onclick = ()=>$('rulesDialog').showModal();
$('scoreBtn').onclick = ()=>{ renderScoreDialog(); $('scoreDialog').showModal(); };
$('personasBtn').onclick = ()=>{ renderPersonasDialog(); $('personasDialog').showModal(); };
$('settingsBtn').onclick = ()=>$('settingsDialog').showModal();
$('closeSettingsBtn').onclick = ()=>$('settingsDialog').close();
$('playSpeed').onchange = ()=>{ state.playSpeed=+$('playSpeed').value; };
$('showPersonas').onchange = ()=>{ state.showPersonas=$('showPersonas').checked; renderSeats(); };
$('closeScoreBtn').onclick = ()=>$('scoreDialog').close();
$('closePersonasBtn').onclick = ()=>$('personasDialog').close();
$('closeRulesBtn').onclick = ()=>$('rulesDialog').close();
$('personaMode').onchange = renderPersonaSetup;
$('gameMode').onchange = renderModeSetup;
$('coachBtn').onclick = ()=>{ $('coachPanel').classList.remove('hidden'); $('playLayout').classList.add('coach-open'); renderCoach(); };
$('closeCoachBtn').onclick = ()=>{ $('coachPanel').classList.add('hidden'); $('playLayout').classList.remove('coach-open'); };
$('refreshCoachBtn').onclick = renderCoach;
$('strategySelect').onchange = ()=>{
  if(state.mode==='practice'){ $('strategySelect').value=state.coachStrategy; return; }
  const next=$('strategySelect').value;
  if(state.phase==='playing' && state.coachStrategy && next!==state.coachStrategy){
    recordStrategyPivot(next,'Player changed strategy from the Recommended Strategy tab.');
  } else {
    state.coachStrategy=next;
    if(!state.originalStrategy || state.phase==='passing') state.originalStrategy=next;
  }
  renderStrategyOverview(); renderRejectedStrategies(); renderPassingRecommendations(); renderTrickCoach(); renderCardRecommendation();
};
document.querySelectorAll('.coach-tab').forEach(b=>b.onclick=()=>activateCoachTab(b.dataset.tab));
['boardWeight','scoreWeight','strategyWeight'].forEach(id=>$(id).oninput=updateCoachWeights);
$('resetWeightsBtn').onclick=()=>{ $('boardWeight').value=33; $('scoreWeight').value=33; $('strategyWeight').value=34; updateCoachWeights(); };

initializePersonaSetup();
renderModeSetup();

function initializePersonaSetup(){
  const seventh = randomSeventhName();
  const names = [...FIXED_CPU_NAMES, seventh];
  $('manualPersonaPanel').innerHTML = names.map((name,i)=>`<div class="manual-persona-row"><label for="persona${i}">${name}</label><select id="persona${i}">${PERSONAS.map(p=>`<option value="${p}">${p}</option>`).join('')}</select></div>`).join('');
  PERSONAS.forEach((p,i)=>{ $(`persona${i}`).value=p; });
  $('manualPersonaPanel').dataset.seventhName=seventh;
  renderPersonaSetup();
}
function renderPersonaSetup(){ $('manualPersonaPanel').classList.toggle('hidden',$('personaMode').value!=='manual'); }
function renderModeSetup(){
  const practice=$('gameMode').value==='practice';
  document.querySelectorAll('.practice-option').forEach(x=>x.classList.toggle('hidden',!practice));
  document.querySelectorAll('.standard-option').forEach(x=>x.classList.toggle('hidden',practice));
  $('newGameBtn').textContent=practice?'Start Moon Practice':'Start New Game';
}
function randomSeventhName(){ return RANDOM_NAMES[Math.floor(Math.random()*RANDOM_NAMES.length)]; }

function selectedCpuSetup(){
  const seventh = randomSeventhName();
  $('manualPersonaPanel').dataset.seventhName=seventh;
  const seventhLabel=document.querySelector('#persona6')?.previousElementSibling;
  if(seventhLabel) seventhLabel.textContent=seventh;
  const names=[...FIXED_CPU_NAMES,seventh];
  const mode=$('personaMode').value;
  let personas;
  if(mode==='manual') personas=names.map((_,i)=>$(`persona${i}`).value);
  else if(mode==='balanced') personas=shuffle([...PERSONAS]);
  else personas=names.map(()=>PERSONAS[Math.floor(Math.random()*PERSONAS.length)]);
  // Preserve each named player's assigned persona, then randomize where the seven CPUs sit.
  return shuffle(names.map((name,i)=>({name,persona:personas[i]})));
}

function startGame(){
  state.mode=$('gameMode').value;
  state.practiceType=$('practiceType').value;
  state.practiceStrength=$('practiceStrength').value;
  state.target = state.mode==='practice'?999:+$('targetScore').value;
  state.difficulty = $('difficulty').value;
  state.playSpeed = +$('playSpeed').value;
  state.players = [{name:'You', persona:'Human', score:0, roundPoints:0, hand:[], tricks:[]}];
  for(const cpu of selectedCpuSetup()) state.players.push({...cpu, score:0, roundPoints:0, hand:[], tricks:[]});
  state.partnerIndex=null;
  if(state.mode==='practice'&&state.practiceType==='two'){
    state.partnerIndex=1+Math.floor(Math.random()*7);
    state.players[state.partnerIndex].name='Partner';
  }
  state.dealer = Math.floor(Math.random()*8);
  state.round = 1;
  state.gameOver = false;
  state.practiceEnded = false;
  state.scoreHistory = [];
  $('setup').classList.add('hidden');
  $('game').classList.remove('hidden');
  $('startOverBtn').classList.remove('hidden');
  $('coachBtn').classList.remove('hidden');
  $('scoreBtn').classList.remove('hidden');
  beginRound();
}

function beginRound(){
  state.practiceEnded=false;
  state.phase = 'dealing'; state.trick = []; state.currentTrickAward=null; state.trickNumber = 0; state.carryoverPoints=0; state.carryoverCards=[]; state.heartsBroken = false; state.selected.clear(); state.coachStrategy=null; state.originalStrategy=null; state.strategyPivots=[]; state.pendingPivot=null; state.actionLog=[]; state.humanDecisionLog=[]; state.lastPostAnalysis=null;
  state.players.forEach(p=>{p.hand=[]; p.roundPoints=0; p.tricks=[];});
  if(state.mode==='practice') dealPracticeRound();
  else {
    const deck = shuffle(makeDeck());
    for(let i=0;i<104;i++) state.players[i%8].hand.push(deck[i]);
    ensureTwoClubsSeparated();
  }
  state.players.forEach(p=>sortHand(p.hand));
  state.roundStartMetrics=humanHandMetrics();
  state.passOffset = state.mode==='practice'?0:PASS_CYCLE[(state.round-1)%PASS_CYCLE.length];
  renderAll();
  renderCoach();
  updatePracticeCoachTabs();
  if(state.passOffset===0){
    $('passPanel').classList.add('hidden');
    setStatus('Hold round. No passing. A rare outbreak of restraint.');
    setTimeout(startFirstTrick, 500);
  } else {
    state.phase = 'passing';
    $('passPanel').classList.remove('hidden');
    $('passTitle').textContent = 'Choose 3 cards to pass';
    $('passHelp').textContent = `Passing ${passDescription(state.passOffset)}.`;
    $('confirmPassBtn').disabled = true;
    setStatus('Select exactly three cards to pass.');
    renderHand();
  }
}

function ensureTwoClubsSeparated(){
  const holders=[];
  state.players.forEach((p,i)=>{
    const count=p.hand.filter(c=>c.suit==='C'&&c.rank==='2').length;
    for(let n=0;n<count;n++) holders.push(i);
  });
  if(holders.length!==2 || holders[0]!==holders[1]) return;
  const source=holders[0];
  const target=(source+1+Math.floor(Math.random()*7))%8;
  const twoIndex=state.players[source].hand.findIndex((c,idx)=>c.suit==='C'&&c.rank==='2' && idx!==state.players[source].hand.findIndex(x=>x.suit==='C'&&x.rank==='2'));
  const swapIndex=state.players[target].hand.findIndex(c=>!(c.suit==='C'&&c.rank==='2'));
  if(twoIndex>=0&&swapIndex>=0){
    const two=state.players[source].hand.splice(twoIndex,1)[0];
    const swap=state.players[target].hand.splice(swapIndex,1)[0];
    state.players[source].hand.push(swap);
    state.players[target].hand.push(two);
  }
}


function takeSpecific(deck,suit,rank){
  const i=deck.findIndex(c=>c.suit===suit&&c.rank===rank);
  return i>=0?deck.splice(i,1)[0]:null;
}
function addPattern(hand,deck,pattern){
  for(const [s,r,n=1] of pattern) for(let k=0;k<n;k++){const c=takeSpecific(deck,s,r);if(c)hand.push(c);}
}
function dealPracticeRound(){
  const deck=shuffle(makeDeck());
  const human=state.players[0].hand;
  const soloPatterns={
    ridiculous:[['H','A',2],['H','K',2],['H','Q',2],['H','J',2],['H','10',1],['S','A',1],['S','K',1],['D','A',1],['C','A',1]],
    strong:[['H','A',2],['H','K',2],['H','Q',1],['H','J',1],['H','10',1],['S','A',1],['S','K',1],['S','Q',1],['D','A',1],['C','A',1],['C','K',1]],
    solid:[['H','A',1],['H','K',1],['H','Q',1],['H','J',1],['H','10',1],['H','8',1],['S','A',1],['S','K',1],['S','Q',1],['D','A',1],['D','K',1],['C','A',1],['C','7',1]],
    marginal:[['H','A',1],['H','K',1],['H','Q',1],['H','J',1],['H','9',1],['S','A',1],['S','Q',1],['D','A',1],['D','8',1],['C','K',1],['C','7',1],['C','4',1],['S','5',1]]
  };
  const twoPatterns={
    ridiculous:[['H','A',2],['H','K',2],['H','Q',1],['H','J',1],['H','10',1],['S','Q',1],['S','A',1],['C','A',1],['C','K',1],['D','A',1],['D','K',1]],
    strong:[['H','A',1],['H','K',1],['H','Q',1],['H','J',1],['H','10',1],['S','Q',1],['S','A',1],['C','A',1],['C','K',1],['D','A',1],['D','8',1],['S','6',1],['C','4',1]],
    solid:[['H','A',1],['H','K',1],['H','Q',1],['H','10',1],['H','8',1],['S','Q',1],['S','K',1],['C','A',1],['C','J',1],['D','K',1],['D','8',1],['S','5',1],['C','4',1]],
    marginal:[['H','K',1],['H','Q',1],['H','10',1],['H','8',1],['S','Q',1],['S','K',1],['C','A',1],['C','9',1],['D','J',1],['D','7',1],['S','5',1],['C','4',1],['D','3',1]]
  };
  const pattern=(state.practiceType==='solo'?soloPatterns:twoPatterns)[state.practiceStrength] || (state.practiceType==='solo'?soloPatterns.strong:twoPatterns.strong);
  addPattern(human,deck,pattern);
  while(human.length<13)human.push(deck.pop());
  if(state.practiceType==='two'&&state.partnerIndex){
    const partner=state.players[state.partnerIndex].hand;
    const weak=SUITS.filter(s=>human.filter(c=>c.suit===s&&RANK_VALUE[c.rank]>=12).length===0);
    for(const suit of weak){for(const rank of ['A','K']){const c=takeSpecific(deck,suit,rank);if(c&&partner.length<13)partner.push(c);}}
    for(const [s,r] of [['H','A'],['H','K'],['S','Q'],['D','A'],['C','A']]){const c=takeSpecific(deck,s,r);if(c&&partner.length<13)partner.push(c);}
    while(partner.length<13)partner.push(deck.pop());
  }
  let cursor=1;
  while(deck.length){
    if(cursor===state.partnerIndex&&state.practiceType==='two'){cursor=cursor%7+1;continue;}
    if(state.players[cursor].hand.length<13)state.players[cursor].hand.push(deck.pop());
    cursor=cursor%7+1;
  }
  ensureTwoClubsSeparated();
}

function makeDeck(){
  let deck=[]; let id=0;
  for(let copy=0;copy<2;copy++) for(const suit of SUITS) for(const rank of RANKS) deck.push({id:id++, suit, rank, copy});
  return deck;
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function sortHand(hand){ hand.sort((a,b)=>SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit)||RANK_VALUE[a.rank]-RANK_VALUE[b.rank]); }
function passDescription(o){ if(o===4) return 'across'; return `${Math.abs(o)} seat${Math.abs(o)>1?'s':''} ${o>0?'left':'right'}`; }

function confirmHumanPass(){
  if(state.selected.size!==3) return;
  if([...state.selected].some(id=>{const c=state.players[0].hand.find(x=>x.id===id); return c&&c.suit==='C'&&c.rank==='2';})) return;
  const passes = [];
  for(let i=0;i<8;i++) passes.push(i===0?[...state.selected].map(id=>state.players[0].hand.find(c=>c.id===id)):choosePassCards(state.players[i]));
  for(let i=0;i<8;i++) for(const c of passes[i]) state.players[i].hand.splice(state.players[i].hand.findIndex(x=>x.id===c.id),1);
  for(let i=0;i<8;i++) state.players[(i+state.passOffset+8)%8].hand.push(...passes[i]);
  state.players.forEach(p=>sortHand(p.hand));
  state.selected.clear();
  $('passPanel').classList.add('hidden');
  renderAll();
  renderCoach();
  startFirstTrick();
}

function choosePassCards(player){
  const suitCounts=Object.fromEntries(SUITS.map(s=>[s,player.hand.filter(c=>c.suit===s).length]));
  const prof=difficultyProfile();
  const candidates=[...player.hand].filter(c=>!(c.suit==='C'&&c.rank==='2'));
  if(prof.lookahead<2) return candidates.sort((a,b)=>passScore(b,player.persona,suitCounts,player)-passScore(a,player.persona,suitCounts,player)).slice(0,3);
  // Hard/Expert evaluate complete three-card packages so the pass creates a coherent hand.
  let best=null;
  for(let a=0;a<candidates.length-2;a++)for(let b=a+1;b<candidates.length-1;b++)for(let d=b+1;d<candidates.length;d++){
    const set=[candidates[a],candidates[b],candidates[d]];
    const remain=player.hand.filter(x=>!set.some(y=>y.id===x.id));
    const counts=Object.fromEntries(SUITS.map(s=>[s,remain.filter(c=>c.suit===s).length]));
    const voids=SUITS.filter(s=>counts[s]===0).length;
    const exits=remain.filter(c=>RANK_VALUE[c.rank]<=6&&c.suit!=='H').length;
    const exposedSpades=remain.filter(c=>c.suit==='S'&&['Q','K','A'].includes(c.rank)).length;
    const lowSpades=remain.filter(c=>c.suit==='S'&&RANK_VALUE[c.rank]<=10).length;
    let score=set.reduce((sum,c)=>sum+passScore(c,player.persona,suitCounts,player),0)+voids*15+Math.min(exits,3)*3;
    if(exposedSpades&&lowSpades<2) score+=18*exposedSpades;
    if(counts.S===0) score-=8; // incoming pass can rebuild spades dangerously
    if(player.persona==='The Moonshot') score-=remain.filter(c=>RANK_VALUE[c.rank]>=11).length*2;
    if(!best||score>best.score) best={set,score};
  }
  return best?.set||candidates.slice(0,3);
}
function passScore(c,p,suitCounts,player){
  let s=RANK_VALUE[c.rank];
  const moonPotential = suitCounts.H>=5 && ['A','K','Q','J','10'].includes(c.rank);
  if(c.suit==='S'&&c.rank==='Q') s+=35;
  if(c.suit==='S'&&['A','K'].includes(c.rank)&&suitCounts.S<=3) s+=18;
  if(c.suit==='H') s+=18;
  if(p==='The Moonshot' && moonPotential) s-=12;
  if(p==='The Minimalist'){
    if(['A','K'].includes(c.rank)) s+=12;
    if(moonPotential) s+=6;
  }
  if(p==='The Hunter' && RANK_VALUE[c.rank]>=12 && c.suit!=='H') s-=3;
  if(p==='The Canceller' && player&&player.hand.filter(x=>x.suit===c.suit&&x.rank===c.rank).length===2) s+=7;
  if(p==='The Suit Engineer') s += suitCounts[c.suit]<=3 ? 16-suitCounts[c.suit]*3 : 0;
  if(p==='The Enforcer' && c.suit==='H' && RANK_VALUE[c.rank]<7) s-=8;
  return s+Math.random()*difficultyProfile().noise;
}

function startFirstTrick(){
  state.phase='playing';
  state.trickNumber=0;
  // The opening leader is the first 2♣ holder clockwise to the left of the dealer.
  let openingLeader=null;
  for(let step=1;step<=8;step++){
    const i=(state.dealer+step)%8;
    if(state.players[i].hand.some(c=>c.suit==='C'&&c.rank==='2')){ openingLeader=i; break; }
  }
  state.leader=openingLeader??((state.dealer+1)%8);
  state.currentPlayer=state.leader;
  startTrick();
}
function startTrick(){ state.trick=[]; state.currentTrickAward=null; state.phase='playing'; state.currentPlayer=state.leader; renderAll(); continueTurn(); }
function continueTurn(){
  renderAll();
  if(state.currentPlayer===0){ setStatus('Your turn. Choose a legal card.'); renderHand(); renderTrickCoach(); return; }
  setStatus(`${state.players[state.currentPlayer].name} is thinking…`);
  setTimeout(()=>playCard(state.currentPlayer,chooseAiCard(state.currentPlayer)),Math.round(6000/state.playSpeed));
}

function legalCards(playerIndex){
  const hand=state.players[playerIndex].hand;
  if(state.trickNumber===0){ const twoClubs=hand.filter(c=>c.suit==='C'&&c.rank==='2'); if(twoClubs.length) return twoClubs; }
  if(state.trick.length===0){
    let legal=hand;
    if(!state.heartsBroken){ const nonHearts=hand.filter(c=>c.suit!=='H'); if(nonHearts.length) legal=nonHearts; }
    if(state.trickNumber===0) legal=legal.filter(c=>c.suit!=='H' && !(c.suit==='S'&&c.rank==='Q'));
    return legal.length?legal:hand;
  }
  const led=state.trick[0].card.suit;
  const follow=hand.filter(c=>c.suit===led);
  let legal=follow.length?follow:hand;
  if(state.trickNumber===0){ const safe=legal.filter(c=>c.suit!=='H' && !(c.suit==='S'&&c.rank==='Q')); if(safe.length) legal=safe; }
  return legal;
}

function playCard(playerIndex,card){
  const legalNow=legalCards(playerIndex);
  if(!legalNow.some(c=>c.id===card.id)) return;
  const before={trick:state.trick.map(x=>({player:x.player,card:{...x.card},cancelled:x.cancelled})), roundPoints:state.players.map(p=>p.roundPoints), scores:state.players.map(p=>p.score)};
  if(playerIndex===0){ const rec=rankHumanLegalCards(legalNow)[0]; state.humanDecisionLog.push({trick:state.trickNumber+1,played:cardLabel(card),recommended:rec?cardLabel(rec.card):null,matched:!!rec&&rec.card.id===card.id,strategy:state.coachStrategy,reason:rec?.reason||''}); }
  state.actionLog.push({player:playerIndex,card:{...card},trick:state.trickNumber+1,position:state.trick.length,before});
  playCardSound();
  const p=state.players[playerIndex];
  p.hand.splice(p.hand.findIndex(c=>c.id===card.id),1);
  if(card.suit==='H' && state.trick.length>0) state.heartsBroken=true;
  state.trick.push({player:playerIndex,card,cancelled:false});
  updateCancellation();
  state.currentPlayer=(state.currentPlayer+1)%8;
  if(state.trick.length===8) finishTrick(); else continueTurn();
}
function updateCancellation(){
  state.trick.forEach(x=>x.cancelled=false);
  const groups={};
  state.trick.forEach(x=>(groups[x.card.suit+x.card.rank]??=[]).push(x));
  Object.values(groups).forEach(g=>{if(g.length===2)g.forEach(x=>x.cancelled=true);});
}
function finishTrick(){
  const led=state.trick[0].card.suit;
  const eligible=state.trick.filter(x=>x.card.suit===led&&!x.cancelled);
  const trickPoints=state.trick.reduce((sum,x)=>sum+cardPoints(x.card),0);

  // If every card in the led suit cancelled, there is no winner. Keep the
  // same leader and roll every penalty point into the next trick.
  if(!eligible.length){
    state.carryoverPoints+=trickPoints;
    state.carryoverCards.push(...state.trick.map(x=>x.card));
    state.currentTrickAward={winner:null,points:0,carryover:state.carryoverPoints};
    renderTrickCoach();
    state.trickNumber++; state.phase='trick-end';
    setStatus(`The led suit cancelled completely. ${state.carryoverPoints} point${state.carryoverPoints===1?'':'s'} will carry into the next trick; ${state.players[state.leader].name} leads again.`);
    renderAll();
    if(state.trickNumber===13) setTimeout(finishRound,350); else $('nextTrickBtn').classList.remove('hidden');
    return;
  }

  const winnerItem=eligible.reduce((a,b)=>RANK_VALUE[a.card.rank]>RANK_VALUE[b.card.rank]?a:b);
  const winner=winnerItem.player;
  const points=trickPoints+state.carryoverPoints;
  const carried=state.carryoverPoints;
  state.currentTrickAward={winner,points,carried};
  state.players[winner].roundPoints+=points;
  state.players[winner].tricks.push(...state.carryoverCards,...state.trick.map(x=>x.card));
  state.carryoverPoints=0; state.carryoverCards=[];
  renderTrickCoach();
  state.leader=winner; state.trickNumber++; state.phase='trick-end';
  setStatus(`${state.players[winner].name} wins the trick${carried?` and collects ${carried} carried point${carried===1?'':'s'}`:''}.`);
  renderAll();
  if(state.mode==='practice' && practiceShootBroken(winner,points)){
    endBrokenPractice(winner,points);
    return;
  }
  if(state.trickNumber===13) setTimeout(finishRound,350); else $('nextTrickBtn').classList.remove('hidden');
}
function practiceShootBroken(winner,points){
  if(state.mode!=='practice'||points<=0) return false;
  return !practiceShooters().has(winner);
}
function endBrokenPractice(winner,points){
  state.practiceEnded=true; state.gameOver=true; state.phase='practice-end';
  $('nextTrickBtn').classList.add('hidden'); $('nextRoundBtn').classList.add('hidden');
  const breaker=state.players[winner].name;
  const target=state.practiceType==='solo'?'solo moon':'two-player moon';
  const detail=points===1?'1 penalty point':`${points} penalty points`;
  setStatus(`${breaker} captured ${detail}. The ${target} has been broken, so this practice hand is over.`);
  state.lastPostAnalysis=buildPostGameAnalysis(`Practice ended when ${breaker} broke the ${target}.`);
  renderPostGameAnalysis(); renderOpponentAnalysis(); renderAll();
}
function cardPoints(c){ return c.suit==='H'?1:(c.suit==='S'&&c.rank==='Q'?13:0); }

function finishRound(){
  const scorers=state.players.map((p,i)=>({i,pts:p.roundPoints})).filter(x=>x.pts>0);
  let msg='';
  if(scorers.length===1 && scorers[0].pts===52){
    state.players.forEach((p,i)=>{ if(i!==scorers[0].i) p.score+=104; });
    msg=`${state.players[scorers[0].i].name} shoots the moon. Everyone else receives 104.`;
  } else if(scorers.length===2 && scorers.reduce((s,x)=>s+x.pts,0)===52){
    const ids=new Set(scorers.map(x=>x.i)); state.players.forEach((p,i)=>{ if(!ids.has(i)) p.score+=26; });
    msg=`${state.players[scorers[0].i].name} and ${state.players[scorers[1].i].name} shoot the moon together. Everyone else receives 26.`;
  } else { state.players.forEach(p=>p.score+=p.roundPoints); msg='Round complete. Points added normally.'; }
  const handScores=state.players.map(p=>p.score-(state.scoreHistory.reduce((sum,h)=>sum+(h[p.name]||0),0)));
  const handRecord={}; state.players.forEach((p,i)=>handRecord[p.name]=handScores[i]); state.scoreHistory.push(handRecord);
  state.lastPostAnalysis=buildPostGameAnalysis(msg); renderPostGameAnalysis(); renderOpponentAnalysis(); renderScoreDialog();
  if(!$('scoreDialog').open) $('scoreDialog').showModal();
  renderAll();
  if(Math.max(...state.players.map(p=>p.score))>=state.target){
    const low=Math.min(...state.players.map(p=>p.score));
    const winners=state.players.filter(p=>p.score===low).map(p=>p.name).join(' and ');
    state.gameOver=true; setStatus(`${msg} Game over. ${winners} ${winners.includes(' and ')?'win':'wins'} with ${low} points.`);
  } else { setStatus(msg); state.round++; state.dealer=(state.dealer+1)%8; $('nextRoundBtn').classList.remove('hidden'); }
}

function difficultyProfile(){
  return {
    easy:{memory:2,lookahead:0,noise:10,blunder:.30,moonThreshold:16,defense:.72},
    medium:{memory:6,lookahead:1,noise:4,blunder:.12,moonThreshold:9,defense:1.15},
    hard:{memory:13,lookahead:3,noise:1.1,blunder:.025,moonThreshold:4,defense:1.65},
    expert:{memory:13,lookahead:5,noise:.18,blunder:0,moonThreshold:2,defense:2.15}
  }[state.difficulty]||{memory:6,lookahead:1,noise:4,blunder:.12,moonThreshold:9,defense:1.15};
}
function playedCards(){ return state.actionLog.map(x=>x.card); }
function copiesSeen(card){ return playedCards().filter(c=>c.suit===card.suit&&c.rank===card.rank).length; }
function duplicateLiveFor(card,i){
  const own=state.players[i].hand.filter(c=>c.suit===card.suit&&c.rank===card.rank).length;
  return copiesSeen(card)+own<2;
}
function inferredVoids(playerIndex){
  const out=new Set();
  for(const a of state.actionLog){
    if(a.player!==playerIndex||!a.before?.trick?.length) continue;
    const led=a.before.trick[0].card.suit;
    if(a.card.suit!==led) out.add(led);
  }
  return out;
}
function remainingSuitEstimate(playerIndex,suit){
  const knownPlayed=playedCards().filter(c=>c.suit===suit).length;
  const own=state.players[playerIndex].hand.filter(c=>c.suit===suit).length;
  return Math.max(0,26-knownPlayed-own);
}
function futureHandScore(i,c){
  const prof=difficultyProfile(); if(!prof.lookahead) return 0;
  const hand=state.players[i].hand.filter(x=>x.id!==c.id);
  const suitCards=hand.filter(x=>x.suit===c.suit);
  const lows=suitCards.filter(x=>RANK_VALUE[x.rank]<=7).length;
  const highs=suitCards.filter(x=>RANK_VALUE[x.rank]>=10).length;
  const exits=hand.filter(x=>RANK_VALUE[x.rank]<=6 && x.suit!=='H').length;
  const voidCreated=suitCards.length===0;
  const seenHigher=playedCards().filter(x=>x.suit===c.suit&&RANK_VALUE[x.rank]>RANK_VALUE[c.rank]).length;
  const totalHigher=(14-RANK_VALUE[c.rank])*2;
  const likelyFutureWinner=Math.max(0,totalHigher-seenHigher)<=2;
  let s=0;
  // Shed the highest card that is still likely to lose, preserving lower exits.
  if(!wouldCurrentlyWin(c)) s+=(RANK_VALUE[c.rank]-2)*1.15*prof.lookahead;
  if(!wouldCurrentlyWin(c)&&RANK_VALUE[c.rank]<=5) s-=4.2*prof.lookahead;
  if(voidCreated&&c.suit!=='S') s+=7*prof.lookahead;
  if(voidCreated&&c.suit==='S'){
    const incomingRisk=state.phase==='passing'?8:0;
    const dangerous=hand.some(x=>x.suit==='S'&&['Q','K','A'].includes(x.rank));
    s+=dangerous?-9:4-incomingRisk;
  }
  if(highs>0&&lows===0) s-=6*prof.lookahead; // leaves a suit of forced winners
  if(likelyFutureWinner&&RANK_VALUE[c.rank]>=9) s+=5*prof.lookahead; // unload before it matures
  if(exits<=1&&RANK_VALUE[c.rank]<=6&&!wouldCurrentlyWin(c)) s-=6*prof.lookahead;
  if(duplicateLiveFor(c,i)&&RANK_VALUE[c.rank]>=10) s-=1.5*prof.lookahead; // less reliable control
  if(!duplicateLiveFor(c,i)&&RANK_VALUE[c.rank]>=10&&!wouldCurrentlyWin(c)) s+=3*prof.lookahead;
  return s;
}
function scoreAwareAdjustment(i,c){
  const prof=difficultyProfile(); if(prof.lookahead<1) return 0;
  const projected=currentWinningPlayerIfPlayed(c,i);
  const pts=state.carryoverPoints+state.trick.reduce((a,x)=>a+cardPoints(x.card),0)+cardPoints(c);
  const lowest=Math.min(...state.players.map(p=>p.score));
  const leaders=state.players.map((p,idx)=>({idx,score:p.score})).filter(x=>x.score===lowest).map(x=>x.idx);
  let s=0;
  if(pts>0&&leaders.includes(projected)&&projected!==i) s+=8+pts*1.7;
  if(pts>0&&projected===i) s-=pts*2.2;
  const projectedTotal=state.players[projected]?.score+(state.players[projected]?.roundPoints||0)+pts;
  if(projected!==i&&projectedTotal>=state.target){
    const myTotal=state.players[i].score+state.players[i].roundPoints;
    const minOther=Math.min(...state.players.filter((_,idx)=>idx!==projected).map(p=>p.score+p.roundPoints));
    s+=myTotal<=minOther?18:-12;
  }
  return s*min(1.5,prof.lookahead/3);
}
function min(a,b){return Math.min(a,b);}
function chooseAiCard(i){
  const legal=legalCards(i), p=state.players[i], prof=difficultyProfile();
  const ranked=legal.map(c=>({c,s:evaluateCard(i,c,p.persona)+practiceDefenseAdjustment(i,c)+futureHandScore(i,c)+scoreAwareAdjustment(i,c)+advancedInferenceAdjustment(i,c)})).sort((a,b)=>b.s-a.s);
  const threat=practiceThreatState();
  if(state.difficulty==='easy' && !threat.credible) return legal[Math.floor(Math.random()*legal.length)];
  if(prof.blunder&&Math.random()<prof.blunder) return ranked[Math.min(1,ranked.length-1)].c;
  // Only randomize among genuinely close plays; Expert is almost deterministic.
  if(ranked.length>1 && ranked[0].s-ranked[1].s<prof.noise && Math.random()<.22) return ranked[1].c;
  return ranked[0].c;
}
function advancedInferenceAdjustment(i,c){
  const prof=difficultyProfile(); if(prof.lookahead<2) return 0;
  let s=0;
  const projected=currentWinningPlayerIfPlayed(c,i);
  const led=state.trick[0]?.card.suit;
  const projectedVoids=inferredVoids(projected);
  if(led&&projectedVoids.has(led)) s-=2; // suspicious projection, cancellation volatility
  if(state.trick.length===0){
    // Lead suits that pressure players known void only when that helps the scoreboard or moon defense.
    const voidPlayers=state.players.map((_,idx)=>idx).filter(idx=>idx!==i&&inferredVoids(idx).has(c.suit));
    const threat=practiceThreatState();
    if(voidPlayers.length){
      if(threat.credible&&voidPlayers.some(idx=>!threat.shooters.has(idx))) s+=8*prof.lookahead;
      else s-=2.5*voidPlayers.length;
    }
    if(remainingSuitEstimate(i,c.suit)>12&&state.players[i].hand.filter(x=>x.suit===c.suit).length>=4) s+=3*prof.lookahead;
  }
  // Exact endgame: value cards whose duplicate and all higher cards are accounted for.
  if(state.trickNumber>=9){
    const higherUnseen=[];
    for(const r of RANKS.filter(r=>RANK_VALUE[r]>RANK_VALUE[c.rank])){
      const seen=playedCards().filter(x=>x.suit===c.suit&&x.rank===r).length;
      const own=state.players[i].hand.filter(x=>x.suit===c.suit&&x.rank===r).length;
      if(seen+own<2) higherUnseen.push(r);
    }
    if(!higherUnseen.length) s+=wouldCurrentlyWin(c)?5:-3;
  }
  return s;
}

function practiceShooters(){
  if(state.mode!=='practice') return new Set();
  return state.practiceType==='two' ? new Set([0,state.partnerIndex]) : new Set([0]);
}
function practiceThreatState(){
  if(state.mode!=='practice') return {credible:false,points:0,outsiderPoints:0,shooters:new Set()};
  const shooters=practiceShooters();
  const points=state.players.reduce((sum,p,i)=>sum+(shooters.has(i)?p.roundPoints:0),0);
  const outsiderPoints=state.players.reduce((sum,p,i)=>sum+(!shooters.has(i)?p.roundPoints:0),0);
  const queenCaptured=[...shooters].some(i=>state.players[i]?.tricks?.some(c=>c.suit==='S'&&c.rank==='Q'));
  const threshold=difficultyProfile().moonThreshold;
  return {credible:outsiderPoints===0&&(points>=threshold||queenCaptured),points,outsiderPoints,shooters};
}
function practiceDefenseAdjustment(i,c){
  if(state.mode!=='practice') return 0;
  const threat=practiceThreatState();
  const shooters=threat.shooters;
  const isShooter=shooters.has(i);
  const projected=currentWinningPlayerIfPlayed(c,i);
  const existingPts=state.trick.reduce((sum,x)=>sum+cardPoints(x.card),0);
  const loadedPts=existingPts+cardPoints(c);
  const duplicate=state.trick.some(x=>x.card.suit===c.suit&&x.card.rank===c.rank);
  const aggression=difficultyProfile().defense;

  // In two-player practice, Partner actively helps keep all penalty cards inside the pair.
  if(isShooter){
    if(state.practiceType==='two'&&i===state.partnerIndex){
      let s=0;
      if(loadedPts>0 && shooters.has(projected)) s+=22*aggression;
      if(loadedPts>0 && !shooters.has(projected)) s-=34*aggression;
      if(cardPoints(c)>0 && shooters.has(projected)) s+=16*aggression;
      if(projected===i && loadedPts>0) s+=12*aggression;
      return s;
    }
    return 0;
  }

  // Before a credible threat, defenders play normally. Hard defenders begin reading the pattern earlier.
  if(!threat.credible) return 0;
  let s=0;
  if(loadedPts>0){
    // The cleanest break is for any non-shooter to win a penalty-bearing trick.
    if(!shooters.has(projected)) s+=48*aggression;
    else s-=42*aggression;
    if(projected===i) s+=22*aggression;
    // Feed a heart or queen only when the projected winner is outside the shooting group.
    if(cardPoints(c)>0 && !shooters.has(projected)) s+=26*aggression;
    if(cardPoints(c)>0 && shooters.has(projected)) s-=24*aggression;
  } else {
    // On point-free tricks, seek control that can be used to lead a disruptive suit next.
    if(projected===i) s+=8*aggression;
    if(duplicate && projected!==i) s-=5*aggression;
    if(state.trick.length===0 && c.suit==='H') s+=14*aggression;
  }
  return s;
}
function evaluateCard(i,c,persona){
  const trickPts=state.trick.reduce((sum,x)=>sum+cardPoints(x.card),0);
  const wins=wouldCurrentlyWin(c), player=state.players[i];
  const leaderIndex=state.players.map(p=>p.score).indexOf(Math.min(...state.players.map(p=>p.score)));
  const projectedWinner=currentWinningPlayerIfPlayed(c,i);
  const collectors=state.players.map((p,idx)=>({idx,pts:p.roundPoints})).filter(x=>x.pts>0);
  const duplicateAlready=state.trick.some(x=>x.card.suit===c.suit&&x.card.rank===c.rank);
  const suitCount=player.hand.filter(x=>x.suit===c.suit).length;
  const handHigh=player.hand.filter(x=>RANK_VALUE[x.rank]>=11).length;
  const highHearts=player.hand.filter(x=>x.suit==='H'&&RANK_VALUE[x.rank]>=10).length;
  const suitControl=SUITS.filter(s=>player.hand.some(x=>x.suit===s&&RANK_VALUE[x.rank]>=13)).length;
  const moonReadiness=handHigh+highHearts*1.5+suitControl*1.5;
  const moonThreshold=persona==='The Moonshot'?10:persona==='The Opportunist'?12:persona==='The Minimalist'?16:13;
  const credibleMoon=moonReadiness>=moonThreshold && collectors.length<=1;
  const moonThreat=collectors.length<=2&&collectors.reduce((a,b)=>a+b.pts,0)>=18;

  // Common rational baseline: avoid winning loaded tricks, dump liability when safely void, and value low cards.
  let s=(wins?-(8+trickPts*3):10)+cardPoints(c)*6+(RANK_VALUE[c.rank]<=6?3:0);

  if(persona==='The Minimalist'){
    s += wins?-(10+trickPts*2):5;
    if(credibleMoon) s += wins?10:-4; // exceptional hands can still pull it outside its comfort zone
  }
  if(persona==='The Hunter'){
    if(projectedWinner===leaderIndex) s+=12+trickPts*3;
    if(projectedWinner!==leaderIndex&&trickPts>0) s-=5;
  }
  if(persona==='The Moonshot'){
    if(credibleMoon) s += wins?24+trickPts*4:-10;
    else s += wins?-3:3;
  }
  if(persona==='The Canceller'){
    if(duplicateAlready){
      const simulatedWinner=projectedWinner;
      s += simulatedWinner!==i?16:4;
    }
  }
  if(persona==='The Suit Engineer'){
    if(suitCount<=2) s+=8;
    if(c.suit==='S'&&suitCount<=2&&player.hand.some(x=>x.suit==='S'&&['Q','K','A'].includes(x.rank))) s-=8;
  }
  if(persona==='The Enforcer'){
    if(moonThreat && !collectors.some(x=>x.idx===projectedWinner)) s+=18;
  }
  if(persona==='The Opportunist'){
    if(projectedWinner===leaderIndex&&trickPts>0) s+=8;
    if(duplicateAlready&&projectedWinner!==i) s+=7;
    if(credibleMoon) s+=wins?8:-3;
  }
  return s+Math.random()*difficultyProfile().noise;
}
function wouldCurrentlyWin(card){
  if(state.trick.length===0) return true;
  const fake=[...state.trick,{player:-1,card,cancelled:false}]; resolveFakeCancellation(fake);
  const eligible=fake.filter(x=>x.card.suit===fake[0].card.suit&&!x.cancelled);
  return eligible.length>0&&eligible.reduce((a,b)=>RANK_VALUE[a.card.rank]>RANK_VALUE[b.card.rank]?a:b).player===-1;
}
function currentWinningPlayerIfPlayed(card,i){
  if(state.trick.length===0) return i;
  const fake=[...state.trick,{player:i,card,cancelled:false}]; resolveFakeCancellation(fake);
  const eligible=fake.filter(x=>x.card.suit===fake[0].card.suit&&!x.cancelled);
  return eligible.length?eligible.reduce((a,b)=>RANK_VALUE[a.card.rank]>RANK_VALUE[b.card.rank]?a:b).player:fake[0].player;
}
function resolveFakeCancellation(cards){
  const groups={}; cards.forEach(x=>(groups[x.card.suit+x.card.rank]??=[]).push(x));
  Object.values(groups).forEach(g=>{if(g.length===2)g.forEach(x=>x.cancelled=true);});
}

function renderAll(){
  $('roundLabel').textContent=`Round ${state.round}`;
  $('passLabel').textContent=state.passOffset===0?' • Hold':` • Pass ${passDescription(state.passOffset)}`;
  $('dealerLabel').textContent=state.players[state.dealer]?.name||'';
  renderSeats(); renderTrick(); renderHand();
}
function renderScores(){}
function renderSeats(){
  if(!state.players.length) return;
  $('seatMap').innerHTML=state.players.map((p,i)=>{
    const badges=[];
    if(i===state.dealer) badges.push('<span class="badge">Dealer</span>');
    if(i===state.leader && state.phase!=='passing') badges.push('<span class="badge">Leads</span>');
    if(i===state.currentPlayer && state.phase==='playing') badges.push('<span class="badge">Turn</span>');
    const played=state.trick.find(x=>x.player===i);
    const trickScore=currentTrickScoreFor(i);
    const handScore=handScoreBeforeCurrentTrick(i);
    const personaLine=i>0&&state.showPersonas?`<div class="meta persona-seat">${p.persona}</div>`:'';
    return `<div class="seat seat-${i} ${i===0?'human':''} ${state.currentPlayer===i&&state.phase==='playing'?'active':''}"><div class="seat-top"><strong>${p.name}</strong><span class="seat-number">SEAT ${i+1}</span></div>${personaLine}<div class="seat-scores"><span><b>Trick</b> ${trickScore}</span><span><b>Hand</b> ${handScore}</span></div><div class="meta">${p.hand.length} cards</div><div class="badges">${badges.join('')}</div>${played?`<div class="seat-played-card">${cardHtml(played.card,played.cancelled?'cancelled':'')}</div>`:''}</div>`;
  }).join('');
}
function currentTrickStatus(){
  if(!state.trick.length) return {winner:null,points:state.carryoverPoints};
  if(state.phase==='trick-end'&&state.currentTrickAward) return state.currentTrickAward;
  const led=state.trick[0].card.suit;
  const eligible=state.trick.filter(x=>x.card.suit===led&&!x.cancelled);
  if(!eligible.length) return {winner:null,points:state.carryoverPoints+state.trick.reduce((sum,x)=>sum+cardPoints(x.card),0)};
  const winnerItem=eligible.reduce((a,b)=>RANK_VALUE[a.card.rank]>RANK_VALUE[b.card.rank]?a:b);
  return {winner:winnerItem.player,points:state.carryoverPoints+state.trick.reduce((sum,x)=>sum+cardPoints(x.card),0)};
}
function currentTrickScoreFor(i){const t=currentTrickStatus();return t.winner===i?t.points:0;}
function handScoreBeforeCurrentTrick(i){
  const awarded=state.phase==='trick-end'&&state.currentTrickAward?.winner===i?state.currentTrickAward.points:0;
  return state.players[i].roundPoints-awarded;
}
function playCardSound(){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx)return;
    const ctx=state.audioContext||(state.audioContext=new AudioCtx());
    if(ctx.state==='suspended')ctx.resume();
    const now=ctx.currentTime;
    const noise=ctx.createBufferSource();
    const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.055),ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3);
    noise.buffer=buffer;
    const filter=ctx.createBiquadFilter();filter.type='bandpass';filter.frequency.value=850;filter.Q.value=.7;
    const gain=ctx.createGain();gain.gain.setValueAtTime(.13,now);gain.gain.exponentialRampToValueAtTime(.001,now+.055);
    noise.connect(filter).connect(gain).connect(ctx.destination);noise.start(now);noise.stop(now+.06);
  }catch(e){}
}
function renderTrick(){ const carry=state.carryoverPoints?` · ${state.carryoverPoints} carried point${state.carryoverPoints===1?'':'s'} at stake`:''; $('trick').innerHTML=(state.trick.length||state.carryoverPoints)?`<div class="trick-summary">${state.trick.length} of 8 cards played${carry}</div>`:''; }
function renderHand(){
  if(!state.players.length) return;
  const legalIds=new Set(state.phase==='playing'&&state.currentPlayer===0?legalCards(0).map(c=>c.id):[]);
  $('humanHand').innerHTML='';
  for(const c of state.players[0].hand){
    const selected=state.selected.has(c.id);
    let cls=state.phase==='passing'?(selected?'selected':'playable'):(state.phase==='playing'&&state.currentPlayer===0?(legalIds.has(c.id)?'playable':'disabled'):'disabled');
    const wrap=document.createElement('div'); wrap.innerHTML=cardHtml(c,cls); const node=wrap.firstElementChild;
    node.onclick=()=>{
      if(state.phase==='passing'){
        if(c.suit==='C'&&c.rank==='2'){ setStatus('The 2♣ cannot be passed; both copies must be played in the opening trick.'); return; }
        if(state.selected.has(c.id)) state.selected.delete(c.id); else if(state.selected.size<3) state.selected.add(c.id);
        $('confirmPassBtn').disabled=state.selected.size!==3; renderHand();
      } else if(state.phase==='playing'&&state.currentPlayer===0&&legalIds.has(c.id)) playCard(0,c);
    };
    $('humanHand').appendChild(node);
  }
  $('selectionCount').textContent=state.phase==='passing'?`${state.selected.size}/3 selected`:'';
}
function cardHtml(c,extra=''){ const red=c.suit==='H'||c.suit==='D'; return `<div class="card ${red?'red':''} ${extra}" data-id="${c.id}"><div class="rank">${c.rank}${SUIT_SYMBOL[c.suit]}</div><div class="suit">${SUIT_SYMBOL[c.suit]}</div><div class="rank">${c.rank}${SUIT_SYMBOL[c.suit]}</div></div>`; }
function setStatus(t){ $('status').textContent=t; }


const STRATEGY_LABELS={avoidance:'Avoidance',targeting:'Targeting',cancellation:'Cancellation-oriented',soloMoon:'Solo moon',twoMoon:'Two-player moon'};
function suitName(s){return {C:'clubs',D:'diamonds',S:'spades',H:'hearts'}[s];}
function humanHandMetrics(){
  const hand=state.players[0]?.hand||[];
  const counts=Object.fromEntries(SUITS.map(s=>[s,hand.filter(c=>c.suit===s).length]));
  const highs=hand.filter(c=>RANK_VALUE[c.rank]>=11);
  const queens=hand.filter(c=>c.suit==='S'&&c.rank==='Q');
  const highSpades=hand.filter(c=>c.suit==='S'&&['A','K','Q'].includes(c.rank));
  const lowSpades=hand.filter(c=>c.suit==='S'&&RANK_VALUE[c.rank]<12);
  const hearts=hand.filter(c=>c.suit==='H');
  const lowCards=hand.filter(c=>RANK_VALUE[c.rank]<=6);
  const pairs=[];
  for(const s of SUITS) for(const r of RANKS) if(hand.filter(c=>c.suit===s&&c.rank===r).length===2) pairs.push(r+SUIT_SYMBOL[s]);
  const provisionalVoid=[...SUITS].sort((a,b)=>counts[a]-counts[b])[0];
  const exits=hand.filter(c=>RANK_VALUE[c.rank]<=6 && !(c.suit==='H'&&RANK_VALUE[c.rank]>4));
  const control=highs.length + Math.max(0,hearts.filter(c=>RANK_VALUE[c.rank]>=10).length-1);
  const metrics={hand,counts,highs,queens,highSpades,lowSpades,hearts,lowCards,pairs,voidCandidate:provisionalVoid,exits,control}; metrics.voidCandidate=bestVoidCandidate(metrics); return metrics;
}
function spadeVulnerability(m){
  const count=m.counts.S, queens=m.queens.length;
  const ak=m.hand.filter(c=>c.suit==='S'&&['A','K'].includes(c.rank));
  const low=m.hand.filter(c=>c.suit==='S'&&RANK_VALUE[c.rank]<=10);
  const pairedHigh=m.pairs.filter(x=>x.endsWith('♠')&&['A','K','Q'].includes(x[0]));
  let level='low', reasons=[];
  if(queens===2){level='severe';reasons.push('both queens are in your hand, so neither can cancel against an opponent');}
  else if(queens===1&&low.length<=1){level='severe';reasons.push(`${cardLabel(m.queens[0])} has only ${low.length} low spade${low.length===1?'':'s'} beneath it`);}
  else if(ak.length>=2&&low.length<=1){level='severe';reasons.push(`${ak.map(cardLabel).join(' and ')} are exposed to capturing either queen`);}
  else if(queens||ak.length){level='moderate';reasons.push(`${[...m.queens,...ak].map(cardLabel).join(', ')} remain relevant liabilities even with some lower-card cover`);}
  if(pairedHigh.length){level=level==='low'?'moderate':level;reasons.push(`${pairedHigh.join(', ')} cannot receive external cancellation help`);}
  if(!reasons.length) reasons.push(`you hold no queen and no exposed A♠ or K♠`);
  return {level,reasons,count,lowCount:low.length};
}
function bestVoidCandidate(m){
  const sv=spadeVulnerability(m);
  const ordered=[...SUITS].sort((a,b)=>m.counts[a]-m.counts[b]);
  for(const suit of ordered){
    if(suit!=='S') return suit;
    const incomingPassRisk=state.phase==='passing'&&state.passOffset!==0;
    if(sv.level==='low' && (!incomingPassRisk || m.counts.S===0)) return 'S';
  }
  return ordered[0];
}
function recommendedStrategy(m){
  const strongHearts=m.hearts.length>=5&&m.hearts.filter(c=>RANK_VALUE[c.rank]>=10).length>=3;
  const broadControl=SUITS.filter(s=>m.hand.some(c=>c.suit===s&&RANK_VALUE[c.rank]>=13)).length;
  if(m.control>=8&&strongHearts&&broadControl>=3) return 'soloMoon';
  if(m.control>=6&&m.hearts.length>=4) return 'twoMoon';
  if(m.pairs.length>=3) return 'cancellation';
  const scoreLead=state.players.length&&state.players[0].score===Math.min(...state.players.map(p=>p.score));
  if(!scoreLead&&m.control>=4) return 'targeting';
  return 'avoidance';
}
function bullets(...xs){return `<ul>${xs.map(x=>`<li>${x}</li>`).join('')}</ul>`;}
function moonPracticeAssessment(m){
  const highHearts=m.hearts.filter(c=>RANK_VALUE[c.rank]>=10).map(cardLabel);
  const suitTops=SUITS.map(s=>{const cs=m.hand.filter(c=>c.suit===s).sort((a,b)=>RANK_VALUE[b.rank]-RANK_VALUE[a.rank]);return `${suitName(s)}: ${cs.slice(0,2).map(cardLabel).join(', ')||'none'}`;}).join('; ');
  const weak=SUITS.filter(s=>!m.hand.some(c=>c.suit===s&&RANK_VALUE[c.rank]>=12)).map(suitName);
  const labels={ridiculous:'ridiculously strong',strong:'strong',solid:'solid',marginal:'marginal'};
  if(state.practiceStrength==='ridiculous') return [`This ${labels[state.practiceStrength]} practice hand has ${highHearts.length} high hearts (${highHearts.join(', ')||'none'}) plus unusually dense top-card coverage: ${suitTops}.`,`The exercise is less about deciding whether to shoot and more about sequencing winners, surviving duplicate cancellations, and avoiding an unnecessary loss of the lead.`];
  if(state.practiceStrength==='strong') return [`This strong practice hand has ${highHearts.length} high hearts (${highHearts.join(', ')||'none'}) and broad top-card coverage: ${suitTops}.`,`It should support a credible moon, but at least one suit may still require careful timing or help from cancellation rather than brute control.`];
  if(state.practiceStrength==='solid') return [`This solid practice hand has a real moon foundation, including ${highHearts.join(', ')||'several useful hearts'}, but control is less continuous across the four suits: ${suitTops}.`,`Treat the opening tricks as a test: identify where you can regain the lead, which middle cards may become winners, and whether the weak suit can be covered before defenders exploit it.`];
  return [`This marginal hand has enough moon features to justify the attempt, but its high-heart base is only ${highHearts.join(', ')||'thin'} and the weak-control suits are ${weak.join(' and ')||'not obvious'}.`,`The main gaps are broken honor sequences, low cards that can surrender control, and cancellation risk around isolated winners; use the first tricks to test whether those gaps are survivable before overcommitting.`];
}
function renderCoach(){
  if(!state.players.length) return;
  const m=humanHandMetrics();
  const shape=SUITS.map(s=>`${SUIT_SYMBOL[s]} ${m.counts[s]}`).join(' · ');
  const vc=m.voidCandidate;
  const sections=[
    ['Hand shape',`${shape}; your shortest suit is ${suitName(vc)} with ${m.counts[vc]} card${m.counts[vc]===1?'':'s'}.`,m.counts[vc]<=2?`That short ${suitName(vc)} suit is a realistic route to an early void.`:`The hand is fairly balanced, so a void will probably need help from the pass.`],
    ['Voluntary vs. forced control',`${m.highs.length} high cards give you ${m.control>=6?'substantial':m.control>=3?'some':'limited'} control over who wins tricks.`,m.exits.length?`${m.exits.length} low cards can serve as exits, so your control is not entirely forced.`:`You have few obvious exits, so winning a trick may leave you stuck on lead.`],
    ['Spades as a system',...(()=>{const sv=spadeVulnerability(m);const named=m.hand.filter(c=>c.suit==='S').map(cardLabel).join(', ')||'none';return [`Your spades are ${named}. Vulnerability is ${sv.level}: ${sv.reasons[0]}.`,sv.reasons.length>1?sv.reasons.slice(1).join('; '):m.counts.S<=2&&state.phase==='passing'?`Do not treat short spades as a clean void plan yet: the incoming pass can add Q♠, A♠, or K♠ without enough low-card cover.`:`Track both queens and both copies of A♠ and K♠ before assuming a high spade is safe.`]})()],
    ['Best candidate for a void',`${suitName(vc)} is the best current candidate because you hold ${m.counts[vc]} card${m.counts[vc]===1?'':'s'} there.`,vc==='S'?`Spades qualify only because your current spade vulnerability is low; reassess immediately after the pass for an incoming queen or unsupported A♠/K♠.`:m.counts.S<m.counts[vc]?`Although spades are shorter, ${spadeVulnerability(m).reasons[0]}, so ${suitName(vc)} is the safer structural void.`:`Shortening ${suitName(vc)} creates discard access without worsening your current spade liabilities.`],
    ['Safe exits',m.exits.length?`Your best exits are low cards such as ${m.exits.slice(0,4).map(c=>c.rank+SUIT_SYMBOL[c.suit]).join(', ')}.`:'There are no obvious low exits, so preserve any medium card that is likely to be overtaken.',`An exit is valuable only while higher uncancelled cards remain, so do not save every low card until it becomes a winner by default.`],
    ['Duplicate effects',m.pairs.length?`You hold both copies of ${m.pairs.join(', ')}, so those ranks cannot be cancelled by another player.`:'You hold no exact pair, so many apparent winners still have a matching copy somewhere outside your hand.',m.pairs.some(x=>['A','K','Q'].some(r=>x.startsWith(r)))?'Paired high cards provide reliable but potentially forced control.':'Unseen duplicates make high-card control less certain and can turn medium cards into surprise winners.'],
    ...(state.mode==='practice'?[['Moon-practice diagnosis',...moonPracticeAssessment(m)]]:[]),
    ['What kind of hand is this?',`The coach currently classifies this as a ${STRATEGY_LABELS[recommendedStrategy(m)].toLowerCase()} hand.`,m.control>=6?'It has enough control to consider aggressive play, but the pass and first tricks must confirm that control.':'Its strength lies more in flexibility and damage control than in dominating every penalty trick.']
  ];
  $('coachAssessment').innerHTML=sections.map(([h,a,b])=>`<div class="assessment-card"><h4>${h}</h4>${bullets(a,b)}</div>`).join('');
  const rec=state.mode==='practice'?(state.practiceType==='solo'?'soloMoon':'twoMoon'):recommendedStrategy(m); state.coachStrategy=state.mode==='practice'?rec:(state.coachStrategy||rec); if(!state.originalStrategy) state.originalStrategy=state.coachStrategy;
  $('coachRecommendation').innerHTML=`<strong>Recommended: ${STRATEGY_LABELS[rec]}</strong><br>${strategySummary(rec)}`;
  $('strategySelect').value=state.coachStrategy;
  $('coachSubtitle').textContent=state.mode==='practice'?`${({ridiculous:'Ridiculously strong',strong:'Strong',solid:'Solid',marginal:'Marginal'})[state.practiceStrength]} ${state.practiceType==='solo'?'solo':'two-player'} moon practice · ${m.hand.length} cards`:`Round ${state.round}, ${state.phase==='passing'?'before the pass is complete':'current hand'} · ${m.hand.length} cards`;
  renderStrategyOverview(); renderRejectedStrategies(); renderPassingRecommendations(); renderTrickCoach(); renderCardRecommendation(); renderOpponentAnalysis(); renderPostGameAnalysis();
}
function strategySummary(s){
  return {
    avoidance:'Minimize your own penalty exposure, build a void, preserve exits, and avoid taking control without a way to surrender it.',
    targeting:'Use your controllable winners and voids to place penalty cards on the player with the lowest total score.',
    cancellation:'Track matching copies, use duplicates to neutralize dangerous winners, and plan for the next-highest uncancelled card.',
    soloMoon:'Try to capture all 26 hearts and both queens yourself; abandon or downgrade the attempt as soon as another player takes a penalty card.',
    twoMoon:'Keep every penalty card concentrated between you and exactly one other player; a third scorer ends the attempt.'
  }[s];
}
function idealTwoMoonPartnerProfile(m){
  const suitOrder=[...SUITS].sort((a,b)=>m.counts[a]-m.counts[b]);
  const weak=suitOrder.slice(0,2), strong=suitOrder.slice(-2).reverse();
  const exposedSpades=m.highSpades.length>=2&&m.lowSpades.length<=1;
  const heartControl=m.hearts.filter(c=>RANK_VALUE[c.rank]>=10).length;
  const needs=[];
  needs.push(`Strong control in ${weak.map(suitName).join(' and ')}, the suits where your hand has only ${weak.map(s=>m.counts[s]).join(' and ')} cards.`);
  if(exposedSpades||m.queens.length) needs.push(`Several low spades or control of the missing queen${m.queens.length===1?'':'s'} so the two queens can stay with the intended pair.`);
  else needs.push(`Enough spade length to capture a queen safely without forcing penalty points onto a third player.`);
  if(heartControl<2) needs.push(`High-heart control, ideally several of A♥ through 10♥, because your hand cannot reliably collect a large share of the hearts.`);
  else needs.push(`Low and middle hearts that complement your ${heartControl} high-heart controls and prevent an outside player from stealing a small heart trick.`);
  needs.push(`Predictable exits in ${strong.map(suitName).join(' or ')}, allowing the partner to return the lead without donating points to a third player.`);
  return needs;
}
function moonTacticalPlan(m){
  const hand=[...m.hand];
  const suitCards=s=>hand.filter(c=>c.suit===s).sort((a,b)=>RANK_VALUE[b.rank]-RANK_VALUE[a.rank]);
  const topBySuit=Object.fromEntries(SUITS.map(s=>[s,suitCards(s)]));
  const openingTwo=hand.find(c=>c.suit==='C'&&c.rank==='2');
  const strongest=[...SUITS].sort((a,b)=>{
    const aa=topBySuit[a].filter(c=>RANK_VALUE[c.rank]>=11).length;
    const bb=topBySuit[b].filter(c=>RANK_VALUE[c.rank]>=11).length;
    return bb-aa || topBySuit[b].length-topBySuit[a].length;
  })[0];
  const weak=[...SUITS].sort((a,b)=>{
    const ac=topBySuit[a].filter(c=>RANK_VALUE[c.rank]>=12).length;
    const bc=topBySuit[b].filter(c=>RANK_VALUE[c.rank]>=12).length;
    return ac-bc || topBySuit[a].length-topBySuit[b].length;
  })[0];
  const exits=m.exits.slice(0,4).map(cardLabel);
  const queen=m.queens[0];
  const queenDup=queen?externalDuplicateStatus(queen):null;
  const steps=[];
  if(openingTwo){
    steps.push(`<strong>Win or recover from the opening:</strong> your forced 2♣ cannot win because the other 2♣ cancels it. Watch which uncancelled club takes the trick, then plan how you will regain the lead through ${topBySuit[strongest].slice(0,2).map(cardLabel).join(' or ')||'your strongest suit'}.`);
  } else {
    const openingControl=topBySuit.C.filter(c=>RANK_VALUE[c.rank]>=12).map(cardLabel);
    steps.push(`<strong>Contest the first trick:</strong> ${openingControl.length?`use your club control (${openingControl.join(', ')}) if the cancellation pattern lets you win`:`you lack top club control, so identify the winner and preserve a reliable entry in ${suitName(strongest)}`}. The immediate goal is control of the second lead, not merely collecting a point-free trick.`);
  }
  steps.push(`<strong>Establish control before cashing hearts:</strong> lead ${suitName(strongest)} from the top with ${topBySuit[strongest].slice(0,3).map(cardLabel).join(', ')||'your highest cards'} to test whether matching honors cancel and whether an outside player owns the next winner. Do not expose hearts until you know you can keep or regain the lead.`);
  if(queen){
    steps.push(`<strong>Handle ${cardLabel(queen)} deliberately:</strong> ${queenDup.externalUnseen?`its twin is still outside your hand, so leading it asks the other queen to appear and cancel. That is useful only if you have calculated that the next-highest uncancelled spade will still belong to ${state.practiceType==='two'?'you or Partner':'you'}; otherwise the lead can hand thirteen points to a defender and end the practice.`:`the matching queen is no longer available outside your hand, so it is a reliable thirteen-point capture card when you can make ${state.practiceType==='two'?'you or Partner':'yourself'} win the trick.`}`);
  } else {
    steps.push(`<strong>Plan for both queens:</strong> preserve spade control until you have seen where at least one queen sits. Leading high spades too early can let the two queens cancel and promote an outside medium spade into the winner.`);
  }
  steps.push(`<strong>Protect the weak suit:</strong> ${suitName(weak)} is the main gap. Your top cards there are ${topBySuit[weak].slice(0,3).map(cardLabel).join(', ')||'none'}; avoid surrendering the lead into that suit until its outside winners have been drawn or ${state.practiceType==='two'?'Partner has demonstrated control there':'you have a clear re-entry afterward'}.`);
  steps.push(`<strong>Save exits selectively:</strong> ${exits.length?`${exits.join(', ')} are possible exits, but a moon attempt normally wants to avoid using them until they solve a specific sequencing problem.`:`you have few obvious low exits, so sequence your winners carefully to avoid being forced into the weak suit.`} Preserve the exit that lets you regain or transfer control after the weak-suit test, not every low card indiscriminately.`);
  if(state.practiceType==='two'){
    const partner=state.partnerIndex!=null?state.players[state.partnerIndex]?.name:'Partner';
    steps.push(`<strong>Coordinate with ${partner||'Partner'} through play:</strong> use early point-free tricks to learn which suit Partner controls. Once Partner wins a penalty trick, feed them points only in suits where their winning card is protected from cancellation; otherwise keep the points yourself and force another test.`);
  }
  return steps;
}
function renderStrategyOverview(){
  if(!$('strategyOverview'))return;
  const m=humanHandMetrics();
  let extra='';
  if(state.coachStrategy==='twoMoon') extra=`<div class="partner-profile"><strong>Ideal partner hand</strong>${bullets(...idealTwoMoonPartnerProfile(m))}</div>`;
  if(state.mode==='practice'){
    const fixed=state.practiceType==='solo'?'Solo moon':'Two-player moon';
    $('strategyOverview').innerHTML=`<div class="practice-strategy-lock"><strong>Practice strategy: ${fixed}</strong><p>This strategy is fixed for the exercise. The task is to learn the sequence and decision points, not to select a safer escape hatch after seeing the cards.</p></div><div class="partner-profile"><strong>Tactical execution plan</strong><ul>${moonTacticalPlan(m).map(x=>`<li>${x}</li>`).join('')}</ul></div>${extra}`;
    return;
  }
  $('strategyOverview').innerHTML=`<strong>Operating plan</strong><p>${strategySummary(state.coachStrategy)}</p>${extra}`;
}
function cardLabel(c){return `${c.rank}${SUIT_SYMBOL[c.suit]}`;}

function currentPenaltyCollectors(){
  return state.players.map((p,i)=>({i,points:p.roundPoints})).filter(x=>x.points>0);
}
function strategyViability(strategy){
  const collectors=currentPenaltyCollectors();
  if(strategy==='soloMoon'){
    const outsider=collectors.find(x=>x.i!==0);
    if(outsider) return {viable:false,reason:`${state.players[outsider.i].name} has already captured ${outsider.points} penalty point${outsider.points===1?'':'s'}, so a solo moon is no longer possible.`,suggestions:['twoMoon','avoidance','targeting','cancellation']};
  }
  if(strategy==='twoMoon'){
    if(state.mode==='practice' && state.partnerIndex!=null){
      const outsider=collectors.find(x=>x.i!==0&&x.i!==state.partnerIndex);
      if(outsider) return {viable:false,reason:`${state.players[outsider.i].name} has captured penalty points outside the You–Partner pair, so the two-player moon is broken.`,suggestions:['avoidance','targeting','cancellation']};
    } else if(collectors.length>2){
      return {viable:false,reason:`Penalty points are now spread across ${collectors.length} players, so they can no longer be concentrated between exactly two shooters.`,suggestions:['avoidance','targeting','cancellation']};
    }
  }
  return {viable:true,reason:'',suggestions:[]};
}
function pivotReasonFor(strategy){
  if(strategy==='avoidance') return 'Shift to damage control: shed exposed winners, preserve low exits, and avoid collecting additional penalty cards.';
  if(strategy==='targeting') return 'Redirect the hand toward the current leader: preserve cards that can place points deliberately rather than dumping them at the first opportunity.';
  if(strategy==='cancellation') return 'Use known duplicate locations and cancellation chains to control who wins, while avoiding cancellations that promote an outsider.';
  if(strategy==='twoMoon') return 'Treat the second scorer as the prospective partner and keep every remaining penalty card within those two piles.';
  return strategySummary(strategy);
}
function renderPivotAlert(container){
  if(!container || state.mode==='practice') return false;
  const viability=strategyViability(state.coachStrategy);
  if(viability.viable){ state.pendingPivot=null; return false; }
  state.pendingPivot={from:state.coachStrategy,reason:viability.reason,suggestions:viability.suggestions};
  const opts=viability.suggestions.map(s=>`<option value="${s}">${STRATEGY_LABELS[s]}</option>`).join('');
  container.innerHTML=`<div class="pivot-alert"><h4>Strategy change needed</h4><p>${viability.reason}</p><label for="pivotStrategySelect">Choose the new strategy</label><select id="pivotStrategySelect">${opts}</select><p id="pivotStrategyExplanation" class="evidence">${pivotReasonFor(viability.suggestions[0])}</p><button id="confirmPivotBtn" class="primary compact">Adopt new strategy</button></div>`+container.innerHTML;
  const sel=$('pivotStrategySelect');
  if(sel) sel.onchange=()=>{$('pivotStrategyExplanation').textContent=pivotReasonFor(sel.value);};
  const btn=$('confirmPivotBtn');
  if(btn) btn.onclick=()=>recordStrategyPivot(sel.value,viability.reason);
  return true;
}
function recordStrategyPivot(next,reason){
  const from=state.coachStrategy;
  if(!next || next===from) return;
  state.strategyPivots.push({from,to:next,trick:state.trickNumber+1,reason,decisionIndex:state.humanDecisionLog.length});
  state.coachStrategy=next; state.pendingPivot=null;
  $('strategySelect').value=next;
  renderStrategyOverview(); renderTrickCoach(); renderCardRecommendation(); renderPassingRecommendations();
}

function renderTrickCoach(){
  if(!state.players.length) return;
  const box=$('trickCoach');
  if(state.phase==='passing'){
    const m=humanHandMetrics();
    box.innerHTML=bullets(`Use the pass to support ${STRATEGY_LABELS[state.coachStrategy].toLowerCase()}, not merely to discard the three highest cards.`,`The clearest structural objective is to shorten ${suitName(m.voidCandidate)} while preserving useful low exits.`); return;
  }
  if(state.phase==='trick-end'){
    const lastPts=state.trick.reduce((a,x)=>a+cardPoints(x.card),0);
    box.innerHTML=bullets(`Review the completed trick: it carried ${lastPts} penalty point${lastPts===1?'':'s'}, and cancelled cards no longer competed to win.`,`Before the next lead, check who now has penalty points; solo and two-player moon possibilities depend on the number of different scorers.`); return;
  }
  if(state.phase!=='playing'){box.innerHTML='<p>Guidance will appear when play begins.</p>';return;}
  const legal=state.currentPlayer===0?legalCards(0):[];
  if(state.currentPlayer!==0){box.innerHTML=bullets(`Watch what ${state.players[state.currentPlayer].name} plays and whether it reveals a void.`,`Track duplicates as they appear; one visible copy changes the risk of every matching card still hidden.`);return;}
  const pts=state.trick.reduce((a,x)=>a+cardPoints(x.card),0);
  const led=state.trick[0]?.card.suit;
  const low=[...legal].sort((a,b)=>RANK_VALUE[a.rank]-RANK_VALUE[b.rank])[0];
  const cancel=legal.find(c=>state.trick.some(x=>x.card.suit===c.suit&&x.card.rank===c.rank));
  let tips=[];
  if(state.coachStrategy==='avoidance') tips=[pts?`This trick already contains ${pts} points; prefer a legal card that does not leave you as the highest uncancelled card.`:`With no points showing, use ${low?cardLabel(low):'a low legal card'} to preserve stronger cards and reduce the chance of taking control.`,`If you cannot follow ${led?suitName(led):'the led suit'}, discard your most dangerous penalty card or exposed winner.`];
  if(state.coachStrategy==='targeting'){
    const leader=state.players.reduce((a,p,i)=>p.score<state.players[a].score?i:a,0);
    tips=[`The current game leader is ${state.players[leader].name}; favor lines that make that player win penalty-bearing tricks.`,`Do not spend a dangerous card merely because you can; retain it if a later lead offers a clearer target.`,`Avoid taking this trick yourself unless doing so creates a stronger forcing lead next.`];
  }
  if(state.coachStrategy==='cancellation') tips=[cancel?`${cardLabel(cancel)} would cancel its matching copy already in the trick; then recalculate which uncancelled card becomes highest.`:`No legal card currently creates an immediate cancellation, so play with the unseen duplicate of each high card in mind.`,`When two high ranks cancel, a medium card can become the winner, so inspect the entire trick rather than only the top rank.`];
  if(state.coachStrategy==='soloMoon') tips=[`You need every remaining penalty card yourself; winning point-free tricks matters only when it preserves or regains control.`,`If another player has already captured any penalty card, the solo moon is over and you should shift to a two-player moon or damage control.`,`Prefer cards that maintain the lead without exposing a suit in which an opponent can take a heart.`];
  if(state.coachStrategy==='twoMoon'){
    const scorers=state.players.map((p,i)=>({p,i})).filter(x=>x.p.roundPoints>0);
    tips=[`All penalty cards must remain with exactly two scorers; currently there ${scorers.length===1?'is 1 scorer':`are ${scorers.length} scorers`}.`,`Identify the intended second collector and avoid allowing any third player to win a penalty-bearing trick.`,`Use voids to feed penalty cards to the partner collector rather than simply minimizing your own score.`];
  }
  const viability=strategyViability(state.coachStrategy);
  if(!viability.viable && state.mode!=='practice') tips.unshift(`Strategy change needed: ${viability.reason}`);
  box.innerHTML=bullets(...tips);
  renderCardRecommendation(); renderOpponentAnalysis();
}


function rejectedStrategyDetails(strategy,m,rec){
  const shape=SUITS.map(s=>`${SUIT_SYMBOL[s]}${m.counts[s]}`).join(' / ');
  const shortSuit=suitName(m.voidCandidate);
  const highNames=m.highs.slice(0,5).map(cardLabel).join(', ')||'no jacks, queens, kings, or aces';
  const exitNames=m.exits.slice(0,5).map(cardLabel).join(', ')||'no dependable low exits';
  const pairNames=m.pairs.join(', ')||'no exact duplicate pairs';
  const heartHighs=m.hearts.filter(c=>RANK_VALUE[c.rank]>=10).map(cardLabel);
  const weakSuits=[...SUITS].sort((a,b)=>m.counts[a]-m.counts[b]).slice(0,2);
  const strengths={
    avoidance:`The ${shape} shape includes ${m.lowCards.length} low cards and exits such as ${exitNames}; ${shortSuit} is only ${m.counts[m.voidCandidate]} card${m.counts[m.voidCandidate]===1?'':'s'} from being empty.`,
    targeting:`The hand contains ${m.control} control measures, led by ${highNames}, and a potential ${shortSuit} void that could let you discard a queen or heart onto a chosen winner.`,
    cancellation:m.pairs.length?`You hold both copies of ${pairNames}, so you know those ranks cannot cancel against an opponent and can calculate their trick strength precisely.`:`You hold only single copies, leaving many external twins available to cancel cards such as ${highNames}.`,
    soloMoon:`You have ${m.highs.length} high cards, ${m.hearts.length} hearts, and ${heartHighs.length?`heart control from ${heartHighs.join(', ')}`:'no high-heart control'}; that is enough to examine the possibility rather than dismiss it instantly.`,
    twoMoon:`Your control in ${[...SUITS].sort((a,b)=>m.counts[b]-m.counts[a]).slice(0,2).map(suitName).join(' and ')} could collect one share of the points, while shortness in ${weakSuits.map(suitName).join(' and ')} could help feed points to one partner.`
  };
  const missing={
    avoidance:`The dangerous holdings ${highNames} are not all backed by low cards, and only ${m.exits.length} cards currently look like reliable ways to surrender the lead.`,
    targeting:`You do not yet have both a confirmed void and enough flexible winners to choose the recipient; cancellation could make a medium card, rather than your intended target, win.`,
    cancellation:`The central plan lacks enough useful paired or matching ranks: ${pairNames}. Cancellation remains an event to exploit, not a complete strategy for the hand.`,
    soloMoon:`A solo moon needs continuous control across all four suits, all 26 hearts, and both queens. This hand has shape ${shape}, only ${heartHighs.length} high hearts, and ${m.exits.length} cards designed to lose rather than retain control.`,
    twoMoon:`Your gaps are ${weakSuits.map(s=>`${suitName(s)} (${m.counts[s]} cards)`).join(' and ')}. A useful partner needs actual top control there, such as A/K sequences or protected paired honors, plus ${m.queens.length?`the missing queen and enough low spades to control when it appears`:`a safe route to one or both queens`}.`
  };
  const traps={
    avoidance:`Passing every obvious high card could destroy the ${shortSuit} void plan or remove ${exitNames}; keeping them too long could instead leave you running the final tricks.`,
    targeting:`Trying to hit the score leader with ${m.queens.length?m.queens.map(cardLabel).join(' and '):'a later heart dump'} may backfire when duplicates cancel and the next-highest card sends the entire trick to you or a trailing player.`,
    cancellation:`A flashy cancellation can expose your ${highNames} as the next-highest uncancelled winner, leaving you with the points you thought you had escaped.`,
    soloMoon:`Losing one small heart to another player ends the 104-point solo outcome; with ${m.exits.length} low exits and weakness in ${weakSuits.map(suitName).join(' and ')}, that failure could occur before you can pivot.`,
    twoMoon:`The concrete danger is losing control when ${weakSuits.map(suitName).join(' or ')} is led. For example, if your highest card there is ${weakSuits.map(s=>{const cs=m.hand.filter(c=>c.suit===s).sort((a,b)=>RANK_VALUE[b.rank]-RANK_VALUE[a.rank]);return cs[0]?cardLabel(cs[0]):`no ${suitName(s)}`}).join(' and ')}, a third player can win a small-heart discard before either intended collector can intervene. Another trap is complementary control that is only apparent: if your partner's A or K cancels, the next-highest outside card may take the entire penalty trick.`
  };
  return [strengths[strategy],missing[strategy],traps[strategy]];
}
function renderRejectedStrategies(){
  const box=$('rejectedStrategies'); if(!box||!state.players.length)return;
  const m=humanHandMetrics(), rec=recommendedStrategy(m);
  box.innerHTML=Object.keys(STRATEGY_LABELS).filter(s=>s!==rec).map(s=>{const d=rejectedStrategyDetails(s,m,rec);return `<div class="rejected-card"><h4>${STRATEGY_LABELS[s]}</h4><ul><li><strong>What fits:</strong> ${d[0]}</li><li><strong>What is missing:</strong> ${d[1]}</li><li><strong>Likely trap:</strong> ${d[2]}</li></ul></div>`}).join('');
}
function passCardScoreForStrategy(card,m,strategy){
  const rank=RANK_VALUE[card.rank], count=m.counts[card.suit], penalty=cardPoints(card); let score=0; let reasons=[];
  if(strategy==='avoidance'){
    score+=rank*2+penalty*8+(count<=3?12:0); if(card.suit==='S'&&['Q','K','A'].includes(card.rank)){score+=25;reasons.push('reduces exposed spade danger');} if(count<=3)reasons.push(`helps shorten ${suitName(card.suit)}`); if(rank>=11)reasons.push('removes a likely forced winner');
  }
  if(strategy==='targeting'){
    score+=(count<=2?15:0)+(rank>=12?10:0); if(penalty)score-=8; if(count<=2)reasons.push(`builds a void for later point placement`); if(rank>=12)reasons.push('removes control that is too blunt to target safely');
  }
  if(strategy==='cancellation'){
    const paired=m.hand.filter(c=>c.suit===card.suit&&c.rank===card.rank).length===2; score+=paired&&rank>=10?22:rank; if(paired)reasons.push('breaks up a rigid pair that cannot cancel externally'); else if(rank>=12)reasons.push('reduces dependence on an unseen duplicate');
  }
  if(strategy==='soloMoon'){
    score+=(rank<=6?28:0)+(count<=2?12:0)-penalty*4; if(rank<=6)reasons.push('removes a card likely to surrender a crucial trick'); if(count<=2)reasons.push('tightens suit control');
  }
  if(strategy==='twoMoon'){
    score+=(rank<=5?18:0)+(count<=2?12:0)+(card.suit==='S'&&card.rank==='Q'?-20:0); if(rank<=5)reasons.push('removes a weak card that may send points to a third player'); if(count<=2)reasons.push('creates a void for feeding points to one co-collector');
  }
  if(!reasons.length) reasons.push('improves the hand structure for the selected plan');
  return {card,score,reasons};
}
function renderPassingRecommendations(){
  const box=$('passingRecommendations'); if(!box||!state.players.length)return;
  const m=humanHandMetrics();
  if(state.passOffset===0){box.innerHTML='<p>This is a hold hand, so no cards are passed. Reassess the strategy using the full dealt hand.</p>';return;}
  const ranked=m.hand.map(c=>passCardScoreForStrategy(c,m,state.coachStrategy)).sort((a,b)=>b.score-a.score);
  const primary=ranked.slice(0,3), secondary=ranked.slice(3,6);
  const renderSet=(title,set)=>`<div class="pass-set"><h4>${title}</h4>${set.map(x=>`<div class="pass-line"><strong>${cardLabel(x.card)}</strong><span>${x.reasons.join('; ')}.</span></div>`).join('')}</div>`;
  box.innerHTML=`<p class="small-copy">These recommendations support <strong>${STRATEGY_LABELS[state.coachStrategy]}</strong> while accounting for the current passing direction: ${passDescription(state.passOffset)}.</p>${renderSet('Most recommended',primary)}${renderSet('Secondary recommendation',secondary)}`;
}
function renderPersonasDialog(){
  const box=$('personasDialogBody');
  box.innerHTML=PERSONAS.map(p=>`<div class="persona-description"><h3>${p}</h3><p>${PERSONA_DESCRIPTIONS[p]}</p></div>`).join('');
}
function renderScoreDialog(){
  const box=$('scoreDialogBody'); if(!box||!state.players.length)return;
  const sorted=[...state.players].sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  const heads=state.scoreHistory.map((_,i)=>`<th>Hand ${i+1}</th>`).join('');
  box.innerHTML=`<div class="score-table-wrap"><table class="score-table"><thead><tr><th>Player</th><th>Total</th>${heads}</tr></thead><tbody>${sorted.map(p=>`<tr><td><strong>${p.name}</strong></td><td><strong>${p.score}</strong></td>${state.scoreHistory.map(h=>`<td>${h[p.name]??0}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function updatePracticeCoachTabs(){
  const locked=state.mode==='practice';
  document.querySelectorAll('.coach-tab').forEach(b=>{
    const disable=locked&&b.dataset.tab==='rejected';
    b.disabled=disable;b.classList.toggle('coach-tab-disabled',disable);
  });
  if(locked){
    state.coachStrategy=state.practiceType==='solo'?'soloMoon':'twoMoon';
    $('strategySelect').value=state.coachStrategy;
    $('strategySelect').disabled=true;
  } else $('strategySelect').disabled=false;
}
function activateCoachTab(tab){
  const btn=document.querySelector(`.coach-tab[data-tab="${tab}"]`);if(btn?.disabled)return;
  document.querySelectorAll('.coach-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.coach-tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===tab));
  if(tab==='rejected') renderRejectedStrategies();
  if(tab==='passing') renderPassingRecommendations();
  if(tab==='ingame') renderCardRecommendation();
  if(tab==='opponents') renderOpponentAnalysis();
  if(tab==='postgame') renderPostGameAnalysis();
}
function updateCoachWeights(){
  state.coachWeights={board:+$('boardWeight').value,score:+$('scoreWeight').value,strategy:+$('strategyWeight').value};
  const total=state.coachWeights.board+state.coachWeights.score+state.coachWeights.strategy||1;
  $('boardWeightOut').textContent=Math.round(state.coachWeights.board/total*100)+'%';
  $('scoreWeightOut').textContent=Math.round(state.coachWeights.score/total*100)+'%';
  $('strategyWeightOut').textContent=Math.round(state.coachWeights.strategy/total*100)+'%';
  renderCardRecommendation();
}
function simulatePlay(card){
  const fake=[...state.trick.map(x=>({player:x.player,card:x.card,cancelled:false})),{player:0,card,cancelled:false}]; resolveFakeCancellation(fake);
  const led=fake[0]?.card.suit;
  const eligible=fake.filter(x=>x.card.suit===led&&!x.cancelled);
  const winner=eligible.length?eligible.reduce((a,b)=>RANK_VALUE[a.card.rank]>RANK_VALUE[b.card.rank]?a:b).player:fake[0]?.player;
  return {winner,cancelled:fake.at(-1)?.cancelled||false,points:fake.reduce((n,x)=>n+cardPoints(x.card),0),led};
}
function cardsAlreadyExposed(){
  const played=state.actionLog.map(a=>a.card);
  const current=state.trick.map(x=>x.card);
  return [...played,...current];
}
function externalDuplicateStatus(card){
  const ownCopies=state.players[0].hand.filter(c=>c.suit===card.suit&&c.rank===card.rank).length;
  const exposedCopies=cardsAlreadyExposed().filter(c=>c.suit===card.suit&&c.rank===card.rank).length;
  const externalUnseen=Math.max(0,2-ownCopies-exposedCopies);
  return {ownCopies,exposedCopies,externalUnseen,reliable:externalUnseen===0};
}
function higherCardsStillLive(card){
  const exposed=cardsAlreadyExposed();
  let live=0;
  for(const rank of RANKS){
    if(RANK_VALUE[rank]<=RANK_VALUE[card.rank]) continue;
    const own=state.players[0].hand.filter(c=>c.suit===card.suit&&c.rank===rank).length;
    const seen=exposed.filter(c=>c.suit===card.suit&&c.rank===rank).length;
    live+=Math.max(0,2-own-seen);
  }
  return live;
}
function handEvolutionForPlay(card,sim){
  const hand=state.players[0].hand;
  const after=hand.filter(c=>c.id!==card.id);
  const suitBefore=hand.filter(c=>c.suit===card.suit);
  const suitAfter=after.filter(c=>c.suit===card.suit);
  const rank=RANK_VALUE[card.rank];
  const dup=externalDuplicateStatus(card);
  const higherLive=higherCardsStillLive(card);
  const lowerSameSuit=after.filter(c=>c.suit===card.suit&&RANK_VALUE[c.rank]<rank).length;
  const higherSameSuit=after.filter(c=>c.suit===card.suit&&RANK_VALUE[c.rank]>rank).length;
  const safeNow=state.trick.length>0&&sim.winner!==0;
  let value=0;
  const notes=[];

  // When a card can be shed without taking the trick, prefer unloading the
  // highest future liability rather than spending the cheapest exit.
  if(safeNow){
    value+=(rank-2)*2.2;
    if(rank>=10) notes.push(`${cardLabel(card)} sheds a future winner while another player still takes this trick`);
    if(dup.reliable){value+=10;notes.push(`its matching copy is no longer available outside your hand, so the play will not be undone by cancellation`);}
    else if(dup.externalUnseen){value-=4;notes.push(`one matching copy is still unseen, so cancellation could change the winner`);}
  }

  // Preserve genuinely low cards as exits unless playing one creates an
  // immediate and useful void or is required to avoid points.
  if(rank<=6&&suitBefore.length>1&&!safeNow){value-=8;notes.push(`${cardLabel(card)} is still a useful low exit and need not be spent yet`);}
  if(rank<=6&&safeNow&&hand.some(c=>c.suit===card.suit&&RANK_VALUE[c.rank]>rank&&simulatePlay(c).winner!==0)){
    value-=12;notes.push(`a higher card in ${suitName(card.suit)} can also lose this trick, so preserving ${cardLabel(card)} is preferable`);
  }

  // Reward useful suit compression, but distinguish it from blindly emptying
  // spades or creating control with only high cards left.
  if(suitAfter.length===0){
    const spadeRisk=card.suit==='S'?spadeVulnerability(humanHandMetrics()).level:'low';
    if(card.suit!=='S'||spadeRisk==='low'){value+=12;notes.push(`the play creates a ${suitName(card.suit)} void for later discards`);}
    else {value-=8;notes.push(`the apparent spade void is risky because incoming or retained high spades remain structurally dangerous`);}
  } else if(lowerSameSuit===0&&higherSameSuit>0){
    value-=10;notes.push(`after this play, your remaining ${suitName(card.suit)} cards are all higher and more likely to become forced winners`);
  }

  // A high card is safer to retain when several higher outside cards remain;
  // it is urgent to shed when the suit is becoming exhausted.
  if(rank>=9){
    if(higherLive<=2){value+=10;notes.push(`few higher ${suitName(card.suit)} cards remain live, so keeping ${cardLabel(card)} risks it becoming a late forced winner`);}
    else if(higherLive>=6&&!safeNow){value-=3;}
  }

  return {value,notes,dup,higherLive,safeNow};
}
function cardDecisionScores(card){
  const sim=simulatePlay(card), rank=RANK_VALUE[card.rank], penalty=cardPoints(card), following=state.trick.length>0;
  const evolution=handEvolutionForPlay(card,sim);
  let board=50, score=50, strategy=50;
  if(following){ board += sim.winner===0?-22:18; board += sim.cancelled?10:0; board -= sim.winner===0?sim.points*3:0; }
  else { board += rank<=6?8:-Math.max(0,rank-10)*3; if(card.suit==='H'&&!state.heartsBroken) board-=30; }
  board += evolution.value;
  const leader=state.players.reduce((best,p,i)=>p.score<state.players[best].score?i:best,0);
  if(sim.winner===leader&&sim.points>0) score+=22; if(sim.winner===0&&sim.points>0) score-=25;
  if(state.players[0].score>=state.target-20&&sim.winner===0) score-=18;
  const scorers=state.players.map((p,i)=>({i,pts:p.roundPoints})).filter(x=>x.pts>0);
  if(state.coachStrategy==='avoidance'){strategy += sim.winner===0?-30:22; strategy += penalty?18:0; if(evolution.safeNow)strategy+=Math.min(18,rank);}
  if(state.coachStrategy==='targeting'){strategy += sim.winner===leader?30:0; strategy += sim.winner===0?-15:5;}
  if(state.coachStrategy==='cancellation'){strategy += sim.cancelled?28:0; strategy += state.trick.some(x=>x.card.suit===card.suit&&x.card.rank===card.rank)?10:0; if(evolution.dup.reliable&&evolution.safeNow)strategy+=8;}
  if(state.coachStrategy==='soloMoon'){
    const shooterWins=sim.winner===0;
    strategy += shooterWins?28:-20;
    strategy += shooterWins?sim.points*3:0;
    // Any penalty-bearing trick won outside the solo shooter's hand ends the attempt.
    // Treat that as a tactical veto, not a modest drawback that point-value bonuses can overwhelm.
    if(sim.points>0&&!shooterWins){strategy=0;board=Math.min(board,4);score=Math.min(score,4);}
    if(scorers.some(x=>x.i!==0))strategy-=35;
    if(!following&&card.suit==='S'&&card.rank==='Q'&&evolution.dup.externalUnseen){strategy-=22; if(!shooterWins)strategy-=35;}
    if(!following&&!shooterWins)strategy-=18;
  }
  if(state.coachStrategy==='twoMoon'){
    const other=state.partnerIndex??scorers.find(x=>x.i!==0)?.i;
    const pairWins=sim.winner===0||sim.winner===other;
    strategy += pairWins?22:-25;
    strategy += pairWins?sim.points*2:0;
    // In a two-player moon, a single penalty point captured by anyone outside
    // the pair breaks the shoot. This is especially important when matching
    // queens cancel and promote an outsider's spade into the winning card.
    if(sim.points>0&&!pairWins){strategy=0;board=Math.min(board,4);score=Math.min(score,4);}
    if(!following&&card.suit==='S'&&card.rank==='Q'&&evolution.dup.externalUnseen&&!pairWins)strategy-=45;
    if(!following&&!pairWins)strategy-=16;
  }
  return {board:clamp(board),score:clamp(score),strategy:clamp(strategy),sim,evolution};
}
function clamp(n){return Math.max(0,Math.min(100,n));}
function rankHumanLegalCards(legal=state.currentPlayer===0&&state.phase==='playing'?legalCards(0):[]){
  const w=state.coachWeights,total=w.board+w.score+w.strategy||1;
  return legal.map(card=>{const f=cardDecisionScores(card); const totalScore=(f.board*w.board+f.score*w.score+f.strategy*w.strategy)/total; return {card,...f,total:totalScore,reason:recommendationReason(card,f)};}).sort((a,b)=>b.total-a.total);
}
function moonRecommendationDetails(card,f){
  const sim=f.sim, dup=f.evolution?.dup||externalDuplicateStatus(card);
  const following=state.trick.length>0;
  const currentWinner=state.trick.length?simulatePlay(card).winner:null;
  const parts=[];
  const shooterSet=state.practiceType==='two'?new Set([0,state.partnerIndex]):new Set([0]);
  const intendedWinner=shooterSet.has(sim.winner);
  if(following){
    if(intendedWinner) parts.push(`the immediate objective is to keep this trick inside ${state.practiceType==='two'?'the shooting pair':'your hand'}, preserving the moon`);
    else if(sim.points>0) parts.push(`do not make this play: after cancellation and trick resolution, ${state.players[sim.winner]?.name||'an outside player'} would win ${sim.points} penalty point${sim.points===1?'':'s'}, which immediately breaks the ${state.practiceType==='two'?'two-player':'solo'} moon`);
    else parts.push(`this play currently gives the point-free trick to ${state.players[sim.winner]?.name||'an opponent'}; it is acceptable only if you have a concrete route to regain the lead`);
  } else {
    const sameSuit=state.players[0].hand.filter(c=>c.suit===card.suit&&c.id!==card.id);
    if(card.suit==='S'&&card.rank==='Q'){
      if(dup.externalUnseen){
        parts.push(`leading ${cardLabel(card)} is a cancellation test, not merely a way to collect thirteen points`);
        parts.push(`you are hoping the other Q♠ is forced out while the next-highest uncancelled spade still belongs to ${state.practiceType==='two'?'you or Partner':'you'}`);
        parts.push(`if an outside A♠, K♠, or promoted medium spade becomes the winner, the queen points leave the shooting group and the attempt is broken`);
      } else {
        parts.push(`the other Q♠ is no longer available to cancel, so this lead is meant to secure the queen points while retaining the lead`);
      }
    } else if(RANK_VALUE[card.rank]>=11){
      parts.push(`this lead tests your control of ${suitName(card.suit)} and tries to draw matching honors before you expose hearts`);
      if(dup.externalUnseen) parts.push(`the matching ${cardLabel(card)} is still unseen, so the hoped-for outcome is either no cancellation or a cancellation that promotes another card held by the shooting side`);
      else parts.push(`the matching copy cannot appear outside your hand, making this a more reliable control lead`);
    } else {
      parts.push(`this low lead is being used to probe ${suitName(card.suit)}, but it risks surrendering control; it makes sense only if ${sameSuit.filter(c=>RANK_VALUE[c.rank]>=11).map(cardLabel).join(', ')||'a later winner'} can regain the lead`);
    }
  }
  if(following&&card.suit==='S'&&card.rank==='Q'&&state.trick.some(x=>x.card.suit==='S'&&x.card.rank==='Q')){
    const matching=state.trick.find(x=>x.card.suit==='S'&&x.card.rank==='Q');
    const owner=matching?state.players[matching.player]?.name:'the current queen holder';
    if(!intendedWinner&&sim.points>0) parts.push(`your Q♠ would cancel ${owner}'s Q♠ and promote ${state.players[sim.winner]?.name||'an outsider'} to win the trick; both queen penalties would then leave the shooting pair`);
    else parts.push(`your Q♠ cancels ${owner}'s Q♠, so verify that the promoted winner remains on the shooting side before considering it`);
  }
  if(card.suit==='H') parts.push(`leading hearts now is intended to cash heart points while you still control the suit; it is premature if an outside higher heart or duplicate can win`);
  if(f.evolution?.notes?.length) parts.push(...f.evolution.notes.slice(0,1));
  return parts;
}
function recommendationReason(card,f){
  if(state.coachStrategy==='soloMoon'||state.coachStrategy==='twoMoon'){
    return moonRecommendationDetails(card,f).join('; ')+'.';
  }
  const parts=[];
  if(f.sim.cancelled)parts.push('it cancels the matching card already on the table');
  if(f.sim.winner!==0)parts.push('it currently avoids winning the trick');
  else if(f.sim.points===0)parts.push('it takes a point-free trick and may preserve useful control');
  else parts.push(`it currently takes ${f.sim.points} penalty point${f.sim.points===1?'':'s'}`);
  if(f.evolution?.notes?.length) parts.push(...f.evolution.notes.slice(0,2));
  if(state.coachStrategy==='targeting'&&f.sim.winner!==0)parts.push(`the likely winner is ${state.players[f.sim.winner]?.name||'another player'}`);
  return parts.join('; ')+'.';
}
function renderCardRecommendation(){
  const box=$('cardRecommendation'); if(!box||!state.players.length)return;
  if(state.phase==='passing'){box.innerHTML='<p>Select a strategy first. Passing guidance appears under Execution guidance.</p>';return;}
  if(state.phase!=='playing'||state.currentPlayer!==0){box.innerHTML='<p>The coach will rank legal cards when it is your turn. Meanwhile, watch for voids, cancellations, and who is collecting points.</p>'; renderPivotAlert(box); return;}
  const ranked=rankHumanLegalCards(); if(!ranked.length){box.innerHTML='<p>No legal card is available.</p>';return;}
  const r=ranked[0];
  const bars=[['Board',r.board],['Score',r.score],['Strategy',r.strategy]].map(([n,v])=>`<div class="factor-row"><span>${n}</span><div class="factor-track"><div class="factor-fill" style="width:${v}%"></div></div><strong>${Math.round(v)}</strong></div>`).join('');
  const alternatives=ranked.slice(1,3).map(x=>`${cardLabel(x.card)} (${Math.round(x.total)})`).join(' · ');
  box.innerHTML=`<div class="recommended-card">Play ${cardLabel(r.card)}</div><p>${r.reason}</p><div class="factor-bars">${bars}</div>${alternatives?`<p class="small-copy">Next-best options: ${alternatives}</p>`:''}`; renderPivotAlert(box);
}
function inferOpponent(playerIndex){
  const acts=state.actionLog.filter(a=>a.player===playerIndex); const scores=Object.fromEntries(PERSONAS.map(p=>[p,0])); const examples=[];
  for(const a of acts){const c=a.card, pts=a.before.trick.reduce((n,x)=>n+cardPoints(x.card),0), high=RANK_VALUE[c.rank]>=11, duplicate=a.before.trick.some(x=>x.card.suit===c.suit&&x.card.rank===c.rank), voidPlay=a.before.trick.length&&c.suit!==a.before.trick[0].card.suit;
    if(duplicate){scores['The Canceller']+=3;examples.push(`${cardLabel(c)} cancelled a matching card on trick ${a.trick}.`)}
    if(voidPlay&&cardPoints(c)>0){scores['The Suit Engineer']+=2;examples.push(`Used a void to discard ${cardLabel(c)} on trick ${a.trick}.`)}
    if(cardPoints(c)>0){scores['The Minimalist']+=1;scores['The Hunter']+=1;}
    if(high&&pts>0){scores['The Moonshot']+=2;examples.push(`Played high into a point-bearing trick on trick ${a.trick}.`)}
    if(!high&&pts>0){scores['The Minimalist']+=2;}
    const currentLeader=a.before.scores.indexOf(Math.min(...a.before.scores)); if(currentLeader!==playerIndex&&pts>0)scores['The Hunter']+=1;
    const collectors=a.before.roundPoints.filter(x=>x>0).length;if(collectors<=2&&a.trick>4)scores['The Enforcer']+=1;
    scores['The Opportunist']+=acts.length>4?0.5:0;
  }
  const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]); const top=sorted[0]; const confidence=acts.length<3?'Low':top[1]-sorted[1][1]>=3?'High':'Moderate';
  return {persona:top[1]===0?'Insufficient evidence':top[0],confidence,examples:[...new Set(examples)].slice(-2),plays:acts.length};
}
function renderOpponentAnalysis(){const box=$('opponentAnalysis');if(!box||!state.players.length)return;box.innerHTML=state.players.slice(1).map((p,j)=>{const a=inferOpponent(j+1);return `<div class="opponent-card"><h4>${p.name}</h4><div class="confidence">Likely: ${a.persona} · ${a.confidence} confidence · ${a.plays} observed plays</div>${a.examples.length?a.examples.map(e=>`<p class="evidence">• ${e}</p>`).join(''):'<p class="evidence">Not enough distinctive play has occurred yet.</p>'}</div>`}).join('');}
function strategyExecutionSummary(strategy,decisions){
  const matches=decisions.filter(d=>d.matched).length;
  const adherence=decisions.length?matches/decisions.length:0;
  const misses=decisions.filter(d=>!d.matched).slice(-3);
  let focus='';
  if(strategy==='soloMoon') focus='control of every penalty-bearing trick, preservation of entries, and avoidance of any outside scorer';
  if(strategy==='twoMoon') focus='keeping penalty cards within exactly two collectors and protecting the prospective partner from destructive cancellations';
  if(strategy==='avoidance') focus='shedding future winners, preserving exits, and refusing unnecessary point-bearing tricks';
  if(strategy==='targeting') focus='placing points on the intended opponent without taking control at the wrong time';
  if(strategy==='cancellation') focus='using duplicate information to shape the winner rather than creating cancellation for its own sake';
  return {strategy,adherence,decisions:decisions.length,misses,focus};
}
function buildPostGameAnalysis(roundMessage){
  const pivots=state.strategyPivots;
  const original=state.originalStrategy||state.coachStrategy;
  const firstPivot=pivots[0]||null;
  const originalEnd=firstPivot?firstPivot.decisionIndex:state.humanDecisionLog.length;
  const originalDecisions=state.humanDecisionLog.slice(0,originalEnd);
  const originalAssessment=strategyExecutionSummary(original,originalDecisions);
  let pivotAssessment=null;
  if(firstPivot){
    const finalStrategy=state.coachStrategy;
    const lastPivot=pivots[pivots.length-1];
    const pivotDecisions=state.humanDecisionLog.slice(firstPivot.decisionIndex);
    pivotAssessment={...strategyExecutionSummary(finalStrategy,pivotDecisions),from:firstPivot.from,to:finalStrategy,trigger:firstPivot.reason,trick:firstPivot.trick,pivotCount:pivots.length,lastReason:lastPivot.reason};
  }
  const viability=strategyViability(original);
  return {roundMessage,originalAssessment,pivotAssessment,pivotWasNeeded:!viability.viable||!!firstPivot,pivots};
}
function renderAssessmentBlock(title,a,extra=''){
  const pct=Math.round(a.adherence*100);
  return `<div class="post-card"><h4>${title}</h4>${extra}<p><strong>Strategic focus:</strong> ${a.focus}.</p><p><strong>Tactical alignment:</strong> ${a.decisions?pct+'% across '+a.decisions+' recorded decisions':'No recorded player decisions in this phase'}.</p>${a.misses.length?a.misses.map(m=>`<p class="evidence">• Trick ${m.trick}: played ${m.played}; coach preferred ${m.recommended}. ${m.reason}</p>`).join(''):'<p class="evidence">No major tactical deviations were recorded for this phase.</p>'}</div>`;
}
function renderPostGameAnalysis(){
  const box=$('postGameAnalysis');if(!box)return;const a=state.lastPostAnalysis;
  if(!a){box.innerHTML='<p>Analysis will appear when the current hand ends.</p>';return;}
  const originalExtra=`<p><strong>Original strategy:</strong> ${STRATEGY_LABELS[a.originalAssessment.strategy]}</p>`;
  let html=renderAssessmentBlock('Part 1: Execution of the original strategy',a.originalAssessment,originalExtra);
  if(a.pivotAssessment){
    const p=a.pivotAssessment;
    const pivotExtra=`<p><strong>Pivot:</strong> ${STRATEGY_LABELS[p.from]} → ${STRATEGY_LABELS[p.to]} on trick ${p.trick}</p><p><strong>Why the pivot was needed:</strong> ${p.trigger}</p>`;
    html+=renderAssessmentBlock('Part 2: Execution after the pivot',p,pivotExtra);
  } else {
    html+=`<div class="post-card"><h4>Part 2: Pivot assessment</h4><p>${a.pivotWasNeeded?'The original strategy ceased to be viable, but no strategy pivot was recorded. The tactical error was not merely the result; it was continuing to make decisions for a plan whose success condition had already disappeared.':'No pivot was needed. The original strategy remained structurally available through the end of the hand.'}</p></div>`;
  }
  box.innerHTML=html;
}
