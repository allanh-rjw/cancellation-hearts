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
      const moon=/moon|all (the )?hearts|collect.*heart|taking.*heart|q.?s|queen of spades/.test(t);
      const carryover=/carry|carried|penalty pot|jackpot|points.*waiting/.test(t);
      const repeated=/several|multiple|across .*trick|keeps? (?:collecting|taking|winning)|continues? (?:collecting|taking|winning)|still (?:controls?|has control|on lead)|again and again|repeated/.test(t);
      const control=/control|lead|on lead/.test(t);
      const oneTrickOnly=/as soon as|one heart trick|a single trick|anyone wins one|one trick/.test(t)&&!repeated;
      if(oneTrickOnly&&moon)return {recognized:'You noticed a possible moon signal.',incorrect:'One penalty trick by itself is weak evidence. Intervening immediately can sacrifice your own pathway for a threat that may not exist.',missing:'Wait for accumulating evidence such as repeated penalty capture plus continued control or unusual strength.',nextQuestion:'What repeated behavior would make the moon threat credible rather than merely possible?'};
      if(moon&&repeated&&control)return {recognized:'You identified a credible moon threat using accumulating evidence: repeated penalty capture together with continued control.'};
      if(carryover&&control)return {recognized:'You recognized that a large carryover pot raises the cost of waiting when the same player still controls play, so the intervention threshold can rationally change.'};
      return {recognized:'You are considering what another player could do to disrupt your plan.',missing:moon?'Specify accumulating evidence that would make the moon threat credible enough to act on.':carryover?'Tie the carryover danger to who can actually control or capture the loaded trick.':'Name the specific table-level threat and the evidence that would justify changing your plan.',nextQuestion:'What would you need to observe over the next tricks before you would actually intervene?'};
    }
    if(id==='pivot'){
      const minimal=/minimum|smallest|one heart|break|stop|intervene|only enough|without.*abandon|return.*plan|return.*path|preserv/.test(t),overreact=/every remaining trick|take every|win everything|abandon.*whole|abandon.*entire/.test(t);
      if(overreact)return {recognized:'You are trying to guarantee the threat is stopped.',incorrect:'Taking over the whole hand is usually more intervention than necessary and can destroy the original avoidance pathway.',missing:'Find the smallest play that ensures someone else captures at least one penalty card or otherwise makes the moon impossible.',nextQuestion:'What single minimum intervention would break the threat while leaving your original pathway usable?'};
      if(minimal)return {recognized:'You are protecting the original pathway by looking for the smallest intervention that solves the new threat.'};
      return {recognized:'You are thinking about how to respond if the original plan is disrupted.',missing:'The pivot should solve the threat without sacrificing more of the original pathway than necessary.',nextQuestion:'What is the least costly play that would break the threat and still leave your original plan usable?'};
    }
    if(id==='observe'){
      const evidence=/void|failed to follow|cannot follow|high card|queen|protect|forced win|keeps winning|exposed|cancellation|duplicate/.test(t),scoreOnly=/only.*score|scoreboard.*alone|most points.*alone/.test(t);
      if(scoreOnly)return {recognized:'The scoreboard can tell you whether targeting someone would be valuable.',incorrect:'Score does not establish that the player is vulnerable to a particular suit or pressure line.',missing:'You still need evidence from the cards actually played.',nextQuestion:'What demonstrated void, exposed rank, lost protection, cancellation pattern, or forced win would show that this player can actually be trapped?'};
      if(evidence)return {recognized:'You named observable evidence that can reveal an opponent’s constraints before committing to a target.'};
      return {recognized:'You are looking for information before choosing a target.',missing:'Use evidence from play, not just the scoreboard.',nextQuestion:'What demonstrated void, exposed rank, lost protection, or forced-win pattern would make the target vulnerable?'};
    }
    if(id==='target'){
      const vulnerability=/void|exposed|lost protection|forced|cannot follow|trapped|captive|high cards?/.test(t);
      const payoff=/score|worth|payoff|risk|points|strategic value|likely to work/.test(t);
      const restraint=/otherwise|not target|leave them|wouldn'?t|would not|avoid targeting|unless/.test(t);
      const blind=/always target|even if .*no evidence|without evidence|whoever.*leading.*score/.test(t);
      if(blind)return {recognized:'You identified a player whose score might make pressure valuable.',incorrect:'Score position alone does not make a targeting line executable. You need evidence that the player is actually constrained in the relevant suit or rank structure.',missing:'Require both vulnerability evidence and strategic payoff before committing.',nextQuestion:'What card-play evidence would show that this player can actually be trapped before you target them?'};
      if(vulnerability&&payoff&&restraint)return {recognized:'You made targeting conditional on observable vulnerability, strategic payoff, and a reason to decline the attack when those conditions are absent.'};
      const missing=[];if(!vulnerability)missing.push('Name the demonstrated hand constraint that makes the target vulnerable.');if(!payoff)missing.push('Explain why the score or payoff justifies taking the targeting risk.');if(!restraint)missing.push('State what would make you decline the target and preserve your own pathway.');return {recognized:'You are considering whether pressure on another player would help.',missing:missing.join(' '),nextQuestion:'What exact evidence makes the player vulnerable, why is the payoff worth it, and what would make you leave them alone?'};
    }
    return null;
  }
  adapter.selectExercise=function(profile){const ex=originalSelect(profile);return {...ex,prompts:{...(ex.prompts||{}),...ADVANCED_PROMPTS}};};
  adapter.evaluate=function(step,response,context,profile){if(!ADVANCED_PROMPTS[step?.id])return originalEvaluate(step,response,context,profile);const t=txt(response),d=diagnosis(step.id,t)||{},complete=Boolean(d.recognized&&!d.missing&&!d.nextQuestion&&!d.incorrect);return {score:complete?0.9:d.incorrect?0.35:0.58,skills:SKILLS[step.id],flags:d.incorrect?['advanced-strategy-error']:[],gradeable:true,diagnosis:d};};
  adapter.__me20AdvancedInstalled=true;
})();
