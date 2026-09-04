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
    await import('./adaptive-trainer/hearts-browser-integration.js');
    await loadScript('hearts-tutor.js');
    await loadScript('tutor-strategy-orientation.js');
    await loadScript('tutor-situational-coaching.js');
    window.__adaptiveTutorLoaded=true;
    window.__adaptiveTutorArchitecture='canonical-adaptive-trainer-core-v3/domain-adapter-v5';
  }catch(error){
    console.error('Adaptive tutor failed to load:',error);
    window.__adaptiveTutorLoaded=false;
  }
})();
