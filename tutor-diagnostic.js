(function(){
  if(window.CancellationHeartsDiagnostic)return;
  const STORAGE_KEY='cancellationHearts.adaptiveTrainer.runtime.v1';
  const BLUEPRINT_ID='hearts-opening-diagnostic-v1';
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
  function detailedScores(evidence,scoredRecords=[]){return evidence.map((e,i)=>{const xs=scoredRecords[i]?.normalizedResponse?.phaseScores;if(Array.isArray(xs)&&xs.length)return xs.reduce((a,b)=>a+Number(b||0),0)/xs.length;return Number(e.score?.value)||0;});}
  function scorePlacement(evidence,assessmentResult,scoredRecords=[],calibrationSnapshot=null){
    const scores=detailedScores(evidence,scoredRecords),mean=scores.reduce((a,b)=>a+b,0)/Math.max(1,scores.length);
    const transferScores=scores.slice(-2),transferMean=transferScores.reduce((a,b)=>a+b,0)/Math.max(1,transferScores.length);
    const independentIndexes=evidence.map((e,i)=>e.eligibility?.learnerModel&&e.administration?.independent?i:null).filter(Number.isInteger),indScores=independentIndexes.map(i=>scores[i]),indMean=indScores.reduce((a,b)=>a+b,0)/Math.max(1,indScores.length);
    const ratings={understanding:dimension(mean),consistency:consistency(scores),independence:dimension(indMean),transfer:dimension(transferMean)};
    const total=Object.values(ratings).reduce((a,b)=>a+b,0),level=labelFor(total);
    return {version:3,assessmentCoreSchemaVersion:window.CancellationHeartsAssessmentCore?.schemaVersion||null,calibrationCoreSchemaVersion:window.CancellationHeartsCalibrationCore?.schemaVersion||null,source:'adaptive-trainer-assessment-core+calibration-core',blueprintId:BLUEPRINT_ID,completed:true,completedAt:new Date().toISOString(),ratings,total,maximum:16,level,label:LABELS[level],handScores:scores.map(x=>Math.round(x*100)),responses:evidence.length,assessmentResult,calibration:calibrationSnapshot?{status:calibrationSnapshot.status,observationCount:calibrationSnapshot.observationCount,excludedCount:calibrationSnapshot.excludedCount,uniqueLearners:calibrationSnapshot.uniqueLearners,safeguards:calibrationSnapshot.safeguards}:null,evidence:evidence.map(e=>({evidenceId:e.evidenceId,itemVersionId:e.item?.itemVersionId,constructIds:e.constructIds,score:e.score,eligibility:e.eligibility,administration:e.administration,timing:e.timing}))};
  }
  function postHand(hand,passed,received){const remaining=[...hand];for(const c of passed){const i=remaining.indexOf(c);if(i>=0)remaining.splice(i,1);}return[...remaining,...received];}
  async function start({core,beginExercise}){
    const body=document.getElementById('tutorBody'),assessment=window.CancellationHeartsAssessmentCore,calibration=window.CancellationHeartsCalibrationCore;if(!body)return;if(!assessment)throw new Error('Adaptive Trainer Assessment Core is not loaded');if(!calibration)throw new Error('Adaptive Trainer Calibration Core is not loaded');
    const built=assessment.buildSession({items:HANDS,blueprintId:BLUEPRINT_ID,itemCount:5,learnerKey:core.state.learnerKey||'local-learner'});
    if(built.selection.status!=='ready'||built.selection.selected.length!==5)throw new Error('Five-hand diagnostic assessment is not ready');
    const items=built.selection.selected.map(x=>x.item);let session=built.session,handIndex=0,phaseIndex=0,responses=[],evidence=[],scoredRecords=[],calibrationRecords=[],passedByHand={},selected=new Set(),draft='',phaseResponses=[];
    core.state.diagnostic={completed:false,source:'adaptive-trainer-assessment-core+calibration-core',blueprintId:BLUEPRINT_ID,sessionId:session.sessionId,startedAt:session.startedAtUtc,handIndex:0};persist(core);
    function current(){return items[handIndex];}
    function progress(){return `<div class="diagnostic-progress">${items.map((_,i)=>`<span class="${i<handIndex?'done':i===handIndex?'active':''}">${i+1}</span>`).join('')}</div>`;}
    function ensurePresented(){if(!session.currentItemPresentedAtUtc)session=assessment.markItemPresented({session,item:current()});}
    function render(feedback=''){
      ensurePresented();const h=current(),p=h.phases[phaseIndex],passing=p.pass===true,passed=passedByHand[h.id]||[],activeHand=p.postpass?postHand(h.hand,passed,h.received||[]):h.hand;
      const incoming=p.postpass?`<div class="diagnostic-pass-summary"><strong>You passed:</strong> ${passed.map(label).join(', ')||'—'}<br><strong>You received:</strong> ${(h.received||[]).map(label).join(', ')}</div>`:'';
      body.innerHTML=`<div class="tutor-card diagnostic-shell"><div class="eyebrow">Opening diagnostic · Hand ${handIndex+1} of 5</div><h3>${esc(h.title)}</h3><p class="diagnostic-meta">${esc(h.difficulty)} · ${esc(h.strategy)}</p>${progress()}<p class="diagnostic-note">Standardized assessment: no hints, retries, worked examples, or coaching before submission.</p>${cards(activeHand,selected,passing)}${passing?`<div class="passing-count">Selected: <strong>${selected.size}/3</strong></div>`:''}${incoming}<div class="tutor-question">${esc(p.prompt)}</div><textarea id="diagnosticAnswer" rows="6" placeholder="Explain your reasoning.">${esc(draft)}</textarea>${feedback?`<div class="hint-panel diagnostic-validation">${esc(feedback)}</div>`:''}<div class="tutor-actions"><button id="diagnosticSubmit">Submit response</button></div></div>`;
      if(passing)body.querySelectorAll('[data-diag-pass]').forEach(btn=>btn.onclick=()=>{draft=document.getElementById('diagnosticAnswer')?.value||draft;const i=Number(btn.dataset.diagPass);if(selected.has(i))selected.delete(i);else if(selected.size<3)selected.add(i);render();});
      document.getElementById('diagnosticSubmit').onclick=submit;
    }
    async function submit(){
      const h=current(),p=h.phases[phaseIndex],text=document.getElementById('diagnosticAnswer').value.trim();if(!text)return render('Explain your reasoning before continuing.');
      const phaseRecord={step:p.step,text};if(p.pass){if(selected.size!==3)return render('Choose exactly three cards before submitting this response.');const pass=[...selected].sort((a,b)=>a-b).map(i=>h.hand[i]);passedByHand[h.id]=pass;phaseRecord.passCards=pass;}if(p.postpass){phaseRecord.receivedCards=h.received||[];phaseRecord.postPassHand=postHand(h.hand,passedByHand[h.id]||[],h.received||[]);}phaseResponses.push(phaseRecord);draft='';selected=new Set();phaseIndex++;
      if(phaseIndex<h.phases.length){render();return;}
      const recorded=assessment.recordResponse({session,item:h,rawResponse:{phaseResponses:[...phaseResponses],reasoning:phaseResponses.map(x=>x.text).join('\n\n')},priorResponses:responses,supportBeforeResponse:'none',assistanceKinds:[],firstEncounter:true,context:'opening-diagnostic'});
      session=recorded.session;responses.push(recorded.response);evidence.push(recorded.evidence);scoredRecords.push(recorded.scored);calibrationRecords.push(calibration.prepareObservation(recorded.evidence,{cohort:{assessment:'opening-diagnostic-v1'},metadata:{difficultyPrior:calibration.difficultyForItem(h).value}}));phaseResponses=[];handIndex++;phaseIndex=0;
      core.state.diagnostic={completed:false,source:'adaptive-trainer-assessment-core+calibration-core',blueprintId:BLUEPRINT_ID,sessionId:session.sessionId,startedAt:session.startedAtUtc,handIndex,evidenceCount:evidence.length,calibrationObservationCount:calibrationRecords.filter(r=>r.status==='eligible').length};persist(core);
      if(handIndex>=items.length)return finish();render();
    }
    function finish(){
      const assessmentResult=assessment.result({session,evidence}),calibrationSnapshot=calibration.buildDescriptiveSnapshot(calibrationRecords),summary=scorePlacement(evidence,assessmentResult,scoredRecords,calibrationSnapshot);core.state.diagnostic=summary;core.state.calibration={status:calibrationSnapshot.status,observationCount:calibrationSnapshot.observationCount,excludedCount:calibrationSnapshot.excludedCount,uniqueLearners:calibrationSnapshot.uniqueLearners,items:calibrationSnapshot.items.map(x=>({itemVersionId:x.itemVersionId,observations:x.observations,status:x.status,rawDifficulty:x.rawDifficulty}))};core.state.selfLevel=summary.level;core.profile=core.state;persist(core);
      body.innerHTML=`<div class="tutor-card diagnostic-results"><div class="eyebrow">Diagnostic complete</div><h3>Starting level: ${esc(summary.label)}</h3><p>The five hands were administered by the shared Adaptive Trainer Assessment Core. Eligible first-response evidence is also routed into the shared Calibration Core so hand difficulty can be calibrated as real learner data accumulates.</p><div class="diagnostic-dimensions">${Object.entries(summary.ratings).map(([k,v])=>`<div><span>${esc(k)}</span><strong>${v}/4</strong></div>`).join('')}</div><div class="framework-callout"><strong>Overall:</strong> ${summary.total}/16. This is a starting placement, not a permanent label. Ongoing independent and transfer evidence can move the level in either direction.</div><div class="tutor-actions"><button id="beginPlacedTutor">Begin at ${esc(summary.label)}</button></div></div>`;
      document.getElementById('beginPlacedTutor').onclick=beginExercise;window.dispatchEvent(new CustomEvent('hearts-diagnostic-complete',{detail:summary}));
    }
    render();
  }
  window.CancellationHeartsDiagnostic={HANDS,start,scorePlacement,blueprintId:BLUEPRINT_ID};
})();
