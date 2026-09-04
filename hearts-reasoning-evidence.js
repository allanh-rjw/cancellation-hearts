(function(){
  const adapter=window.CancellationHeartsTutorAdapter;
  if(!adapter||adapter.__reasoningEvidenceGateInstalled)return;
  const original=adapter.evaluate.bind(adapter);

  function textOf(response){return String(response?.text||response?.choice||'').trim();}
  function explicitReasoning(text){
    const t=text.toLowerCase();
    if(/\b(because|since|so that|so i can|so i could|in order to|which lets|which allows|that way|therefore|then i can|to avoid|to keep|to make|so as to)\b/.test(t))return true;
    if(/\b(avoid|prevent|protect|preserve|shed|dump|discard|unload|get rid|stay off lead|off lead|take the lead|create a void|become void|forced winner|future winner|exit)\b/.test(t)&&text.split(/\s+/).length>=7)return true;
    return text.split(/\s+/).length>=12;
  }

  adapter.evaluate=function(step,response,context,profile){
    const result=original(step,response,context,profile)||{};
    const text=textOf(response);
    if(text&&['objective','control','cards','next','preserve'].includes(step?.id)&&!explicitReasoning(text)){
      const diagnosis={...(result.diagnosis||{})};
      diagnosis.ambiguous=diagnosis.ambiguous||'I can evaluate the conclusion you stated, but your reason for choosing it is not established by this response.';
      diagnosis.nextQuestion=diagnosis.nextQuestion||'What in this hand made you choose that answer?';
      result.diagnosis=diagnosis;
      result.gradeable=false;
      result.flags=[...new Set([...(result.flags||[]),'reasoning-not-established'])];
    }
    return result;
  };
  adapter.__reasoningEvidenceGateInstalled=true;
})();
