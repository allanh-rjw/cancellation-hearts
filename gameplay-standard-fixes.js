// Standard-game engine compatibility layer.
// Keeps legal same-seat double-2♣ states playable without rewriting unrelated game logic.

function gameplayTrickParticipants(){
  return new Set(state.trick.map(x=>x.player));
}

function gameplayActiveSeatCount(){
  const participants=gameplayTrickParticipants();
  return state.players.reduce((count,p,i)=>count+(p.hand.length>0||participants.has(i)?1:0),0);
}

function gameplayTrickComplete(){
  return gameplayTrickParticipants().size>=gameplayActiveSeatCount();
}

function gameplayNextEligibleSeat(start){
  const participants=gameplayTrickParticipants();
  for(let n=0;n<state.players.length;n++){
    const i=(start+n)%state.players.length;
    if(state.players[i].hand.length>0&&!participants.has(i)) return i;
  }
  return null;
}

function gameplayAllHandsEmpty(){
  return state.players.every(p=>p.hand.length===0);
}

// startFirstTrick is not reassigned here: gameplay-rule-invariants.js is the
// sole canonical authority for opening-trick leader resolution and always
// loads after this file, unconditionally overwriting whatever was here.

startTrick=function(){
  state.trick=[];
  state.currentTrickAward=null;
  state.phase='playing';
  state.openingLeadSuit=null;
  const next=gameplayNextEligibleSeat(state.leader);
  if(next===null){
    if(gameplayAllHandsEmpty()) finishRound();
    return;
  }
  state.currentPlayer=next;
  renderAll();
  continueTurn();
};

continueTurn=function(){
  if(gameplayTrickComplete()){
    finishTrick();
    return;
  }
  const next=gameplayNextEligibleSeat(state.currentPlayer);
  if(next===null){
    finishTrick();
    return;
  }
  state.currentPlayer=next;
  renderAll();
  if(state.currentPlayer===0){
    setStatus('Your turn. Choose a legal card.');
    renderHand();
    renderTrickCoach();
    return;
  }
  setStatus(`${state.players[state.currentPlayer].name} is thinking…`);
  setTimeout(()=>{
    const card=chooseAiCard(state.currentPlayer);
    if(!card){
      continueTurn();
      return;
    }
    playCard(state.currentPlayer,card);
  },Math.round(6000/state.playSpeed));
};

function playCardEngine(playerIndex,card){
  if(!card) return;
  const legalNow=legalCards(playerIndex);
  if(!legalNow.some(c=>c.id===card.id)) return;
  const before={trick:state.trick.map(x=>({player:x.player,card:{...x.card},cancelled:x.cancelled})),roundPoints:state.players.map(p=>p.roundPoints),scores:state.players.map(p=>p.score)};
  if(playerIndex===0){
    const rec=rankHumanLegalCards(legalNow)[0];
    const plan=buildHandPathway();
    state.humanDecisionLog.push({trick:state.trickNumber+1,played:cardLabel(card),recommended:rec?cardLabel(rec.card):null,matched:!!rec&&rec.card.id===card.id,strategy:state.coachStrategy,reason:rec?.reason||'',pathwayPhase:plan.phase,immediateObjective:plan.immediate});
  }
  const action={player:playerIndex,card:{...card},trick:state.trickNumber+1,position:state.trick.length,before,round:state.round};
  state.actionLog.push(action);
  if(playerIndex>0){
    const name=state.players[playerIndex].name;
    (state.opponentHistory[name]??=[]).push({...action,playerName:name});
  }
  playCardSound();
  const p=state.players[playerIndex];
  p.hand.splice(p.hand.findIndex(c=>c.id===card.id),1);
  if(heartDiscardBreaks(card,currentLedSuit())) state.heartsBroken=true;
  state.trick.push({player:playerIndex,card,cancelled:false});
  updateCancellation();
  state.currentPlayer=(state.currentPlayer+1)%8;
  if(gameplayTrickComplete()) finishTrick();
  else continueTurn();
}
// playCard is reassigned again below by gameplay-rule-invariants.js (opening
// -trick legality guards) and learning-gateway-runtime.js (evaluate-play
// telemetry); this line just publishes the base engine under the generic
// name in case those files are ever removed from the load order.
playCard=playCardEngine;

