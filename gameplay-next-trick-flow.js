// Controls the pause between completed tricks without changing gameplay rules.
// Coach open: wait for the learner to press Next trick.
// Coach closed: advance automatically after three seconds.
(function installNextTrickFlow(){
  if(window.__cancellationHeartsNextTrickFlow?.installed)return;

  const AUTO_ADVANCE_MS=3000;
  const nextTrickBtn=$('nextTrickBtn');
  const coachPanel=$('coachPanel');
  const coachBtn=$('coachBtn');
  const closeCoachBtn=$('closeCoachBtn');
  let pendingTimer=null;

  const coachOpen=()=>!coachPanel.classList.contains('hidden');
  const betweenPlayableTricks=()=>state.phase==='trick-end'&&state.trickNumber<13&&!state.gameOver&&!state.practiceEnded;

  function clearAutoAdvance(){
    if(pendingTimer!==null)clearTimeout(pendingTimer);
    pendingTimer=null;
  }

  function showManualAdvance(){
    clearAutoAdvance();
    if(betweenPlayableTricks())nextTrickBtn.classList.remove('hidden');
    else nextTrickBtn.classList.add('hidden');
  }

  function scheduleAutoAdvance(){
    clearAutoAdvance();
    nextTrickBtn.classList.add('hidden');
    if(!betweenPlayableTricks())return;
    const completedTrickNumber=state.trickNumber;
    pendingTimer=setTimeout(()=>{
      pendingTimer=null;
      if(!betweenPlayableTricks()||state.trickNumber!==completedTrickNumber)return;
      if(coachOpen()){
        nextTrickBtn.classList.remove('hidden');
        return;
      }
      startTrick();
    },AUTO_ADVANCE_MS);
  }

  function syncTransition(){
    if(!betweenPlayableTricks()){
      clearAutoAdvance();
      nextTrickBtn.classList.add('hidden');
      return;
    }
    if(coachOpen())showManualAdvance();
    else scheduleAutoAdvance();
  }

  const baseFinishTrick=finishTrick;
  finishTrick=function(...args){
    const previousTrickNumber=state.trickNumber;
    const result=baseFinishTrick.apply(this,args);
    if(state.phase==='trick-end'&&state.trickNumber>previousTrickNumber&&state.trickNumber<13)syncTransition();
    else if(state.phase!=='trick-end'||state.trickNumber>=13){
      clearAutoAdvance();
      nextTrickBtn.classList.add('hidden');
    }
    return result;
  };

  const baseNextTrickClick=nextTrickBtn.onclick;
  nextTrickBtn.onclick=function(event){
    clearAutoAdvance();
    return baseNextTrickClick?.call(this,event);
  };

  const baseOpenCoachClick=coachBtn.onclick;
  coachBtn.onclick=function(event){
    const result=baseOpenCoachClick?.call(this,event);
    if(betweenPlayableTricks())showManualAdvance();
    return result;
  };

  const baseCloseCoachClick=closeCoachBtn.onclick;
  closeCoachBtn.onclick=function(event){
    const result=baseCloseCoachClick?.call(this,event);
    if(betweenPlayableTricks())scheduleAutoAdvance();
    return result;
  };

  window.__cancellationHeartsNextTrickFlow=Object.freeze({
    installed:true,
    AUTO_ADVANCE_MS,
    coachOpen,
    syncTransition,
    hasPendingAutoAdvance:()=>pendingTimer!==null
  });
})();
