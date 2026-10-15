// access-gate.js awaits this once, before its first unlock(), so the app
// reveals with every game-mode option (including Tutor, or its disabled
// fallback) already in place instead of Tutor mode popping in after the
// rest of the UI is already interactive. The try/catch below never rethrows,
// so this always resolves (never rejects) once the stack has settled either
// way. See the app-layer rebuild plan, Phase 6.
window.__adaptiveTutorSettled=(async function loadAdaptiveTutorStack(){
  const tutorExtensionSources=new Map();
  const installedTutorExtensions=new Set();

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      // async=false makes a dynamically-created script fetch in parallel with
      // other scripts while still executing in the order it was inserted -
      // the standard technique for "download concurrently, run in order".
      s.async=false;
      s.src=src; s.onload=resolve; s.onerror=()=>reject(new Error(`Unable to load ${src}`));
      document.head.appendChild(s);
    });
  }
  // Inserts every script tag immediately (so all of them start downloading
  // at once) and resolves once every one has executed, in the order given -
  // required for chains like the hearts-*.js grading wrappers, where each
  // file re-binds whatever window.CancellationHeartsTutorAdapter.evaluate
  // currently is and only makes sense if the previous wrapper already ran.
  function loadScriptsInOrder(paths){
    return Promise.all(paths.map(loadScript));
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
    // These four groups don't depend on each other - only hearts-tutor.js
    // (loaded after this) needs all of them done. Previously they were
    // awaited one at a time, so ~14 file loads were fully serialized; in
    // production, where every request crosses Cloudflare Access and the
    // entitlement gateway, that added up to real, user-visible delay before
    // Tutor mode appeared. Running the groups concurrently collapses that to
    // roughly one round trip's worth of latency instead of fourteen.
    await Promise.all([
      loadScriptsInOrder([
        'hearts-tutor-adapter.js',
        'hearts-feedback-diagnosis.js',
        'hearts-pathway-consistency.js',
        'hearts-response-completeness.js',
        'hearts-reasoning-evidence.js',
        'hearts-advanced-reasoning.js',
        'hearts-passing-reasoning.js'
      ]),
      Promise.all([
        import('./adaptive-trainer/hearts-browser-integration.js'),
        import('./adaptive-trainer/student-profile-rubric.js'),
        import('./adaptive-trainer/hearts-assessment-integration.js'),
        import('./adaptive-trainer/hearts-calibration-integration.js')
      ]),
      loadScriptsInOrder(['tutor-passing-phase.js','tutor-diagnostic.js']),
      Promise.all([
        registerTutorExtension('strategy-orientation','tutor-strategy-orientation.js'),
        registerTutorExtension('situational-coaching','tutor-situational-coaching.js'),
        registerTutorExtension('level-progression','tutor-level-progression.js'),
        registerTutorExtension('progress-tab','tutor-progress-tab.js')
      ])
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