// finishTrick is not reassigned here: gameplay-rule-invariants.js is the sole
// authority for the final-cancellation case (splitting unresolved points
// between the highest-ranked cancelling pair, including its own
// practice-mode moon-break check on every award recipient). It intercepts
// that case using the exact same condition this file used to check, so this
// file's old "final-trick leader gets everything" branch could never
// actually run once both files load together in their real order - it was
// confirmed-dead code, removed along with its now-redundant test coverage
// (see verify-rule-invariants.mjs's practice-mode final-cancellation cases).
// The ordinary (non-final-cancellation) trick-resolution path stays owned by
// app.js's original finishTrick, reached via gameplay-rule-invariants.js's
// own delegate-when-not-final-cancellation branch - nothing needs to
// reassign finishTrick at this layer at all anymore.

renderSeats=function(){
  if(!state.players.length) return;
  $('seatMap').innerHTML=state.players.map((p,i)=>{
    const badges=[];
    if(i===state.dealer) badges.push('<span class="badge">Dealer</span>');
    if(i===state.leader&&state.phase!=='passing') badges.push('<span class="badge">Leads</span>');
    if(i===state.currentPlayer&&state.phase==='playing') badges.push('<span class="badge">Turn</span>');
    const played=state.trick.filter(x=>x.player===i);
    const trickScore=currentTrickScoreFor(i);
    const handScore=handScoreBeforeCurrentTrick(i);
    const personaLine=i>0&&state.showPersonas?`<div class="meta persona-seat">${p.persona}</div>`:'';
    const playedHtml=played.length?`<div class="seat-played-card${played.length>1?' multi':''}">${played.map(x=>cardHtml(x.card,x.cancelled?'cancelled':'')).join('')}</div>`:'';
    return `<div class="seat seat-${i} ${i===0?'human':''} ${state.currentPlayer===i&&state.phase==='playing'?'active':''}"><div class="seat-top"><strong>${p.name}</strong><span class="seat-number">SEAT ${i+1}</span></div>${personaLine}<div class="seat-scores"><span><b>Trick</b> ${trickScore}</span><span><b>Hand</b> ${handScore}</span></div><div class="meta">${p.hand.length} cards</div><div class="badges">${badges.join('')}</div>${playedHtml}</div>`;
  }).join('');
};

renderTrick=function(){
  const carry=state.carryoverPoints?` · ${state.carryoverPoints} carried point${state.carryoverPoints===1?'':'s'} at stake`:'';
  if(!state.trick.length&&!state.carryoverPoints){
    $('trick').innerHTML='';
    return;
  }
  const seats=gameplayTrickParticipants().size;
  const active=gameplayActiveSeatCount();
  const physical=state.trick.length;
  const physicalNote=physical!==seats?` · ${physical} physical cards`:'';
  $('trick').innerHTML=`<div class="trick-summary">${seats} of ${active} active seats contributed${physicalNote}${carry}</div>`;
};

