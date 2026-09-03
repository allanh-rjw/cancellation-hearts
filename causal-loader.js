(async function loadCausalPlanner(){
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
})();
