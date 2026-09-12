// QA-only runtime patch used to validate gameplay hypotheses and expose state
// before the production implementation is changed.

function qaTrickParticipants(){ return new Set(state.trick.map(x=>x.player)); }
function qaTrickParticipantCount(){ return qaTrickParticipants().size; }
function qaEligibleSeatCount(){
  const participants=qaTrickParticipants();
  return state.players.reduce((count,p,i)=>count+(p.hand.length>0||participants.has(i)?1:0),0);
}
function qaTrickComplete(){ return qaTrickParticipantCount()>=qaEligibleSeatCount(); }
function qaNextPlayableSeat(start){
  const participants=qaTrickParticipants();
  for(let n=0;n<8;n++){
    const i=(start+n)%8;
    if(state.players[i].hand.length>0&&!participants.has(i)) return i;
  }
  return null;
}
function qaHandsEmpty(){ return state.players.every(p=>p.hand.length===0); }

const qaOriginalChooseAiCard=chooseAiCard;
chooseAiCard=function(i){
  const legal=legalCards(i);
  if(!legal.length){
    const trick=state.trick.map(x=>`${x.player}:${x.card?.rank}${x.card?.suit}${x.prelaid?'*':''}`).join('|');
    throw new Error(`QA_NO_LEGAL_CARD seat=${i}; phase=${state.phase}; current=${state.currentPlayer}; trickNumber=${state.trickNumber}; trickLength=${state.trick.length}; participants=${qaTrickParticipantCount()}; eligible=${qaEligibleSeatCount()}; hands=${state.players.map(p=>p.hand.length).join(',')}; openingAuto=${[...state.openingAutoPlayers].join(',')}; openingLead=${state.openingLeadSuit}; leader=${state.leader}; dealer=${state.dealer}; trick=${trick}`);
  }
  return qaOriginalChooseAiCard(i);
};

startTrick = function(){
  state.trick=[]; state.currentTrickAward=null; state.phase='playing'; state.openingLeadSuit=null;
  const next=qaNextPlayableSeat(state.leader);
  if(next===null){ finishRound(); return; }
  state.currentPlayer=next;
  renderAll();
  continueTurn();
};

continueTurn = function(){
  if(qaTrickComplete()){
    finishTrick();
    return;
  }
  const next=qaNextPlayableSeat(state.currentPlayer);
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
    playCard(state.currentPlayer,card);
  },Math.round(6000/state.playSpeed));
};

playCard = function(playerIndex,card){
  if(!card) throw new Error(`Attempted to play an undefined card for seat ${playerIndex}`);
  const legalNow=legalCards(playerIndex);
  if(!legalNow.some(c=>c.id===card.id)) return;
  const before={trick:state.trick.map(x=>({player:x.player,card:{...x.card},cancelled:x.cancelled})), roundPoints:state.players.map(p=>p.roundPoints), scores:state.players.map(p=>p.score)};
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
  if(state.trickNumber===0 && !state.openingLeadSuit) state.openingLeadSuit=card.suit;
  if(card.suit==='H' && currentLedSuit()) state.heartsBroken=true;
  state.trick.push({player:playerIndex,card,cancelled:false});
  updateCancellation();
  state.currentPlayer=(state.currentPlayer+1)%8;
  if(qaTrickComplete()) finishTrick();
  else continueTurn();
};

const qaOriginalFinishTrick=finishTrick;
finishTrick=function(){
  qaOriginalFinishTrick();
  // The production code ends after a hard-coded 13 tricks. During QA, ensure
  // the only valid completed-hand state is that all 104 physical cards are gone.
  if(state.phase==='trick-end'&&state.trickNumber>=13&&!qaHandsEmpty()){
    throw new Error(`QA_ROUND_ENDED_WITH_CARDS hands=${state.players.map(p=>p.hand.length).join(',')}; trickNumber=${state.trickNumber}`);
  }
};

renderTrick = function(){
  const carry=state.carryoverPoints?` · ${state.carryoverPoints} carried point${state.carryoverPoints===1?'':'s'} at stake`:'';
  if(!state.trick.length&&!state.carryoverPoints){
    $('trick').innerHTML='';
    return;
  }
  const seats=qaTrickParticipantCount();
  const physical=state.trick.length;
  const eligible=qaEligibleSeatCount();
  const physicalNote=physical!==seats?` · ${physical} physical cards because one seat held both 2♣ cards`:'';
  $('trick').innerHTML=`<div class="trick-summary">${seats} of ${eligible} active seats contributed${physicalNote}${carry}</div>`;
};
