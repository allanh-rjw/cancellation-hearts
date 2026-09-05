(function(){
  const tutor=window.CancellationHeartsTutor;
  const rubric=window.AdaptiveStudentProfileRubric;
  if(!tutor?.core||!rubric||tutor.__me20ProgressionInstalled)return;
  const core=tutor.core;
  const STORAGE_KEY='cancellationHearts.adaptiveTrainer.runtime.v1';
  const ORDER=['beginner','developing','advanced','expert'];
  const LABELS={beginner:'Beginner',developing:'Developing',advanced:'Advanced',expert:'Expert'};
  const LABEL_TO_LEVEL={'Beginner':'beginner','Developing':'developing','Advanced':'advanced','Expert':'expert'};
  const CORE=['hearts.objective_reasoning','hearts.control_reasoning','hearts.card_role_reasoning','hearts.useful_void_reasoning','hearts.exit_preservation'];
  const DEVELOPING=['hearts.passing_reasoning','hearts.pathway_revision','hearts.threat_detection','hearts.minimum_intervention'];
  const ADVANCED=['hearts.information_targeting','hearts.smart_targeting'];
  const ALL=[...CORE,...DEVELOPING,...ADVANCED];
  const SCORE_LABELS={low:'Beginner',middle:'Developing',high:'Advanced',top:'Expert'};

  function events(){return core.store?.allEvents?.()||[];}
  function aggregate(ids){return rubric.buildAggregateRubricSummary({constructIds:ids,events:events(),labels:SCORE_LABELS});}
  function missingDimensions(skills){const missing=new Set();for(const skill of skills)for(const [dimension,value] of Object.entries(skill.ratings||{}))if(!Number.isFinite(value))missing.add(dimension);return [...missing];}
  function resolveRating(){
    const coreSummary=aggregate(CORE);
    if(!Number.isFinite(coreSummary.score))return {performanceLabel:coreSummary.performanceLabel,level:null,score:null,barPercent:null,scope:'core',summary:coreSummary,missing:missingDimensions(coreSummary.skills)};
    let level=LABEL_TO_LEVEL[coreSummary.performanceLabel]||'beginner',chosen=coreSummary,scope='core';
    if(['advanced','expert'].includes(level)){
      const developingSummary=aggregate([...CORE,...DEVELOPING]);
      if(!Number.isFinite(developingSummary.score))return {performanceLabel:'Developing',level:'developing',score:coreSummary.score,barPercent:coreSummary.barPercent,scope:'developing-evidence-needed',summary:developingSummary,missing:missingDimensions(developingSummary.skills)};
      chosen=developingSummary;scope='core+passing+threat-pivot';level=LABEL_TO_LEVEL[developingSummary.performanceLabel]||'developing';
      if(level==='expert'){
        const advancedSummary=aggregate(ALL);
        if(!Number.isFinite(advancedSummary.score))return {performanceLabel:'Advanced',level:'advanced',score:developingSummary.score,barPercent:developingSummary.barPercent,scope:'advanced-evidence-needed',summary:advancedSummary,missing:missingDimensions(advancedSummary.skills)};
        chosen=advancedSummary;scope='full';level=LABEL_TO_LEVEL[advancedSummary.performanceLabel]||'advanced';
      }
    }
    return {performanceLabel:LABELS[level],level,score:chosen.score,barPercent:chosen.barPercent,scope,summary:chosen,missing:missingDimensions(chosen.skills)};
  }
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(core.state));}catch(e){}}
  function applyRating(){
    const rating=resolveRating();
    if(!rating.level)return {rating,change:null};
    const from=core.profile.selfLevel||'beginner',to=rating.level;
    if(from===to)return {rating,change:null};
    core.state.selfLevel=to;core.profile=core.state;core.state.lastRatingChange={from,to,at:new Date().toISOString(),score:rating.score};persist();
    return {rating,change:{from,to}};
  }
  function transferEvidenceCount(){return events().filter(e=>e.type==='learner-evidence-created'&&['transfer-success','transfer-failure'].includes(e.payload?.kind)).length;}
  function shouldRunTransferProbe(){const interactions=core.state.totalInteractions||0,last=core.state.lastTransferProbeAtInteraction??-999;return interactions>=10&&(transferEvidenceCount()===0||interactions-last>=15);}
  const originalSelect=core.selectExercise.bind(core);
  core.selectExercise=function(){
    const ordinary=originalSelect();
    if(!shouldRunTransferProbe())return ordinary;
    const legacy=window.CancellationHeartsTutorAdapter,transfer=legacy?.selectExercise?.({...core.profile,selfLevel:'advanced'});
    if(transfer?.source!=='random')return ordinary;
    core.state.lastTransferProbeAtInteraction=core.state.totalInteractions||0;core.state.currentHandAssisted=false;persist();
    return {...transfer,assessmentProbe:'transfer',title:`Transfer check: ${transfer.title||'new hand'}`};
  };

  const originalEvaluate=core.evaluate.bind(core);
  core.evaluate=async function(...args){const result=await originalEvaluate(...args);const {rating,change}=applyRating();result.ratingChange=change;result.levelProgress=rating;return result;};
  core.promotionStatus=resolveRating;core.studentRating=resolveRating;

  function renderProgress(){
    const root=document.getElementById('tutorRoot'),top=root?.querySelector('.tutor-top');if(!top)return;
    let box=document.getElementById('tutorLevelProgress');if(!box){box=document.createElement('div');box.id='tutorLevelProgress';box.className='tutor-level-progress';top.appendChild(box);}
    const s=resolveRating();
    if(!s.level){const missing=s.missing.length?s.missing.join(', '):'additional evidence';box.innerHTML=`<strong>${s.performanceLabel}</strong><span>Assessment uses understanding, consistency, independence, and transfer.</span><small>Still gathering: ${missing}.</small>`;return;}
    const bar=Number.isFinite(s.barPercent)?`<div class="tutor-rating-bar"><span style="width:${s.barPercent}%"></span></div>`:'';
    const note=s.scope==='developing-evidence-needed'?'Passing, pathway revision, threat recognition, and minimum-intervention evidence are still being gathered before the trainer can support an Advanced rating.':s.scope==='advanced-evidence-needed'?'Observation and targeting evidence is still being gathered before the trainer can support an Expert rating.':'Rating is based on understanding, consistency, independence, and transfer.';
    box.innerHTML=`<strong>${s.performanceLabel}</strong>${bar}<span>${note}</span>`;
  }
  function showRatingChange(){
    const p=core.state.lastRatingChange;if(!p||p.shown)return;const body=document.getElementById('tutorBody');if(!body)return;
    const card=document.createElement('div');card.className='tutor-card promotion-card';const upward=ORDER.indexOf(p.to)>ORDER.indexOf(p.from);
    card.innerHTML=`<div class="eyebrow">Assessment update</div><h3>${LABELS[p.to]}</h3><p>${upward?'Your recent evidence now supports a higher teaching level.':'The trainer is temporarily adjusting the teaching level while it gathers stronger evidence.'} The next hand will use the matching pathway.</p>`;
    body.prepend(card);p.shown=true;persist();
  }
  const observer=new MutationObserver(()=>{renderProgress();showRatingChange();});const root=document.getElementById('tutorRoot');if(root)observer.observe(root,{subtree:true,childList:true});renderProgress();
  tutor.__me20ProgressionInstalled=true;
})();
