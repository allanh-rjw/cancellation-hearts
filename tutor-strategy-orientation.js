(function(){
  const tutor=window.CancellationHeartsTutor;
  const adapter=window.CancellationHeartsTutorAdapter;
  if(!tutor||!tutor.core||!adapter||tutor.__strategyOrientationInstalled) return;

  const originalSelect=tutor.core.selectExercise.bind(tutor.core);
  tutor.core.selectExercise=function(){
    const ex=originalSelect();
    window.__currentTutorExercise=ex;
    return ex;
  };

  function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[m]));}

  function strategyCopy(expert,exercise){
    if(exercise?.id==='guided-queen-protection'){
      return {
        name:expert.strategy||'Avoidance',
        why:'This hand has several cards that can become difficult or costly to lose later, especially Q♠ and the higher hearts. The safest plan is to avoid taking unnecessary tricks while keeping ways to unload those cards.',
        success:'Reach the middle and late hand with Q♠ either safely gone or still protected, the dangerous hearts reduced, and at least one low card left to help you get off lead.'
      };
    }
    if(exercise?.id==='guided-useful-void'){
      return {
        name:expert.strategy||'Avoidance',
        why:'A♠ is the clearest future danger, and several medium-high cards can also become awkward as higher cards disappear. The plan is to stay flexible and create a void only if it gives one of those cards a safe way out.',
        success:'Create a useful disposal route for A♠ or another dangerous card while keeping low cards such as 4♦ or 4♥ available to help surrender the lead later.'
      };
    }
    return {
      name:expert.strategy||'Adaptive avoidance',
      why:expert.read||'The strategy should reduce future risk while preserving useful options.',
      success:expert.desiredState||expert.desired||'Keep enough flexibility to solve the next problem without creating a worse one.'
    };
  }

  function render(){
    const body=document.getElementById('tutorBody');
    const exercise=window.__currentTutorExercise;
    if(!body||!exercise) return;
    const expert=adapter.expertModel(exercise);
    if(!expert) return;
    const old=body.querySelector('.tutor-strategy-orientation');
    if(old) old.remove();
    const hand=body.querySelector('.hand-card');
    if(!hand) return;
    const copy=strategyCopy(expert,exercise);
    const practice=!!body.querySelector('.tutor-progress') || !!body.querySelector('.feedback-badge');
    const card=document.createElement('div');
    card.className='tutor-card tutor-strategy-orientation'+(practice?' compact-strategy':'');
    card.innerHTML=practice
      ? `<div class="strategy-inline"><span>Recommended strategy</span><strong>${esc(copy.name)}</strong><p>${esc(copy.success)}</p></div>`
      : `<div class="eyebrow">Recommended strategy</div><h3>${esc(copy.name)}</h3><p><strong>Why it fits:</strong> ${esc(copy.why)}</p><p><strong>What success looks like:</strong> ${esc(copy.success)}</p>`;
    hand.insertAdjacentElement('afterend',card);
  }

  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;render();});
  });
  const root=document.getElementById('tutorRoot');
  if(root) observer.observe(root,{childList:true,subtree:true});
  render();
  tutor.__strategyOrientationInstalled=true;
})();