// Put between-trick controls outside the table ring entirely. Moving the
// existing buttons preserves their event handlers while giving them a real
// protected action zone rather than another arbitrary offset among the cards.
(()=>{
  const info=document.querySelector('.round-info');
  if(info&&!document.getElementById('gameActionZone')){
    const zone=document.createElement('div');
    zone.id='gameActionZone';
    zone.className='game-action-zone';
    zone.append($('nextTrickBtn'),$('nextRoundBtn'));
    info.append(zone);
  }

  const style=document.createElement('style');
  style.id='standard-gameplay-fixes-style';
  style.textContent=`
    .round-info{
      display:grid!important;
      grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);
      align-items:center;
      gap:10px;
    }
    .round-info>div:nth-child(1){grid-column:1;grid-row:1}
    .round-info>div:nth-child(2){grid-column:3;grid-row:1;text-align:right}
    .game-action-zone{grid-column:2;grid-row:1;display:flex;justify-content:center;gap:8px;min-width:132px}
    .game-action-zone #nextTrickBtn,.game-action-zone #nextRoundBtn{
      position:static;
      transform:none;
      z-index:auto;
      min-width:132px;
      margin:0;
      box-shadow:0 6px 16px rgba(0,0,0,.28);
    }
    .seat-played-card.multi{display:flex;gap:4px;align-items:center}
    .seat-played-card.multi .card{position:relative}
    @container game-table (max-width:1050px){
      .seat-played-card.multi{gap:2px}
      .seat-played-card.multi .card{width:clamp(46px,6.2cqw,64px)}
    }
    @media(max-width:820px){
      .round-info{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}
      .game-action-zone #nextTrickBtn,.game-action-zone #nextRoundBtn{min-width:122px;padding:8px 10px}
    }
    @media(max-width:620px){
      .round-info{display:flex!important;flex-direction:column;align-items:stretch;gap:6px}
      .round-info>div:nth-child(2){text-align:left}
      .game-action-zone{width:100%;display:flex;justify-content:center}
      .game-action-zone #nextTrickBtn,.game-action-zone #nextRoundBtn{min-width:140px}
      .seat-played-card.multi{justify-content:center}
    }
  `;
  document.head.appendChild(style);
})();

// BELIEF-AWARE OPPONENT POLICY START
// Hidden-information policy overlay for Standard play. It may inspect the
// acting CPU's hand plus public evidence, but never another player's hand.
const beliefAwarePassEvidence=new Map();
const beliefAwareBaseChoosePassCards=choosePassCards;
const beliefAwareBaseChooseAiCard=chooseAiCard;
const beliefAwareCloneCard=card=>({id:card.id,suit:card.suit,rank:card.rank});

choosePassCards=function(player){
  const chosen=beliefAwareBaseChoosePassCards(player);
  const seat=state.players.indexOf(player);
  if(state.mode==='standard'&&seat>=0&&state.passOffset){
    beliefAwarePassEvidence.set(seat,{round:state.round,offset:state.passOffset,cards:chosen.map(beliefAwareCloneCard)});
  }
  return chosen;
};

function beliefAwareObservedState(observerSeat){
  const actions=state.actionLog.filter(action=>action.round===state.round);
  const ownCards=state.players[observerSeat].hand.map(beliefAwareCloneCard);
  const ownIds=new Set(ownCards.map(card=>card.id));
  const played=new Map(actions.map(action=>[action.card.id,{seat:action.player,card:beliefAwareCloneCard(action.card)}]));
  const voids=Array.from({length:state.players.length},()=>new Set());
  const handSizes=Array(state.players.length).fill(13);
  const ledByTrick=new Map();
  for(const action of actions){
    handSizes[action.player]=Math.max(0,handSizes[action.player]-1);
    const fromBefore=action.before?.trick?.[0]?.card?.suit;
    if(fromBefore)ledByTrick.set(action.trick,fromBefore);
    else if(action.position===0&&!ledByTrick.has(action.trick))ledByTrick.set(action.trick,action.card.suit);
    const led=ledByTrick.get(action.trick);
    if(led&&action.card.suit!==led)voids[action.player].add(led);
  }
  handSizes[observerSeat]=ownCards.length;
  const knownHolders=[];
  const pass=beliefAwarePassEvidence.get(observerSeat);
  if(pass?.round===state.round&&pass.offset){
    const recipient=(observerSeat+pass.offset+state.players.length)%state.players.length;
    for(const card of pass.cards){
      if(!played.has(card.id)&&!ownIds.has(card.id))knownHolders.push({seat:recipient,card});
    }
  }
  return {observerSeat,ownCards,played,voids,handSizes,knownHolders};
}

