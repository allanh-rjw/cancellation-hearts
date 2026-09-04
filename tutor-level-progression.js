(function(){
  const tutor=window.CancellationHeartsTutor;
  if(!tutor?.core||tutor.__me20ProgressionInstalled)return;
  const core=tutor.core;
  const STORAGE_KEY='cancellationHearts.adaptiveTrainer.runtime.v1';
  const ORDER=['beginner','developing','advanced','expert'];
  const LABELS={beginner:'Beginner',developing:'Developing',advanced:'Advanced',expert:'Expert'};
  const CORE=['hearts.objective_reasoning','hearts.control_reasoning','hearts.card_role_reasoning','hearts.useful_void_reasoning','hearts.exit_preservation'];
  const DEVELOPING=['hearts.threat_detection','hearts.minimum_intervention'];
  const ADVANCED=['hearts.information_targeting','hearts.smart_targeting'];

  function skillMap(){return new Map((core.lastLearnerState?.skillStates||[]).map(s=>[s.constructId,s]));}
  function measure(ids){
    const map=skillMap();
    return ids.map(id=>{const s=map.get(id);return {id,p:s?.independent?.probability??0.5,n:s?.independent?.observations??0};});
  }
  function passes(ids,p=0.67,n=2){return measure(ids).every(x=>x.p>=p&&x.n>=n);}
  function independentCount(){return (core.lastLearnerState?.skillStates||[]).reduce((sum,s)=>sum+(s.independent?.observations||0),0);}
  function transferAttemptCount(){
    const events=core.store?.allEvents?.()||[];
    return events.filter(e=>e.type==='learner-response-submitted'&&e.payload?.problem?.metadata?.source==='random'&&e.payload?.administration?.independent!==false).length;
  }
  function status(){
    const level=core.profile.selfLevel||'beginner';
    const independent=independentCount(),transfer=transferAttemptCount();
    if(level==='beginner')return {level,next:'developing',ready:passes(CORE)&&independent>=10,requirements:measure(CORE),summary:`${independent}/10 independent core responses; each core skill needs 2 independent successes with stable evidence.`};
    if(level==='developing')return {level,next:'advanced',ready:passes(CORE)&&passes(DEVELOPING)&&independent>=14,requirements:[...measure(CORE),...measure(DEVELOPING)],summary:`${independent}/14 independent responses; threat detection and minimum-intervention pivots must each be demonstrated at least twice.`};
    if(level==='advanced')return {level,next:'expert',ready:passes(CORE)&&passes(DEVELOPING)&&passes(ADVANCED)&&transfer>=18,requirements:[...measure(DEVELOPING),...measure(ADVANCED)],summary:`${transfer}/18 independent transfer-hand responses; observation and smart targeting must each be demonstrated at least twice.`};
    return {level,next:null,ready:false,requirements:[],summary:'Expert level. The trainer continues tracking transfer, targeting, contingency, and calibration evidence.'};
  }
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(core.state));}catch(e){}}
  function maybePromote(){
    const s=status();
    if(!s.ready||!s.next)return null;
    const from=s.level,to=s.next;
    core.state.selfLevel=to;core.profile=core.state;
    core.state.lastPromotion={from,to,at:new Date().toISOString()};
    persist();
    return {from,to};
  }
  const originalEvaluate=core.evaluate.bind(core);
  core.evaluate=async function(...args){
    const result=await originalEvaluate(...args);
    const promotion=maybePromote();
    result.promotion=promotion;
    result.levelProgress=status();
    return result;
  };
  core.promotionStatus=status;

  function pct(x){return Math.round((x||0)*100);}
  function renderProgress(){
    const root=document.getElementById('tutorRoot');
    const top=root?.querySelector('.tutor-top');
    if(!top)return;
    let box=document.getElementById('tutorLevelProgress');
    if(!box){box=document.createElement('div');box.id='tutorLevelProgress';box.className='tutor-level-progress';top.appendChild(box);}
    const s=status();
    const weak=s.requirements.filter(x=>x.n<2||x.p<0.67).slice(0,3);
    box.innerHTML=`<strong>${LABELS[s.level]}${s.next?` → ${LABELS[s.next]}`:''}</strong><span>${s.summary}</span>${weak.length?`<small>Still building: ${weak.map(x=>`${x.id.split('.').pop().replaceAll('_',' ')} ${x.n}/2, ${pct(x.p)}%`).join(' · ')}</small>`:''}`;
  }
  function showPromotion(){
    const p=core.state.lastPromotion;if(!p||p.shown)return;
    const body=document.getElementById('tutorBody');if(!body)return;
    const card=document.createElement('div');card.className='tutor-card promotion-card';
    card.innerHTML=`<div class="eyebrow">Level promotion</div><h3>${LABELS[p.from]} → ${LABELS[p.to]}</h3><p>Your independent performance now supports the next teaching level. New pathway questions will appear on the next hand.</p>`;
    body.prepend(card);p.shown=true;persist();
  }
  const observer=new MutationObserver(()=>{renderProgress();showPromotion();});
  const root=document.getElementById('tutorRoot');if(root)observer.observe(root,{subtree:true,childList:true});
  renderProgress();
  tutor.__me20ProgressionInstalled=true;
})();
