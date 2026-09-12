(function(){
  const adapter=window.CancellationHeartsTutorAdapter;
  if(!adapter||adapter.__pathwayConsistencyWrapped)return;
  const original=adapter.evaluate.bind(adapter);
  function textOf(response){return String(response?.text||response?.reasoning||response?.choice||'').toLowerCase();}
  function merge(result,patch){return {...result,...patch,diagnosis:{...(result?.diagnosis||{}),...(patch.diagnosis||{})}};}
  function hasSpecificQueenDanger(t){return /(q\s*♠|qs\b|queen of spades|q\s*♥|qh\b|queen of hearts|10\s*♥|10h\b|ten of hearts|q\s*♣|qc\b|queen of clubs|10\s*♦|10d\b|ten of diamonds)/i.test(t);}
  function statesFutureWinnerObjective(t){return /(avoid|prevent|keep).*?(forced|future).*winner|(?:forced|future).*winner.*?(avoid|prevent|keep)|not.*becom.*winner/i.test(t);}
  function contradictoryControl(t){const off=/(stay|remain|keep).*off lead|off lead|do not want.*lead|don't want.*lead/i.test(t);const take=/(take|gain|win).*control|(take|gain|win).*lead|want (?:to )?(?:take|gain|win).*control|want (?:to )?(?:take|gain|win).*lead|want the lead|want to lead\b/i.test(t);const conditional=/\b(if|once|after|when|only if|until|unless)\b/i.test(t);const concreteFollowUp=/(lead|play).*(5c|5♣|2s|2♠|9s|9♠|6h|6♥|7h|7♥)|create.*void|spade round|heart round|disposal route/i.test(t);return off&&take&&!conditional&&!concreteFollowUp;}
  adapter.evaluate=function(step,response,ctx,profile){
    const result=original(step,response,ctx,profile)||{};
    const id=step?.id,exercise=ctx?.exercise||{},t=textOf(response);
    if(exercise.id==='guided-queen-protection'&&id==='objective'&&statesFutureWinnerObjective(t)&&!hasSpecificQueenDanger(t)){
      return merge(result,{score:Math.min(Number(result.score)||.58,.58),gradeable:false,flags:[...new Set([...(result.flags||[]),'objective-stated-danger-not-identified'])],diagnosis:{recognized:'You stated the hand-level objective: prevent dangerous cards from becoming forced winners later.',missing:'You have not yet identified which specific cards in this hand create that danger.',ambiguous:null,incorrect:null,correction:null,nextQuestion:'Which specific cards in this hand are you trying to keep from becoming forced winners?'}});
    }
    if(id==='control'&&contradictoryControl(t)){
      return merge(result,{score:Math.min(Number(result.score)||.35,.35),gradeable:true,flags:[...new Set([...(result.flags||[]),'contradictory-control-state'])],diagnosis:{recognized:'You named both staying off lead and taking control as the immediate plan.',incorrect:'Those are conflicting current control states unless you identify the state change that separates them.',correction:'Choose the control state you want now, or state the condition that would make you switch later.',missing:'The pathway needs one current control state plus a trigger or concrete follow-up for any later change.',ambiguous:null,nextQuestion:'Do you want to stay off lead now, or take control now? If you intend to switch later, what exact condition causes that pivot?'}});
    }
    return result;
  };
  adapter.__pathwayConsistencyWrapped=true;
})();
