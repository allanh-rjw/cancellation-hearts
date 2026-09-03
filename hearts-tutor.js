(function(){
  if(!window.AdaptiveCoach||!window.CancellationHeartsTutorAdapter) return;
  const {AdaptiveCoachCore,SELF_LEVELS}=window.AdaptiveCoach;
  const core=new AdaptiveCoachCore(window.CancellationHeartsTutorAdapter);
  let exercise=null,stepIndex=0,answers={};
  const steps=[
    {id:'objective',label:'1. Objective'},{id:'control',label:'2. Control state'},{id:'cards',label:'3. Cards that create it'},{id:'next',label:'4. Next objective'},{id:'preserve',label:'5. Preserve for later'}
  ];
  function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function ensureUI(){
    if(document.getElementById('tutorRoot')) return;
    const setup=document.getElementById('setup');
    const gameMode=document.getElementById('gameMode');
    if(gameMode&&!gameMode.querySelector('option[value="tutor"]')){
      const o=document.createElement('option');o.value='tutor';o.textContent='Tutor mode';gameMode.appendChild(o);
    }
    const root=document.createElement('section');root.id='tutorRoot';root.className='tutor-root hidden';
    root.innerHTML=`<div class="tutor-shell">
      <div class="tutor-top"><div><h2>Adaptive Tutor</h2><p>Learn to build a hand pathway, not merely pick a card.</p></div><button id="tutorExit" class="secondary compact">Exit Tutor</button></div>
      <div id="tutorBody"></div>
    </div>`;
    document.getElementById('app').appendChild(root);
    document.getElementById('tutorExit').onclick=()=>window.location.reload();
    const oldStart=window.startGame;
    const btn=document.getElementById('newGameBtn');
    if(btn){
      btn.addEventListener('click',e=>{
        if(document.getElementById('gameMode').value==='tutor'){
          e.stopImmediatePropagation();e.preventDefault();startTutor();
        }
      },true);
    }
    if(gameMode){
      const old=gameMode.onchange;
      gameMode.onchange=function(){ if(old) old.call(this); document.getElementById('newGameBtn').textContent=this.value==='tutor'?'Start Tutor':(this.value==='practice'?'Start Moon Practice':'Start New Game'); };
    }
  }
  function startTutor(){
    document.getElementById('setup').classList.add('hidden');
    const game=document.getElementById('game');if(game)game.classList.add('hidden');
    document.getElementById('tutorRoot').classList.remove('hidden');
    if(!core.profile.selfLevel) renderSelfAssessment(); else beginExercise();
  }
  function renderSelfAssessment(){
    const body=document.getElementById('tutorBody');
    body.innerHTML=`<div class="tutor-card"><h3>First, assess your current level</h3><p>This only sets the starting scaffolding. Your actual performance will quickly override it.</p><div class="level-grid">${Object.entries(SELF_LEVELS).map(([k,v])=>`<button class="level-choice" data-level="${k}"><strong>${v.label}</strong><span>${v.description}</span></button>`).join('')}</div></div>`;
    body.querySelectorAll('.level-choice').forEach(b=>b.onclick=()=>{core.selfAssess(b.dataset.level);beginExercise();});
  }
  function beginExercise(){exercise=core.selectExercise();stepIndex=0;answers={};renderExerciseIntro();}
  function renderExerciseIntro(){
    const body=document.getElementById('tutorBody');
    const expert=window.CancellationHeartsTutorAdapter.expertModel(exercise);
    const show=core.shouldShowWorkedExample();
    body.innerHTML=`<div class="tutor-grid"><div class="tutor-card"><div class="eyebrow">${exercise.source==='curated'?'Curated teaching hand':'Transfer hand'}</div><h3>${esc(exercise.title)}</h3><div class="tutor-hand">${exercise.hand.map(c=>`<span class="mini-card">${esc(window.CancellationHeartsTutorAdapter.cardLabel(c))}</span>`).join('')}</div></div>
      <div class="tutor-card"><h3>${show?'Worked example':'Your turn first'}</h3>${show?`<p><strong>Expert read:</strong> ${esc(expert.read)}</p><p><strong>Strategy:</strong> ${esc(expert.strategy)}</p><ol>${expert.pathway.map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p class="small-copy">Watch the structure: objective → control state → specific cards → next objective → preserve.</p>`:`<p>Build the pathway before seeing the expert model. The tutor will give feedback one link at a time.</p>`}<button id="beginPathway" class="primary">${show?'Practice this pathway':'Build my pathway'}</button></div></div>`;
    document.getElementById('beginPathway').onclick=()=>{if(show)core.recordWorkedExample();renderStep();};
  }
  function renderStep(){
    const step=steps[stepIndex],prompt=exercise.prompts[step.id],mode=core.scaffoldMode(skillKeys(step.id));
    const body=document.getElementById('tutorBody');
    body.innerHTML=`<div class="tutor-progress">${steps.map((s,i)=>`<div class="${i<stepIndex?'done':i===stepIndex?'active':''}">${s.label}</div>`).join('')}</div>
      <div class="tutor-grid"><div class="tutor-card"><h3>${esc(step.label)}</h3><p class="tutor-question">${esc(prompt.question)}</p><textarea id="tutorAnswer" rows="5" placeholder="Explain your thinking..."></textarea><div class="tutor-actions"><button id="submitTutorAnswer" class="primary">Submit thinking</button>${mode.showFallback?'<button id="showChoices" class="secondary">I need choices</button>':''}</div><div id="choiceBox"></div></div>
      <div class="tutor-card pathway-live"><h3>Your developing pathway</h3>${renderPathwaySoFar()}</div></div>`;
    document.getElementById('submitTutorAnswer').onclick=()=>submitStep({text:document.getElementById('tutorAnswer').value});
    const showChoices=document.getElementById('showChoices');if(showChoices)showChoices.onclick=()=>renderChoices(prompt.fallback);
    if(mode.fallbackOpen) renderChoices(prompt.fallback);
  }
  function renderChoices(choices){
    const box=document.getElementById('choiceBox');if(!box)return;
    box.innerHTML=`<div class="fallback-box"><p><strong>Fallback choices</strong></p>${choices.map((x,i)=>`<button class="choice-option" data-i="${i}">${esc(x)}</button>`).join('')}</div>`;
    box.querySelectorAll('.choice-option').forEach(b=>b.onclick=()=>submitStep({choice:choices[+b.dataset.i]}));
  }
  function skillKeys(id){return {objective:['objective_reasoning','causal_planning_state_transition'],control:['control_reasoning','causal_planning_control_requirements'],cards:['entry_selection','queen_structure','effective_winner_reasoning'],next:['useful_void_reasoning','causal_planning_state_transition'],preserve:['exit_preservation','causal_planning_preservation']}[id]||['hand_reading'];}
  function submitStep(response){
    const step=steps[stepIndex];
    if(!(response.text||response.choice)){document.getElementById('tutorAnswer')?.focus();return;}
    const result=core.evaluate(step,response,{exercise,answers});
    answers[step.id]=response.text||response.choice;
    renderFeedback(step,result,response);
  }
  function renderFeedback(step,result,response){
    const body=document.getElementById('tutorBody');
    const level=result.score>=0.8?'Strong reasoning':result.score>=0.58?'Good start':'Needs another look';
    body.innerHTML=`<div class="tutor-grid"><div class="tutor-card"><div class="feedback-badge score-${result.score>=0.8?'high':result.score>=0.58?'mid':'low'}">${level}</div><h3>Your thinking</h3><p>${esc(response.text||response.choice)}</p><h3>Tutor feedback</h3><p>${esc(result.feedback)}</p>${result.score<0.58?`<div class="hint-panel"><strong>Scaffold</strong><p>${esc(hintFor(step.id))}</p></div>`:''}<div class="tutor-actions"><button id="continueTutor" class="primary">${stepIndex===steps.length-1?'Review full pathway':'Continue'}</button>${result.score<0.5?'<button id="retryTutor" class="secondary">Revise answer</button>':''}</div></div><div class="tutor-card pathway-live"><h3>Your developing pathway</h3>${renderPathwaySoFar()}</div></div>`;
    document.getElementById('continueTutor').onclick=()=>{stepIndex++;if(stepIndex>=steps.length)renderReview();else renderStep();};
    const r=document.getElementById('retryTutor');if(r)r.onclick=()=>renderStep();
  }
  function hintFor(id){return {objective:'Do not start with the shortest suit or highest card. Ask what future problem is most likely to trap you.',control:'Ask whether winning the lead helps the objective or merely gives opponents a chance to dump points on you.',cards:'Name the exact cards doing jobs: protection, entry, exit, or future-winner liability.',next:'A successful phase should create a new opportunity. What becomes possible only after X succeeds?',preserve:'Which low or control card looks expendable now but has a job in the next phase?'}[id]||'Work backward from the future position you want.';}
  function renderPathwaySoFar(){
    const labels={objective:'I want to accomplish X',control:'To accomplish X, I need',cards:'I can obtain that state with',next:'Once X happens, my next objective becomes Y',preserve:'These cards must be preserved because Y depends on them'};
    return steps.map(s=>`<div class="pathway-line"><span>${labels[s.id]}</span><strong>${esc(answers[s.id]||'…')}</strong></div>`).join('');
  }
  function renderReview(){
    const expert=window.CancellationHeartsTutorAdapter.expertModel(exercise);
    const body=document.getElementById('tutorBody');
    const weak=core.masterySummary().slice(0,4);
    body.innerHTML=`<div class="tutor-grid"><div class="tutor-card"><h3>Your pathway</h3>${renderPathwaySoFar()}<h3>Expert comparison</h3><p><strong>Expert read:</strong> ${esc(expert.read)}</p><p><strong>Strategy:</strong> ${esc(expert.strategy)}</p><ol>${expert.pathway.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div><div class="tutor-card"><h3>Adaptive profile</h3><p>The tutor will use these estimates to choose how much scaffolding and what kind of next hand you receive.</p>${weak.map(x=>`<div class="mastery-row"><span>${esc(x.skill.replaceAll('_',' '))}</span><strong>${Math.round(x.value*100)}%</strong></div>`).join('')}<button id="nextTutorHand" class="primary">Next hand</button></div></div>`;
    document.getElementById('nextTutorHand').onclick=beginExercise;
  }
  ensureUI();
  window.CancellationHeartsTutor={core,start:startTutor};
})();
