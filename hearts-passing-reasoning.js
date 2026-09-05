(function(){
  const adapter=window.CancellationHeartsTutorAdapter;
  if(!adapter||adapter.__me20PassingInstalled)return;
  const originalSelect=adapter.selectExercise.bind(adapter);
  const originalEvaluate=adapter.evaluate.bind(adapter);
  const PASS_PROMPTS={
    prepass_pathway:{question:'Before you pass, what pathway do you want this hand to follow? Choose exactly three cards to pass and explain what those cards are meant to change, remove, or preserve.',fallback:[]},
    postpass_pathway:{question:'Now that you have seen the three incoming cards, how should your pathway change? Identify what became safer or more dangerous, what your first objective is now, and what cards you need to preserve.',fallback:[]}
  };
  const SKILLS={
    prepass_pathway:['hearts.passing_reasoning','causal_planning.state_transition','causal_planning.preservation'],
    postpass_pathway:['hearts.pathway_revision','causal_planning.contingency_revision','causal_planning.preservation']
  };
  function txt(response){return String(response?.text||response?.choice||'').toLowerCase();}
  function cardMentions(text){return [...new Set((String(text).toUpperCase().match(/(?:10|[2-9JQKA])[CDSH]/g)||[]))];}
  function preDiagnosis(text){
    const cards=cardMentions(text);
    const pathway=/path|objective|goal|want to|trying to|avoid|protect|void|shed|dump|dispose|control|lead/.test(text);
    const purpose=/because|so that|so i|in order|to create|to remove|to keep|preserv|protect|avoid|shed|dump|void/.test(text);
    const future=/then|after|later|next|once|future|eventually/.test(text);
    if(cards.length===3&&pathway&&purpose&&future)return {correct:'You selected three cards and connected the pass to a multi-step hand pathway rather than treating the pass as simple card disposal.'};
    const missing=[];
    if(cards.length!==3)missing.push('Name exactly the three cards you intend to pass.');
    if(!pathway)missing.push('State the hand-level objective you want the pass to support.');
    if(!purpose)missing.push('Explain what the three-card pass is meant to change or preserve.');
    if(!future)missing.push('Connect the pass to what you expect to do afterward.');
    return {recognized:cards.length===3?'You have made a definite three-card pass choice.':'You are beginning to frame the pass.',missing:missing.join(' '),nextQuestion:cards.length===3?'What future position does this exact three-card pass help you create?':'Which exact three cards would you pass, and what job does each choice serve?'};
  }
  function postDiagnosis(text){
    const change=/change|changed|now|incoming|received|new|safer|danger|worse|better|still/.test(text);
    const objective=/first objective|objective|goal|want to|need to|shed|dump|dispose|protect|void|control|lead/.test(text);
    const preserve=/preserv|keep|save|protect|hold/.test(text);
    const causal=/because|so that|so i|therefore|which means|then|after|now that/.test(text);
    if(change&&objective&&preserve&&causal)return {correct:'You revised the pathway using the post-pass hand, including what changed, the new first objective, and what still needs to be preserved.'};
    const missing=[];
    if(!change)missing.push('Identify at least one way the incoming cards changed the hand.');
    if(!objective)missing.push('Name the first objective for the new hand.');
    if(!preserve)missing.push('Name what must now be preserved for the next phase.');
    if(!causal)missing.push('Explain why the new hand changes or confirms the original pathway.');
    return {recognized:'You are reassessing the hand after the pass.',missing:missing.join(' '),nextQuestion:'What specifically changed because of the incoming cards, and how does that alter your first objective?'};
  }
  adapter.selectExercise=function(profile){const ex=originalSelect(profile);return {...ex,prompts:{...(ex.prompts||{}),...PASS_PROMPTS}};};
  adapter.evaluate=function(step,response,context,profile){
    if(!PASS_PROMPTS[step?.id])return originalEvaluate(step,response,context,profile);
    const text=txt(response),d=step.id==='prepass_pathway'?preDiagnosis(text):postDiagnosis(text);
    const complete=Boolean(d.correct&&!d.missing&&!d.nextQuestion);
    return {score:complete?0.9:0.58,skills:SKILLS[step.id],flags:[],gradeable:true,diagnosis:d};
  };
  adapter.__me20PassingInstalled=true;
})();
