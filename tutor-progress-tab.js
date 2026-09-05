(function(){
  const tutor=window.CancellationHeartsTutor;
  if(!tutor?.core||tutor.__progressTabInstalled)return;
  const core=tutor.core;
  const LABELS={beginner:'Beginner',developing:'Developing',advanced:'Advanced',expert:'Expert'};
  const ORDER=['beginner','developing','advanced','expert'];
  function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function titleize(s){return String(s||'').replace(/^hearts\./,'').replace(/^causal_planning\./,'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
  function currentLevel(){const rated=core.studentRating?.();return rated?.level||core.profile.selfLevel||core.state.diagnostic?.level||null;}
  function skillRows(){
    const states=core.lastLearnerState?.skillStates||[];
    return states.filter(s=>s.constructId?.startsWith('hearts.')).map(s=>({id:s.constructId,p:s.independent?.probability??.5,n:s.independent?.observations??0,t:s.transfer?.observations??0})).sort((a,b)=>a.p-b.p);
  }
  function dimCard(name,value){const pct=Number.isFinite(value)?value/4*100:0;return `<div class="progress-dimension"><span>${esc(name)}</span><strong>${Number.isFinite(value)?`${value}/4`:'Gathering evidence'}</strong><div class="progress-meter"><i style="width:${pct}%"></i></div></div>`;}
  function render(){
    const panel=document.getElementById('tutorProgressPanel');if(!panel)return;
    const diag=core.state.diagnostic||{},level=currentLevel(),skills=skillRows();
    const currentIndex=Math.max(0,ORDER.indexOf(level));
    const dims=diag.completed?diag.ratings:{};
    const weakest=skills.slice(0,5),strongest=[...skills].sort((a,b)=>b.p-a.p).slice(0,4);
    panel.innerHTML=`<div class="tutor-card progress-overview"><div class="eyebrow">Development</div><h3>${level?esc(LABELS[level]):'Diagnostic in progress'}</h3><div class="development-ladder">${ORDER.map((l,i)=>`<div class="${i<currentIndex?'done':i===currentIndex?'active':''}"><span>${i+1}</span><strong>${LABELS[l]}</strong></div>`).join('')}</div>${diag.completed?`<p>Opening diagnostic: <strong>${diag.total}/16</strong> · ${esc(diag.label)}</p>`:`<p>Complete the five-hand diagnostic to establish a starting level.</p>`}</div><div class="progress-grid"><div class="tutor-card"><h3>Assessment dimensions</h3><p>Each dimension uses the Adaptive Trainer's 1–4 scale.</p><div class="progress-dimensions">${['understanding','consistency','independence','transfer'].map(k=>dimCard(k,dims[k])).join('')}</div></div><div class="tutor-card"><h3>Development focus</h3>${weakest.length?weakest.map(s=>`<div class="progress-skill"><span>${esc(titleize(s.id))}</span><strong>${Math.round(s.p*100)}%</strong><small>${s.n} independent · ${s.t} transfer</small></div>`).join(''):'<p>Ongoing skill evidence will appear here after instruction begins.</p>'}</div></div>${strongest.length?`<div class="tutor-card"><h3>Current strengths</h3><div class="progress-strengths">${strongest.map(s=>`<span>${esc(titleize(s.id))}</span>`).join('')}</div></div>`:''}`;
  }
  function install(){
    const root=document.getElementById('tutorRoot'),top=root?.querySelector('.tutor-top'),body=document.getElementById('tutorBody');if(!top||!body)return;
    let nav=document.getElementById('tutorTabs');if(!nav){nav=document.createElement('div');nav.id='tutorTabs';nav.className='tutor-tabs';nav.innerHTML='<button type="button" data-tutor-tab="learn" class="active">Tutor</button><button type="button" data-tutor-tab="progress">Progress</button>';top.appendChild(nav);}
    let panel=document.getElementById('tutorProgressPanel');if(!panel){panel=document.createElement('div');panel.id='tutorProgressPanel';panel.className='tutor-progress-panel hidden';body.parentNode.insertBefore(panel,body.nextSibling);}
    nav.querySelector('[data-tutor-tab="learn"]').onclick=()=>{body.classList.remove('hidden');panel.classList.add('hidden');nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.tutorTab==='learn'));};
    nav.querySelector('[data-tutor-tab="progress"]').onclick=()=>{render();body.classList.add('hidden');panel.classList.remove('hidden');nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.tutorTab==='progress'));};
    render();
  }
  install();
  new MutationObserver(()=>{if(!document.getElementById('tutorTabs'))install();}).observe(document.getElementById('tutorRoot')||document.body,{childList:true,subtree:true});
  window.addEventListener('hearts-diagnostic-complete',render);
  tutor.__progressTabInstalled=true;
})();
