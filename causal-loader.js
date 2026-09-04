(async function loadCausalPlanner(){
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src; s.onload=resolve; s.onerror=()=>reject(new Error(`Unable to load ${src}`));
      document.head.appendChild(s);
    });
  }
  function loadStyle(href){
    if(document.querySelector(`link[href="${href}"]`)) return;
    const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);
  }
  async function loadAsyncTutorUI(){
    const response=await fetch('hearts-tutor.js',{cache:'no-store'});
    if(!response.ok) throw new Error('Unable to load hearts-tutor.js');
    let code=await response.text();
    const original="function submitStep(response){const step=steps[stepIndex];if(!(response.text||response.choice)){document.getElementById('tutorAnswer')?.focus();return;}const result=core.evaluate(step,response,{exercise,answers});answers[step.id]=response.text||response.choice;renderFeedback(step,result,response);}";
    const replacement="async function submitStep(response){const step=steps[stepIndex];if(!(response.text||response.choice)){document.getElementById('tutorAnswer')?.focus();return;}const submit=document.getElementById('submitTutorAnswer');if(submit){submit.disabled=true;submit.textContent='Evaluating…';}try{const result=await core.evaluate(step,response,{exercise,answers});answers[step.id]=response.text||response.choice;renderFeedback(step,result,response);}catch(error){console.error('Adaptive Trainer evaluation failed:',error);if(submit){submit.disabled=false;submit.textContent='Submit thinking';}const box=document.getElementById('choiceBox');if(box)box.innerHTML='<div class=\"hint-panel\"><strong>Evaluation error</strong><p>The trainer could not evaluate this response. Your answer has not been scored.</p></div>';}}";
    if(!code.includes(original)) throw new Error('Tutor async integration guard failed: submitStep signature changed');
    code=code.replace(original,replacement);
    (0,eval)(code);
  }
  try{
    const parts=[];
    for(const name of ['patch.part01','patch.part02','patch.part03']){
      const r=await fetch(`causal/${name}`,{cache:'no-store'});
      if(!r.ok) throw new Error(`Unable to load ${name}`);
      parts.push((await r.text()).replace(/\s+/g,''));
    }
    const binary=atob(parts.join(''));
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
    if(typeof DecompressionStream!=='function') throw new Error('This browser does not support gzip decompression.');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const code=await new Response(stream).text();
    (0,eval)(code);
    window.__causalPlannerLoaded=true;
    if(typeof renderCoach==='function' && typeof state!=='undefined' && state.players?.length) renderCoach();
  }catch(error){
    console.error('Causal planner failed to load:',error);
    window.__causalPlannerLoaded=false;
  }

  try{
    loadStyle('tutor.css');
    await loadScript('hearts-tutor-adapter.js');
    await loadScript('hearts-feedback-diagnosis.js');
    await loadScript('hearts-reasoning-evidence.js');
    await import('./adaptive-trainer/hearts-browser-integration.js');
    await loadAsyncTutorUI();
    await loadScript('tutor-strategy-orientation.js');
    await loadScript('tutor-situational-coaching.js');
    window.__adaptiveTutorLoaded=true;
    window.__adaptiveTutorArchitecture='adaptive-execution-pipeline-v2/domain-adapter-v5';
  }catch(error){
    console.error('Adaptive tutor failed to load:',error);
    window.__adaptiveTutorLoaded=false;
  }
})();
