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
    const originalSteps="const steps=[\n    {id:'objective',label:'1. Objective'},{id:'control',label:'2. Control state'},{id:'cards',label:'3. Cards that create it'},{id:'next',label:'4. Next objective'},{id:'preserve',label:'5. Preserve for later'}\n  ];";
    const replacementSteps="const baseSteps=[{id:'objective',label:'1. Objective'},{id:'control',label:'2. Control state'},{id:'cards',label:'3. Cards that create it'},{id:'next',label:'4. Next objective'},{id:'preserve',label:'5. Preserve for later'}]; const developingSteps=[{id:'threat',label:'6. Threats'},{id:'pivot',label:'7. Contingency / pivot'}]; const advancedSteps=[{id:'observe',label:'8. What to watch for'},{id:'target',label:'9. Smart targeting'}]; let steps=[...baseSteps]; function stepsForLevel(){const level=core.profile.selfLevel||'beginner';if(level==='developing')return [...baseSteps,...developingSteps];if(level==='advanced'||level==='expert')return [...baseSteps,...developingSteps,...advancedSteps];return [...baseSteps];}";
    if(!code.includes(originalSteps)) throw new Error('Tutor ME20 integration guard failed: steps signature changed');
    code=code.replace(originalSteps,replacementSteps);
    code=code.replace("function beginExercise(){exercise=core.selectExercise();stepIndex=0;answers={};walkthroughIndex=0;renderExerciseIntro();window.scrollTo({top:0,behavior:'instant'});}","function beginExercise(){exercise=core.selectExercise();steps=stepsForLevel();stepIndex=0;answers={};walkthroughIndex=0;renderExerciseIntro();window.scrollTo({top:0,behavior:'instant'});}");
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
    await loadScript('hearts-response-completeness.js');
    await loadScript('hearts-reasoning-evidence.js');
    await loadScript('hearts-advanced-reasoning.js');
    await import('./adaptive-trainer/hearts-browser-integration.js');
    await import('./adaptive-trainer/student-profile-rubric.js');
    await loadAsyncTutorUI();
    await loadScript('tutor-strategy-orientation.js');
    await loadScript('tutor-situational-coaching.js');
    await loadScript('tutor-level-progression.js');
    window.__adaptiveTutorLoaded=true;
    window.__adaptiveTutorArchitecture='adaptive-execution-pipeline-v2/domain-adapter-v5/me20-ochem-rubric';
  }catch(error){
    console.error('Adaptive tutor failed to load:',error);
    window.__adaptiveTutorLoaded=false;
  }
})();
