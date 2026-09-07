(async function loadProductionDomainPackIntegration(){
  'use strict';

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error(`Unable to load ${src}`));
      document.head.appendChild(script);
    });
  }
  function loadStyle(href){
    if(document.querySelector(`link[href="${href}"]`))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.appendChild(link);
  }

  window.__adaptiveTutorLoaded=false;
  window.__causalPlannerLoaded=false;
  window.__legacyCancellationHeartsTrainerProductionEnabled=false;

  try{
    loadStyle('domain-pack-integration.css');
    await loadScript('domain-pack-client.js');
    await loadScript('game-state-adapter.js');
    await loadScript('domain-pack-integration.js');
    window.__domainPackIntegrationLoaded=true;
  }catch(error){
    window.__domainPackIntegrationLoaded=false;
    console.error('Cancellation Hearts Domain Pack integration failed to load:',error);
    const subtitle=document.getElementById('coachSubtitle');
    if(subtitle)subtitle.textContent='Domain Pack integration failed to load. The game remains available without coaching.';
  }
})();
