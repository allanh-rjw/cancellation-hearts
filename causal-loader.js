(async function loadCausalPlanner(){
  const tutorExtensionSources=new Map();
  const installedTutorExtensions=new Set();

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
  async function registerTutorExtension(name,src){
    if(tutorExtensionSources.has(name)) return;
    const response=await fetch(src,{cache:'no-store'});
    if(!response.ok) throw new Error(`Unable to load ${src}`);
    tutorExtensionSources.set(name,await response.text());
  }
  function installTutorExtensions(){
    for(const [name,source] of tutorExtensionSources){
      if(installedTutorExtensions.has(name)) continue;
      (0,eval)(source);
      installedTutorExtensions.add(name);
    }
  }
  window.__CancellationHeartsTutorExtensions=Object.freeze({install:installTutorExtensions,registered:()=>[...tutorExtensionSources.keys()],installed:()=>[...installedTutorExtensions]});

  async function loadAsyncTutorUI(){
    const response=await fetch('hearts-tutor.js',{cache:'no-store'});
    if(!response.ok) throw new Error('Unable to load hearts-tutor.js');
    let code=await response.text();

    const originalCore="const core=new AdaptiveCoachCore(window.CancellationHeartsTutorAdapter);";
    const lazyCore="let core=null;let coreConstructionCount=0;function ensureInitialized(){if(core)return core;core=new AdaptiveCoachCore(window.CancellationHeartsTutorAdapter);coreConstructionCount++;window.__CancellationHeartsTutorExtensions?.install?.();return core;}";
    if(!code.includes(originalCore)) throw new Error('Tutor lazy-core integration guard failed: core signature changed');
    code=code.replace(originalCore,lazyCore);

    const originalStartFunction="function startTutor(){";
    const lazyStartFunction="function startTutor(){ensureInitialized();";
    if(!code.includes(originalStartFunction)) throw new Error('Tutor lazy-core integration guard failed: startTutor signature changed');
    code=code.replace(originalStartFunction,lazyStartFunction);

    const originalSteps="const steps=[\n    {id:'objective',label:'1. Objective'},{id:'control',label:'2. Control state'},{id:'cards',label:'3. Cards that create it'},{id:'next',label:'4. Next objective'},{id:'preserve',label:'5. Preserve for later'}\n  ];";
    const replacementSteps="const baseSteps=[{id:'objective',label:'1. Objective'},{id:'control',label:'2. Control state'},{id:'cards',label:'3. Cards that create it'},{id:'next',label:'4. Next objective'},{id:'preserve',label:'5. Preserve for later'}]; const developingSteps=[{id:'threat',label:'6. Threats'},{id:'pivot',label:'7. Contingency / pivot'}]; const advancedSteps=[{id:'observe',label:'8. What to watch for'},{id:'target',label:'9. Smart targeting'}]; let steps=[...baseSteps]; function stepsForLevel(){const level=core.profile.selfLevel||'beginner';if(level==='developing')return [...baseSteps,...developingSteps];if(level==='advanced'||level==='expert')return [...baseSteps,...developingSteps,...advancedSteps];return [...baseSteps];}";
    if(!code.includes(originalSteps)) throw new Error('Tutor ME20 integration guard failed: steps signature changed');
    code=code.replace(originalSteps,replacementSteps);

    const originalStart="if(!core.profile.selfLevel)renderSelfAssessment();else beginExercise();";
    const replacementStart="if(!core.state.diagnostic?.completed){const diagnostic=window.CancellationHeartsDiagnostic;if(!diagnostic)throw new Error('Opening diagnostic is not loaded');diagnostic.start({core,beginExercise});}else beginExercise();";
    if(!code.includes(originalStart)) throw new Error('Tutor diagnostic integration guard failed: startTutor signature changed');
    code=code.replace(originalStart,replacementStart);

    const originalBegin="function beginExercise(){exercise=core.selectExercise();stepIndex=0;answers={};walkthroughIndex=0;renderExerciseIntro();window.scrollTo({top:0,behavior:'instant'});}";
    const replacementBegin="function beginExercise(){exercise=core.selectExercise();steps=stepsForLevel();stepIndex=0;answers={};walkthroughIndex=0;const finish=(updated)=>{if(updated)exercise=updated;renderExerciseIntro();window.scrollTo({top:0,behavior:'instant'});};const passing=window.CancellationHeartsPassingPhase;if(passing?.shouldRun(core.profile,exercise)){passing.start({core,exercise,onComplete:finish});return;}finish(exercise);}";
    if(!code.includes(originalBegin)) throw new Error('Tutor ME20 passing integration guard failed: beginExercise signature changed');
    code=code.replace(originalBegin,replacementBegin);

    const originalSubmit="function submitStep(response){const step=steps[stepIndex];if(!(response.text||response.choice)){document.getElementById('tutorAnswer')?.focus();return;}const result=core.evaluate(step,response,{exercise,answers});answers[step.id]=response.text||response.choice;renderFeedback(step,result,response);}";
    const replacementSubmit="async function submitStep(response){const step=steps[stepIndex];if(!(response.text||response.choice)){document.getElementById('tutorAnswer')?.focus();return;}const submit=document.getElementById('submitTutorAnswer');if(submit){submit.disabled=true;submit.textContent='Evaluating…';}try{const result=await core.evaluate(step,response,{exercise,answers});answers[step.id]=response.text||response.choice;renderFeedback(step,result,response);}catch(error){console.error('Adaptive Trainer evaluation failed:',error);if(submit){submit.disabled=false;submit.textContent='Submit thinking';}const box=document.getElementById('choiceBox');if(box)box.innerHTML='<div class=\"hint-panel\"><strong>Evaluation error</strong><p>The trainer could not evaluate this response. Your answer has not been scored.</p></div>';}}";
    if(!code.includes(originalSubmit)) throw new Error('Tutor async integration guard failed: submitStep signature changed');
    code=code.replace(originalSubmit,replacementSubmit);

    const originalExport="ensureUI();window.CancellationHeartsTutor={core,start:startTutor};";
    const lazyExport="ensureUI();window.CancellationHeartsTutor={get core(){return core;},start:startTutor,ensureInitialized,isInitialized(){return core!==null;},coreConstructionCount(){return coreConstructionCount;}};";
    if(!code.includes(originalExport)) throw new Error('Tutor lazy-core integration guard failed: export signature changed');
    code=code.replace(originalExport,lazyExport);

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
    loadStyle('tutor-rating.css');
    loadStyle('tutor-passing.css');
    loadStyle('tutor-diagnostic.css');
    await loadScript('hearts-tutor-adapter.js');
    await loadScript('hearts-feedback-diagnosis.js');
    await loadScript('hearts-response-completeness.js');
    await loadScript('hearts-reasoning-evidence.js');
    await loadScript('hearts-advanced-reasoning.js');
    await loadScript('hearts-passing-reasoning.js');
    await import('./adaptive-trainer/hearts-browser-integration.js');
    await import('./adaptive-trainer/student-profile-rubric.js');
    await import('./adaptive-trainer/hearts-assessment-integration.js');
    await import('./adaptive-trainer/hearts-calibration-integration.js');
    await loadScript('tutor-passing-phase.js');
    await loadScript('tutor-diagnostic.js');
    await Promise.all([
      registerTutorExtension('strategy-orientation','tutor-strategy-orientation.js'),
      registerTutorExtension('situational-coaching','tutor-situational-coaching.js'),
      registerTutorExtension('level-progression','tutor-level-progression.js'),
      registerTutorExtension('progress-tab','tutor-progress-tab.js')
    ]);
    await loadAsyncTutorUI();
    window.__adaptiveTutorLoaded=true;
    window.__adaptiveTutorArchitecture='adaptive-execution-pipeline-v2/domain-adapter-v5/assessment-core-v1/calibration-core-v1/me20-diagnostic+progress+passing/lazy-tutor-core-v1';
  }catch(error){
    console.error('Adaptive tutor failed to load:',error);
    window.__adaptiveTutorLoaded=false;
  }
})();
