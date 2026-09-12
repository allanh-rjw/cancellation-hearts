(()=>{
  const originalStartFirstTrick=startFirstTrick;
  startFirstTrick=function(){
    // The opening rule requires both 2♣ cards to be prelaid while preserving
    // one-card-per-seat trick progression. If passing leaves both copies in
    // one hand, normalize the copies across seats before the opening begins.
    ensureTwoClubsSeparated();
    state.players.forEach(player=>sortHand(player.hand));
    return originalStartFirstTrick();
  };

  const originalFinishTrick=finishTrick;
  finishTrick=function(){
    // A no-winner trick normally carries its pot forward and retains the same
    // leader. On trick 13 there is no later trick, so resolve that retained pot
    // to the retained leader rather than stranding points outside hand scoring.
    if(state.trickNumber===12){
      const led=currentLedSuit();
      const eligible=state.trick.filter(x=>x.card.suit===led&&!x.cancelled);
      if(!eligible.length){
        const retainedLeader=state.leader;
        const currentPoints=state.trick.reduce((sum,x)=>sum+cardPoints(x.card),0);
        const carried=state.carryoverPoints;
        const points=currentPoints+carried;
        state.currentTrickAward={winner:retainedLeader,points,carried,terminalCarry:true};
        state.players[retainedLeader].roundPoints+=points;
        state.players[retainedLeader].tricks.push(...state.carryoverCards,...state.trick.map(x=>x.card));
        state.carryoverPoints=0;
        state.carryoverCards=[];
        renderTrickCoach();
        state.trickNumber++;
        state.phase='trick-end';
        setStatus(`The led suit cancelled completely on the final trick. ${state.players[retainedLeader].name}, who retained the lead, collects the ${points} unresolved point${points===1?'':'s'}.`);
        renderAll();
        if(state.mode==='practice' && practiceShootBroken(retainedLeader,points)){
          endBrokenPractice(retainedLeader,points);
          return;
        }
        setTimeout(finishRound,350);
        return;
      }
    }
    return originalFinishTrick();
  };

  const originalFinishRound=finishRound;
  finishRound=function(){
    if(state.mode!=='practice') return originalFinishRound();

    const shooters=practiceShooters();
    const scorers=state.players.map((p,i)=>({i,pts:p.roundPoints})).filter(x=>x.pts>0);
    const successfulMoon=state.practiceType==='solo'
      ? scorers.length===1 && scorers[0].i===0 && scorers[0].pts===52
      : scorers.length===2 && scorers.every(x=>shooters.has(x.i)) && scorers.reduce((sum,x)=>sum+x.pts,0)===52;
    const startingRound=state.round;
    const startingDealer=state.dealer;

    const result=originalFinishRound();
    state.round=startingRound;
    state.dealer=startingDealer;
    state.practiceEnded=true;
    state.gameOver=true;
    state.phase='practice-end';
    $('nextTrickBtn').classList.add('hidden');
    $('nextRoundBtn').classList.add('hidden');
    const target=state.practiceType==='solo'?'solo moon':'two-player moon';
    const message=successfulMoon
      ? (state.practiceType==='solo'
        ? 'Solo moon completed. You captured all 52 penalty points. Practice complete.'
        : 'Two-player moon completed. You and Partner captured all 52 penalty points. Practice complete.')
      : `The ${target} was not completed before the hand ended. Practice complete.`;
    setStatus(message);
    state.lastPostAnalysis=buildPostGameAnalysis(message);
    renderPostHandAnalysis();
    renderPostGameAnalysis();
    renderOpponentAnalysis();
    renderAll();
    return result;
  };

  const rules=document.querySelector('.rules-copy');
  if(rules&&!rules.textContent.includes('final trick has no winner')){
    const p=document.createElement('p');
    p.textContent='If the final trick has no winner because every card in the led suit cancels, the unresolved carried points go to the player who retained the lead into that trick.';
    rules.appendChild(p);
  }
})();