function beliefAwareCardLocation(belief,suit,rank){
  const own=belief.ownCards.filter(card=>card.suit===suit&&card.rank===rank).length;
  const played=[...belief.played.values()].filter(x=>x.card.suit===suit&&x.card.rank===rank);
  const known=belief.knownHolders.filter(x=>x.card.suit===suit&&x.card.rank===rank);
  const unknownCopies=Math.max(0,2-own-played.length-known.length);
  const possibleSeats=[];
  for(let seat=0;seat<belief.handSizes.length&&unknownCopies;seat++){
    if(seat===belief.observerSeat||belief.handSizes[seat]===0||belief.voids[seat].has(suit))continue;
    possibleSeats.push(seat);
  }
  const capacity=possibleSeats.reduce((sum,seat)=>sum+belief.handSizes[seat],0);
  const seatProbabilities=Object.fromEntries(possibleSeats.map(seat=>[seat,capacity?belief.handSizes[seat]/capacity:1/possibleSeats.length]));
  return {suit,rank,own,played:played.map(x=>x.seat),knownHolders:known.map(x=>x.seat),unknownCopies,possibleSeats,seatProbabilities};
}

function beliefAwareFutureSeats(observerSeat,belief){
  const acted=new Set(state.trick.map(x=>x.player));
  acted.add(observerSeat);
  return belief.handSizes.map((count,seat)=>({count,seat})).filter(x=>x.count>0&&!acted.has(x.seat)).map(x=>x.seat);
}

function beliefAwareProbabilityAtSeats(location,seats){
  const target=new Set(seats);
  if(location.knownHolders.some(seat=>target.has(seat)))return 1;
  const oneCopyMass=Object.entries(location.seatProbabilities).reduce((sum,[seat,p])=>sum+(target.has(Number(seat))?p:0),0);
  return 1-Math.pow(1-oneCopyMass,location.unknownCopies);
}

function beliefAwareSeatProbability(location,seat){
  if(location.knownHolders.includes(seat))return 1;
  return Math.min(1,(location.seatProbabilities[seat]??0)*location.unknownCopies);
}

function beliefAwareProjectedWinner(observerSeat,card){
  const trick=[...state.trick.map(x=>({player:x.player,card:x.card})),{player:observerSeat,card}];
  const led=trick[0]?.card.suit;
  if(!led)return null;
  const counts=new Map();
  for(const play of trick){
    const key=`${play.card.suit}${play.card.rank}`;
    counts.set(key,(counts.get(key)??0)+1);
  }
  const eligible=trick.filter(play=>play.card.suit===led&&counts.get(`${play.card.suit}${play.card.rank}`)===1);
  return eligible.length?eligible.reduce((best,play)=>RANK_VALUE[play.card.rank]>RANK_VALUE[best.card.rank]?play:best).player:null;
}

function beliefAwareHigherPressure(card,belief,futureSeats){
  let survival=1;
  for(const [rank,value] of Object.entries(RANK_VALUE)){
    if(value<=RANK_VALUE[card.rank])continue;
    const location=beliefAwareCardLocation(belief,card.suit,rank);
    survival*=1-beliefAwareProbabilityAtSeats(location,futureSeats);
  }
  return 1-survival;
}

