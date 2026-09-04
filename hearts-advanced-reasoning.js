(function(){
  const adapter=window.CancellationHeartsTutorAdapter;
  if(!adapter||adapter.__me20AdvancedInstalled)return;
  const originalSelect=adapter.selectExercise.bind(adapter);
  const originalEvaluate=adapter.evaluate.bind(adapter);
  const ADVANCED_PROMPTS={
    threat:{question:'What opponent behavior could force you to modify this plan? Name the threat and the evidence that would make it serious enough to act on.',fallback:['A player begins collecting hearts and still appears to have control','Any player wins one trick','Someone leads a suit I dislike','The current leader changes']},
    pivot:{question:'If that threat appears, what is the smallest intervention that would stop it while preserving as much of your original pathway as possible?',fallback:['Make the minimum play needed to break the threat, then return to the original plan','Abandon the whole plan immediately','Take every remaining trick','Ignore the threat']},
    observe:{question:'Before targeting anyone, what specific evidence would you want to see about another player’s hand or constraints?',fallback:['A demonstrated void, exposed high cards, loss of protection, or repeated forced wins','Only their current score','Whether they played quickly','Whether they won the previous hand']},
    target:{question:'Under what conditions would targeting a specific player become strategically worthwhile, and what would make you decide not to target them?',fallback:['Target only when their demonstrated constraints make the play likely to work and the score situation justifies it','Always target the current leader','Target anyone who takes a point','Never target anyone']}
  };
  const SKILLS={threat:['hearts.threat_detection','causal_planning.contingency_revision'],pivot:['hearts.minimum_intervention','causal_planning.contingency_revision'],observe:['hearts.information_targeting','causal_planning.evidence_seeking'],target:['hearts.smart_targeting','causal_planning.opponent_constraint_reasoning']};
  function txt(response){return String(response?.text||response?.choice||'').toLowerCase();}
  function diagnosis(id,t){
    if(id==='threat'){
      const moon=/moon|all (the )?hearts|collect.*heart|taking.*heart|q.?s|queen of spades/.test(t), evidence=/if|when|after|until|see|shows?|wins?|keeps?|continues?|controls?|void/.test(t);
      if(moon&&evidence)return {recognized:'You identified a concrete table-level threat and tied intervention to evidence rather than reacting to one isolated trick.'};
      return {recognized:'You are considering what another player could do to disrupt your plan.',missing:moon?'Specify what evidence would make that threat credible enough to act on.':'Name the specific threat, such as a developing moon attempt, that could justify changing your plan.',nextQuestion:'What would you need to observe before you would actually intervene?'};
    }
    if(id==='pivot'){
      const minimal=/minimum|smallest|one heart|break|stop|intervene|only enough|without.*abandon|return.*plan|preserv/.test(t);
      if(minimal)return {recognized:'You are protecting the original pathway by looking for the smallest intervention that solves the new threat.'};
      return {recognized:'You are thinking about how to respond if the original plan is disrupted.',missing:'The pivot should solve the threat without sacrificing more of the original pathway than necessary.',nextQuestion:'What is the least costly play that would break the threat and still leave your original plan usable?'};
    }
    if(id==='observe'){
      const evidence=/void|failed to follow|cannot follow|high card|queen|protect|forced win|keeps winning|exposed|cancellation|duplicate/.test(t);
      if(evidence)return {recognized:'You named observable evidence that can reveal an opponent’s constraints before committing to a target.'};
      return {recognized:'You are looking for information before choosing a target.',missing:'Use evidence from play, not just the scoreboard.',nextQuestion:'What demonstrated void, exposed rank, lost protection, or forced-win pattern would make the target vulnerable?'};
    }
    if(id==='target'){
      const conditional=/if|when|only|unless|provided|score|void|exposed|forced|likely|risk|otherwise|not target/.test(t);
      if(conditional)return {recognized:'You made targeting conditional on both vulnerability and strategic value instead of choosing a victim in advance.'};
      return {recognized:'You are considering whether pressure on another player would help.',missing:'Targeting should depend on evidence that the play is likely to work and that the score payoff justifies the risk.',nextQuestion:'What exact evidence would make you target that player, and what evidence would make you leave them alone?'};
    }
    return null;
  }
  adapter.selectExercise=function(profile){
    const ex=originalSelect(profile);
    return {...ex,prompts:{...(ex.prompts||{}),...ADVANCED_PROMPTS}};
  };
  adapter.evaluate=function(step,response,context,profile){
    if(!ADVANCED_PROMPTS[step?.id])return originalEvaluate(step,response,context,profile);
    const t=txt(response),d=diagnosis(step.id,t)||{};
    const complete=Boolean(d.recognized&&!d.missing&&!d.nextQuestion);
    return {score:complete?.9:.58,skills:SKILLS[step.id],flags:[],gradeable:true,diagnosis:d};
  };
  adapter.__me20AdvancedInstalled=true;
})();
