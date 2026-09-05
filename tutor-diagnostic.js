(function(){
  if(window.CancellationHeartsDiagnostic)return;
  const STORAGE_KEY='cancellationHearts.adaptiveTrainer.runtime.v1';
  const LABELS={beginner:'Beginner',developing:'Developing',advanced:'Advanced',expert:'Expert'};
  const SCORE_LABELS=[[15,'expert'],[12,'advanced'],[8,'developing'],[4,'beginner']];
  const HANDS=[
    {id:'diag-1',title:'Hand 1 · Future-winner recognition',difficulty:'Foundation',strategy:'Avoidance',hand:['5C','QC','6D','10D','KD','2S','9S','QS','6H','7H','9H','10H','QH'],phases:[{step:'objective',prompt:'What is the main problem in this hand, and what should your first hand-level objective be? Explain why.'}]},
    {id:'diag-2',title:'Hand 2 · Control with a purpose',difficulty:'Moderate',strategy:'Conditional control',hand:['3C','8C','KC','4D','7D','JD','2S','6S','10S','AS','4H','8H','JH'],phases:[{step:'control',prompt:'Do you want control or to stay off lead at the start? Identify the cards that drive that choice and what would have to become true before you deliberately took control.'}]},
    {id:'diag-3',title:'Hand 3 · Passing toward a pathway',difficulty:'Moderate',strategy:'Pass planning',hand:['4C','7C','JC','AC','3D','8D','QD','2S','5S','QS','3H','9H','KH'],phases:[{step:'prepass_pathway',pass:true,prompt:'Choose exactly three cards to pass. Then explain what you want the hand to become after the pass, why these three cards serve that plan, and what you are trying to preserve.'}]},
    {id:'diag-4',title:'Hand 4 · Rebuild after the pass',difficulty:'Advanced',strategy:'Pathway revision',hand:['2C','6C','10C','KC','5D','9D','AD','4S','8S','JS','4H','7H','QH'],received:['QC','3S','10H'],phases:[{step:'prepass_pathway',pass:true,prompt:'Choose exactly three cards to pass and state the pathway you are trying to create.'},{step:'postpass_pathway',postpass:true,prompt:'Now rebuild the pathway. What changed because of the incoming cards? What is your first objective now, and what must you preserve for the phase after that?'}]},
    {id:'diag-5',title:'Hand 5 · Table-level strategy',difficulty:'High',strategy:'Threats and targeting',hand:['3C','9C','AC','2D','6D','JD','KD','5S','9S','KS','5H','10H','AH'],phases:[{step:'threat',prompt:'Assume one opponent has captured the first several penalty cards and still appears able to control play. What evidence would make you treat a moon attempt as a real threat, and how would you intervene without unnecessarily abandoning your own pathway?'},{step:'target',prompt:'Later in the hand, what specific evidence would make you smartly target one opponent, and what evidence would make you avoid targeting them?'}]}
  ];
  function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function label(code){return window.CancellationHeartsTutorAdapter?.cardLabel?.(code)||code;}
  function red(code){return /[DH]$/.test(code)?' red':'';}
  function cards(hand,selected=new Set(),clickable=false){return `<div class="tutor-hand diagnostic-hand">${hand.map((c,i)=>`<${clickable?'button':'span'} ${clickable?'type="button"':''} class="mini-card diagnostic-card${red(c)}${selected.has(i)?' tutor-highlight selected':''}" ${clickable?`data-diag-pass="${i}"`:''}>${esc(label(c))}</${clickable?'button':'span'}>`).join('')}</div>`;}
  function persist(core){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(core.state));}catch(e){}}
  function dimension(mean){if(mean>=.88)return 4;if(mean>=.74)return 3;if(mean>=.56)return 2;return 1;}
  function consistency(scores){const strong=scores.filter(s=>s>=.78).length;if(strong>=5)return 4;if(strong>=4)return 3;if(strong>=2)return 2;return 1;}
  function labelFor(total){for(const [min,l] of SCORE_LABELS)if(total>=min)return l;return 'beginner';}
  function scoreDiagnostic(results){
    const handScores=HANDS.map((h,i)=>{const xs=results.filter(r=>r.handIndex===i).map(r=>r.score);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;});
    const all=results.map(r=>r.score),mean=all.reduce((a,b)=>a+b,0)/Math.max(1,all.length);
    const transfer=results.filter(r=>r.handIndex>=3).map(r=>r.score),transferMean=transfer.reduce((a,b)=>a+b,0)/Math.max(1,transfer.length);
    const ratings={understanding:dimension(mean),consistency:consistency(handScores),independence:dimension(mean),transfer:dimension(transferMean)};
    const total=Object.values(ratings).reduce((a,b)=>a+b,0),level=labelFor(total);
    return {version:1,completed:true,completedAt:new Date().toISOString(),ratings,total,maximum:16,level,label:LABELS[level],handScores:handScores.map(x=>Math.round(x*100)),responses:results.length};
  }
  function postHand(hand,passed,received){const remaining=[...hand];for(const c of passed){const i=remaining.indexOf(c);if(i>=0)remaining.splice(i,1);}return [...remaining,...received];}
  async function start({core,beginExercise}){
    const body=document.getElementById('tutorBody');if(!body)return;
    let handIndex=0,phaseIndex=0,results=[],passedByHand={},selected=new Set(),draft='';
    core.state.diagnostic={completed:false,startedAt:new Date().toISOString(),handIndex:0};persist(core);
    function current(){return HANDS[handIndex];}
    function progress(){return `<div class="diagnostic-progress">${HANDS.map((_,i)=>`<span class="${i<handIndex?'done':i===handIndex?'active':''}">${i+1}</span>`).join('')}</div>`;}
    function render(feedback=''){
      const h=current(),p=h.phases[phaseIndex],passing=p.pass===true;
      const passed=passedByHand[h.id]||[];
      const activeHand=p.postpass?postHand(h.hand,passed,h.received||[]):h.hand;
      const incoming=p.postpass?`<div class="diagnostic-pass-summary"><strong>You passed:</strong> ${passed.map(label).join(', ')||'—'}<br><strong>You received:</strong> ${(h.received||[]).map(label).join(', ')}</div>`:'';
      body.innerHTML=`<div class="tutor-card diagnostic-shell"><div class="eyebrow">Opening diagnostic · Hand ${handIndex+1} of 5</div><h3>${esc(h.title)}</h3><p class="diagnostic-meta">${esc(h.difficulty)} · ${esc(h.strategy)}</p>${progress()}<p class="diagnostic-note">No hints or worked examples are used during placement.</p>${cards(activeHand,selected,passing)}${passing?`<div class="passing-count">Selected: <strong>${selected.size}/3</strong></div>`:''}${incoming}<div class="tutor-question">${esc(p.prompt)}</div><textarea id="diagnosticAnswer" rows="6" placeholder="Explain your reasoning.">${esc(draft)}</textarea>${feedback?`<div class="hint-panel diagnostic-validation">${esc(feedback)}</div>`:''}<div class="tutor-actions"><button id="diagnosticSubmit">Submit response</button></div></div>`;
      if(passing)body.querySelectorAll('[data-diag-pass]').forEach(btn=>btn.onclick=()=>{draft=document.getElementById('diagnosticAnswer')?.value||draft;const i=Number(btn.dataset.diagPass);if(selected.has(i))selected.delete(i);else if(selected.size<3)selected.add(i);render();});
      document.getElementById('diagnosticSubmit').onclick=submit;
    }
    async function submit(){
      const h=current(),p=h.phases[phaseIndex],text=document.getElementById('diagnosticAnswer').value.trim();
      if(!text)return render('Explain your reasoning before continuing.');
      let responseText=text,exercise={...h,source:'random',expert:null,prompts:{}};
      if(p.pass){if(selected.size!==3)return render('Choose exactly three cards before submitting this response.');const pass=[...selected].sort((a,b)=>a-b).map(i=>h.hand[i]);passedByHand[h.id]=pass;responseText=`${text}\nPass cards: ${pass.join(', ')}`;}
      if(p.postpass){exercise={...exercise,hand:postHand(h.hand,passedByHand[h.id]||[],h.received||[]),prePassHand:h.hand,passedCards:passedByHand[h.id]||[],receivedCards:h.received||[]};}
      const beforeAssisted=core.state.currentHandAssisted;core.state.currentHandAssisted=false;
      const result=await core.evaluate({id:p.step},{text:responseText},{exercise,answers:{diagnostic:true,passedCards:passedByHand[h.id]||[],receivedCards:h.received||[]}});
      core.state.currentHandAssisted=beforeAssisted;
      results.push({handIndex,phaseIndex,step:p.step,score:Number(result.score)||0});
      draft='';selected=new Set();phaseIndex++;
      if(phaseIndex>=h.phases.length){handIndex++;phaseIndex=0;}
      core.state.diagnostic={completed:false,startedAt:core.state.diagnostic.startedAt,handIndex,results};persist(core);
      if(handIndex>=HANDS.length)return finish();
      render();
    }
    function finish(){
      const summary=scoreDiagnostic(results);core.state.diagnostic=summary;core.state.selfLevel=summary.level;core.profile=core.state;persist(core);
      body.innerHTML=`<div class="tutor-card diagnostic-results"><div class="eyebrow">Diagnostic complete</div><h3>Starting level: ${esc(summary.label)}</h3><p>Your placement is based on the same four assessment dimensions used by the Adaptive Trainer.</p><div class="diagnostic-dimensions">${Object.entries(summary.ratings).map(([k,v])=>`<div><span>${esc(k)}</span><strong>${v}/4</strong></div>`).join('')}</div><div class="framework-callout"><strong>Overall:</strong> ${summary.total}/16. This is a starting placement, not a permanent label. Ongoing independent and transfer evidence can move the level in either direction.</div><div class="tutor-actions"><button id="beginPlacedTutor">Begin at ${esc(summary.label)}</button></div></div>`;
      document.getElementById('beginPlacedTutor').onclick=beginExercise;
      window.dispatchEvent(new CustomEvent('hearts-diagnostic-complete',{detail:summary}));
    }
    render();
  }
  window.CancellationHeartsDiagnostic={HANDS,start,scoreDiagnostic};
})();
