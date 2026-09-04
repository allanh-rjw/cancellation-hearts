(function(){
  const adapter=window.CancellationHeartsTutorAdapter;
  if(!adapter||adapter.__responseCompletenessInstalled)return;
  const original=adapter.evaluate.bind(adapter);

  function isCompleteDiagnosis(diagnosis){
    return Boolean(
      diagnosis&&
      diagnosis.recognized&&
      !diagnosis.missing&&
      !diagnosis.nextQuestion&&
      !diagnosis.correction&&
      !diagnosis.incorrect&&
      !diagnosis.ambiguous
    );
  }

  adapter.evaluate=function(step,response,context,profile){
    const result=original(step,response,context,profile)||{};
    if(isCompleteDiagnosis(result.diagnosis)){
      result.diagnosis={...result.diagnosis,complete:true};
      result.score=Math.max(Number.isFinite(result.score)?result.score:0,0.85);
      result.gradeable=true;
      result.flags=[...new Set([...(result.flags||[]),'prompt-components-complete'])];
    }
    return result;
  };

  adapter.__responseCompletenessInstalled=true;
})();
