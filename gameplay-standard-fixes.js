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

startFirstTrick=function(){
  state.phase='playing';
  state.trickNumber=0;
  const nominalLeader=(state.dealer+1)%8;
  state.leader=nominalLeader;
  state.currentPlayer=nominalLeader;
  state.trick=[];
  state.openingAutoPlayers=new Set();
  state.openingLeadSuit=null;

  state.players.forEach((p,i)=>{
    const twos=p.hand.filter(c=>c.suit==='C'&&c.rank==='2');
    for(const card of twos){
      p.hand.splice(p.hand.findIndex(x=>x.id===card.id),1);
      state.trick.push({player:i,card,cancelled:false,prelaid:true});
      state.openingAutoPlayers.add(i);
    }
  });
  updateCancellation();

  const actual=gameplayNextEligibleSeat(nominalLeader);
  if(actual===null){
    finishTrick();
    return;
  }
  state.currentPlayer=actual;
  renderAll();
  setStatus(`Both 2♣ cards are down. ${state.players[actual].name}, the next eligible player clockwise from the dealer, leads the first playable card.`);
  continueTurn();
};

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

playCard=function(playerIndex,card){
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
  if(state.trickNumber===0&&!state.openingLeadSuit){
    state.openingLeadSuit=card.suit;
    state.leader=playerIndex;
  }
  if(card.suit==='H'&&currentLedSuit()) state.heartsBroken=true;
  state.trick.push({player:playerIndex,card,cancelled:false});
  updateCancellation();
  state.currentPlayer=(state.currentPlayer+1)%8;
  if(gameplayTrickComplete()) finishTrick();
  else continueTurn();
};

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
