(async function loadAdaptiveTutorStack(){
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

  function markTutorUnavailable(){
    const gameMode=document.getElementById('gameMode');
    if(gameMode&&!gameMode.querySelector('option[value="tutor-unavailable"]')){
      const o=document.createElement('option');
      o.value='tutor-unavailable';o.textContent='Tutor mode (unavailable)';o.disabled=true;
      gameMode.appendChild(o);
    }
  }

  // hand-pathway-planner.js is a static <script> loaded in index.html, so
  // buildHandPathway()/renderHandPathway() are already the enhanced versions
  // by the time any classic script runs. __causalPlannerLoaded is kept for
  // scripts/verify-browser-startup.mjs's diagnostic snapshot.
  window.__causalPlannerLoaded=typeof buildHandPathway==='function'&&typeof spadeSystemAssessment==='function';

  try{
    loadStyle('tutor.css');
    loadStyle('tutor-rating.css');
    loadStyle('tutor-passing.css');
    loadStyle('tutor-diagnostic.css');
    await loadScript('hearts-tutor-adapter.js');
    await loadScript('hearts-feedback-diagnosis.js');
    await loadScript('hearts-pathway-consistency.js');
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
    await loadScript('hearts-tutor.js');
    window.__adaptiveTutorLoaded=true;
    window.__adaptiveTutorArchitecture='adaptive-execution-pipeline-v2/domain-adapter-v5/assessment-core-v1/calibration-core-v1/me20-diagnostic+progress+passing+consistency/lazy-tutor-core-v1';
  }catch(error){
    console.error('Adaptive tutor failed to load:',error);
    window.__adaptiveTutorLoaded=false;
    markTutorUnavailable();
  }
})();