function beliefAwareDecisionAdjustment(observerSeat,card,belief){
  const scale={medium:.35,hard:.7,expert:1}[state.difficulty]??0;
  if(!scale||state.mode!=='standard')return 0;
  const futureSeats=beliefAwareFutureSeats(observerSeat,belief);
  const led=state.trick[0]?.card.suit??card.suit;
  const winner=beliefAwareProjectedWinner(observerSeat,card);
  const winsNow=winner===observerSeat;
  const loaded=state.carryoverPoints+state.trick.reduce((sum,x)=>sum+cardPoints(x.card),0)+cardPoints(card);
  const matching=beliefAwareCardLocation(belief,card.suit,card.rank);
  const cancelChance=beliefAwareProbabilityAtSeats(matching,futureSeats);
  const higherChance=card.suit===led?beliefAwareHigherPressure(card,belief,futureSeats):0;
  const queenFuture=beliefAwareProbabilityAtSeats(beliefAwareCardLocation(belief,'S','Q'),futureSeats);
  const futureVoidRate=futureSeats.length?futureSeats.filter(seat=>belief.voids[seat].has(card.suit)).length/futureSeats.length:0;
  let score=0;

  if(winsNow){
    score+=higherChance*(loaded>0?7:2.5);
    score+=cancelChance*(loaded>0?4:1.5);
    score-=(1-Math.max(higherChance,cancelChance))*(loaded>0?5:1);
    if(card.suit==='S'&&['A','K'].includes(card.rank))score-=queenFuture*(loaded>0?11:7);
  }else if(cardPoints(card)>0){
    score+=2;
  }

  if(state.trick.length===0){
    const height=Math.max(0,(RANK_VALUE[card.rank]-8)/6);
    score-=height*futureVoidRate*4;
    if(card.suit==='S'&&['A','K'].includes(card.rank))score-=queenFuture*5;
  }

  if(winner!==null&&winner!==observerSeat&&loaded>0){
    const collectors=state.players.map((player,seat)=>({seat,points:player.roundPoints})).filter(x=>x.points>0);
    const target=collectors.find(x=>x.seat===winner);
    if(target&&collectors.length<=2&&(state.trickNumber>=2||target.points>=10)){
      const control=Math.min(1,
        beliefAwareSeatProbability(beliefAwareCardLocation(belief,'S','A'),winner)+
        beliefAwareSeatProbability(beliefAwareCardLocation(belief,'S','K'),winner));
      score-=2+5*control;
    }
  }
  return Math.max(-12,Math.min(12,score))*scale;
}

const beliefAwareControl=window.__opponentBeliefAware??{};
Object.assign(beliefAwareControl,{
  enabled:beliefAwareControl.enabled!==false,
  inspectCard:(seat,suit,rank)=>beliefAwareCardLocation(beliefAwareObservedState(seat),suit,rank),
  snapshot:seat=>{
    const belief=beliefAwareObservedState(seat);
    return {observerSeat:seat,knownVoids:Object.fromEntries(belief.voids.map((set,i)=>[i,[...set]])),handSizes:[...belief.handSizes]};
  },
  lastDecision:null
});
window.__opponentBeliefAware=beliefAwareControl;

chooseAiCard=function(i){
  if(state.mode!=='standard'||state.difficulty==='easy'||!beliefAwareControl.enabled)return beliefAwareBaseChooseAiCard(i);
  const legal=legalCards(i),player=state.players[i],profile=difficultyProfile(),plan=opponentStrategyPlan(i),belief=beliefAwareObservedState(i);
  const ranked=legal.map(card=>{
    const base=evaluateCard(i,card,player.persona)+practiceDefenseAdjustment(i,card)+standardTacticalAdjustment(i,card)+opponentStrategyAdjustment(i,card,plan)+opponentPathwayAdjustment(i,card,plan)+futureHandScore(i,card)+scoreAwareAdjustment(i,card)+advancedInferenceAdjustment(i,card);
    const beliefScore=beliefAwareDecisionAdjustment(i,card,belief);
    return {c:card,s:base+beliefScore,base,belief:beliefScore};
  }).sort((a,b)=>b.s-a.s);
  let chosen,reason='belief-top-ranked';
  if(profile.blunder&&Math.random()<profile.blunder){chosen=ranked[Math.min(1,ranked.length-1)].c;reason='belief-difficulty-blunder';}
  else if(ranked.length>1&&ranked[0].s-ranked[1].s<profile.noise&&Math.random()<.22){chosen=ranked[1].c;reason='belief-close-score-noise';}
  else chosen=ranked[0].c;
  beliefAwareControl.lastDecision={seat:i,reason,chosen:chosen.id,ranked:ranked.map(x=>({id:x.c.id,base:x.base,belief:x.belief,total:x.s}))};
  traceOpponentDecision(i,legal,ranked,chosen,reason,plan);
  return chosen;
};
// BELIEF-AWARE OPPONENT POLICY END
