(function integrateCancellationHeartsDomainPack(global){
  'use strict';

  const client=global.CancellationHeartsDomainPackClient;
  const adapter=global.CancellationHeartsGameStateAdapter;
  if(!client||!adapter) throw new Error('Cancellation Hearts Domain Pack bootstrap order is invalid.');

  const STRATEGIES={
    'point-avoidance':'Point avoidance','controlled-aggression':'Controlled aggression','suit-engineering':'Suit engineering',
    'queen-hunting':'Queen hunting','cancellation-oriented':'Cancellation-oriented','lead-control':'Lead control',
    'solo-moon':'Solo moon','moon-defense':'Moon defense','two-player-moon':'Two-player moon'
  };
  const SUIT_NAME={C:'clubs',D:'diamonds',S:'spades',H:'hearts'};
  const integration=state.domainPackIntegration={
    status:'idle',error:null,assessment:null,comparison:null,pass:null,play:null,pivot:null,opponents:null,gameState:null,
    annotations:[],decisionEvaluations:[],hands:[],recommendedStrategy:null,lastPostHandRound:null,postHand:null,postGame:null
  };
  global.__adaptiveTutorLoaded=false;
  global.__causalPlannerLoaded=false;
  global.__trainerArchitecture='cancellation-hearts-app/domain-pack-client-v1/uls';

  const engineRenderHand=renderHand;
  const engineRenderTrick=renderTrick;
  const enginePlayCard=playCard;
  const engineBeginRound=beginRound;
  const engineStartFirstTrick=startFirstTrick;

  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function list(items){return `<ul>${(items||[]).map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`;}
  function cardByDomainId(id,seat=0){const raw=String(id||'').replace(/^card:/,'');return state.players[seat]?.hand.find(card=>String(card.id)===raw)||null;}
  function labelCardId(id,seat=0){const card=cardByDomainId(id,seat);return card?`${card.rank}${SUIT_SYMBOL[card.suit]}`:String(id||'');}
  function canonicalStrategy(value){
    return ({avoidance:'point-avoidance',targeting:'controlled-aggression',cancellation:'cancellation-oriented',soloMoon:'solo-moon',twoMoon:'two-player-moon'})[value]||value||null;
  }
  function normalizeStrategies(){
    state.coachStrategy=canonicalStrategy(state.coachStrategy);
    state.originalStrategy=canonicalStrategy(state.originalStrategy);
    const select=$('strategySelect');
    if(!select)return;
    select.innerHTML=Object.entries(STRATEGIES).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
    if(state.coachStrategy&&STRATEGIES[state.coachStrategy]) select.value=state.coachStrategy;
  }

  function setTrainerStatus(text,kind=''){ 
    const subtitle=$('coachSubtitle'); if(subtitle){subtitle.textContent=text; subtitle.dataset.domainPackStatus=kind;}
  }
  function renderFailure(error){
    integration.status='unavailable'; integration.error=error;
    setTrainerStatus(`Domain Pack unavailable: ${error.message}`,'unavailable');
    const message='<div class="domain-pack-unavailable" role="alert"><strong>Trainer unavailable.</strong><p>The game remains playable, but Hearts coaching is disabled rather than falling back to the retired local trainer.</p></div>';
    for(const id of ['coachAssessment','coachRecommendation','rejectedStrategies','handPathway','passingRecommendations','trickCoach','cardRecommendation','gameStateAnalysis','opponentAnalysis']){
      const node=$(id); if(node)node.innerHTML=message;
    }
  }

  function renderAssessment(){
    const a=integration.assessment,box=$('coachAssessment'); if(!box||!a)return;
    const rows=[
      ['Strengths',a.strengths],['Weaknesses',a.weaknesses],['Danger cards',a.dangerCardIds.map(labelCardId)],
      ['Safe exits',a.safeExitCardIds.map(labelCardId)],['Control cards',a.controlCardIds.map(labelCardId)],
      ['Void opportunities',a.voidOpportunities.map(s=>SUIT_NAME[s]||s)],['Cancellation opportunities',a.cancellationOpportunities],
      ['Vulnerabilities',a.vulnerabilities]
    ];
    box.innerHTML=rows.map(([title,items])=>`<div class="assessment-card"><h4>${esc(title)}</h4>${list(items)}</div>`).join('')+
      `<div class="assessment-card"><h4>Moon / Q♠</h4><p>Moon potential: <strong>${esc(a.moonPotential)}</strong></p><p>Q♠ exposure: <strong>${esc(a.queenOfSpadesExposure)}</strong></p></div>`;
  }

  function renderStrategy(){
    const comparison=integration.comparison;if(!comparison)return;
    const rec=comparison.recommended; integration.recommendedStrategy=rec.strategyId;
    const box=$('coachRecommendation');
    if(box) box.innerHTML=`<strong>Recommended: ${esc(STRATEGIES[rec.strategyId]||rec.strategyId)}</strong><br>${esc(rec.primaryObjective)}<p>Confidence ${Math.round(rec.confidence*100)}%</p>`;
    if(!state.coachStrategy){state.coachStrategy=rec.strategyId;state.originalStrategy=rec.strategyId;}
    normalizeStrategies();
    const overview=$('strategyOverview');
    if(overview) overview.innerHTML=`<div class="pathway-card"><h4>Why this fits</h4>${list(rec.rationale)}</div><div class="pathway-card"><h4>Tactical priorities</h4>${list(rec.tacticalPriorities)}</div><div class="pathway-card"><h4>Desired lead state</h4><p>${esc(rec.desiredLeadState)}</p></div><div class="pathway-card"><h4>Abort / pivot</h4>${list(rec.abortConditions)}${list(rec.pivotTriggers)}</div>`;
    const rejected=$('rejectedStrategies');
    if(rejected) rejected.innerHTML=comparison.rejected.map(item=>`<div class="pathway-card"><h4>${esc(STRATEGIES[item.strategyId]||item.strategyId)}</h4><p><strong>Plausible:</strong> ${esc(item.plausibleBecause)}</p><p><strong>Missing:</strong> ${esc(item.missingRequirement)}</p><p><strong>Risk:</strong> ${esc(item.principalRisk)}</p><p><strong>Trap:</strong> ${esc(item.tacticalTrap)}</p></div>`).join('');
  }

  function renderPathway(){
    const rec=integration.comparison?.recommended,box=$('handPathway');if(!rec||!box)return;
    box.innerHTML=`<div class="pathway-summary"><div><span>Strategy</span><strong>${esc(STRATEGIES[state.coachStrategy]||state.coachStrategy)}</strong></div><div><span>Domain Pack recommendation</span><strong>${esc(STRATEGIES[rec.strategyId]||rec.strategyId)}</strong></div></div><div class="pathway-card"><h4>Desired position</h4><p>${esc(rec.desiredLeadState)}</p></div><div class="pathway-card"><h4>Multi-trick priorities</h4><ol>${rec.tacticalPriorities.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div><div class="pathway-card"><h4>Secondary objectives</h4>${list(rec.secondaryObjectives)}</div><div class="pathway-card"><h4>Pivot conditions</h4>${list(rec.pivotTriggers)}</div>`;
  }

  function renderPass(){
    const p=integration.pass,box=$('passingRecommendations');if(!box)return;
    if(!p){box.innerHTML='<p>No pass recommendation is required in the current phase.</p>';return;}
    const primary=p.primaryCardIds.map(labelCardId).join(', ');
    const secondary=p.secondaryCardIds?p.secondaryCardIds.map(labelCardId).join(', '):'No materially distinct secondary set';
    box.innerHTML=`<div class="pathway-card"><h4>Primary package</h4><p><strong>${esc(primary)}</strong></p>${list(p.rationale)}${list(p.predictedStructureEffect)}</div><div class="pathway-card"><h4>Secondary package</h4><p>${esc(secondary)}</p></div><div class="pathway-card"><h4>Tradeoffs</h4>${list(p.controlChanges)}${list(p.tradeoffs)}</div>`;
  }

  function renderPlay(){
    const p=integration.play;
    for(const id of ['trickCoach','cardRecommendation']){
      const box=$(id);if(!box)continue;
      if(!p||!p.recommendedCardId){box.innerHTML='<p>No learner decision is pending.</p>';continue;}
      box.innerHTML=`<div class="pathway-card"><h4>Recommended action: ${esc(labelCardId(p.recommendedCardId))}</h4><p>${esc(p.immediateConsequence)}</p><p><strong>Future exits:</strong> ${esc(p.futureExitImplications)}</p><p><strong>Lead control:</strong> ${esc(p.leadControlImplications)}</p><p><strong>Strategy:</strong> ${esc(p.strategyCoherence)}</p><p><strong>Risk:</strong> ${esc(p.risk)} · uncertainty ${Math.round(p.uncertainty*100)}%</p>${p.alternatives.length?`<h4>Also defensible</h4>${list(p.alternatives.map(a=>`${labelCardId(a.cardId)}: ${a.rationale}`))}`:''}${p.pivotWarning?`<p class="pathway-warning">${esc(p.pivotWarning)}</p>`:''}</div>`;
    }
  }

  function renderPivot(){
    const p=integration.pivot;if(!p?.pivotRequired)return;
    const box=$('strategyOverview');if(!box)return;
    box.insertAdjacentHTML('afterbegin',`<div class="pathway-card domain-pack-pivot" role="alert"><h4>Strategy pivot required</h4><p><strong>Original:</strong> ${esc(STRATEGIES[p.originalStrategy]||p.originalStrategy)}</p>${list(p.invalidatingEvidence)}<p><strong>Replacement:</strong> ${esc(STRATEGIES[p.replacement?.strategyId]||p.replacement?.strategyId||'Reassess')}</p>${list(p.revisedPriorities)}</div>`);
  }

  function renderGameState(){
    const g=integration.gameState,box=$('gameStateAnalysis');if(!box||!g)return;
    box.innerHTML=`<div class="pathway-card"><h4>Public facts</h4>${list(g.publicFacts)}</div><div class="pathway-card"><h4>Known voids</h4>${list(g.knownVoids.map(v=>`Seat ${v.seatIndex+1}: ${v.suits.map(s=>SUIT_NAME[s]||s).join(', ')}`))}</div><div class="pathway-card"><h4>Outstanding state</h4><p>${g.outstandingPenaltyPoints} penalty points remain outstanding.</p>${list(g.duplicateState)}</div><div class="pathway-card"><h4>Inferences</h4>${list([...g.moonThreats,...g.inferences])}</div>`;
  }

  function renderOpponents(){
    const box=$('opponentAnalysis'),data=integration.opponents;if(!box||!data)return;
    box.innerHTML=data.opponents.map(o=>`<div class="pathway-card"><h4>${esc(state.players[o.seatIndex]?.name||`Seat ${o.seatIndex+1}`)}</h4><p><strong>Observed:</strong></p>${list(o.observedActions.slice(-5))}<p><strong>Inference:</strong> ${esc(o.inferredTendencies.join('; ')||'Insufficient evidence')}</p><p><strong>Possible persona:</strong> ${esc(o.possiblePersona||'Unresolved')} · ${Math.round(o.confidence*100)}%</p>${o.competingExplanation?`<p><strong>Competing explanation:</strong> ${esc(o.competingExplanation)}</p>`:''}</div>`).join('');
  }

  function applyRecommendationHighlight(){
    document.querySelectorAll('#humanHand .card').forEach(node=>node.classList.remove('recommended'));
    const id=integration.play?.recommendedCardId;if(!id)return;
    const raw=String(id).replace(/^card:/,'');
    document.querySelector(`#humanHand .card[data-id="${CSS.escape(raw)}"]`)?.classList.add('recommended');
  }

  async function refreshCoach(){
    if(!state.players?.length)return;
    integration.status='loading';integration.error=null;setTrainerStatus('Loading Cancellation Hearts Domain Pack analysis…','loading');
    normalizeStrategies();
    const visible=adapter.adapt(0);
    try{
      const requests=[
        client.assessHand(visible),client.compareStrategies(visible),client.detectPivot(visible),
        client.analyzeOpponent(visible),client.analyzeGameState(visible),client.getInstructionalAnnotations(visible)
      ];
      const [assessment,comparison,pivot,opponents,gameState,annotations]=await Promise.all(requests);
      integration.assessment=assessment;integration.comparison=comparison;integration.pivot=pivot;
      integration.opponents=opponents;integration.gameState=gameState;integration.annotations=annotations||[];
      integration.pass=state.phase==='passing'?await client.recommendPass(adapter.adapt(0)):null;
      integration.play=state.phase==='playing'&&state.currentPlayer===0?await client.recommendPlay(adapter.adapt(0)):null;
      integration.status='ready';
      setTrainerStatus(`Domain Pack ready · hand ${state.round} · learner-visible state only`,'ready');
      renderAssessment();renderStrategy();renderPathway();renderPass();renderPlay();renderPivot();renderGameState();renderOpponents();
      renderHand();
    }catch(error){renderFailure(error);}
  }

  renderCoach=refreshCoach;
  renderStrategyOverview=()=>{renderStrategy();renderPivot();};
  renderRejectedStrategies=()=>renderStrategy();
  renderHandPathway=renderPathway;
  renderPassingRecommendations=renderPass;
  renderGameStateAnalysis=renderGameState;
  renderTrickCoach=renderPlay;
  renderCardRecommendation=renderPlay;
  renderOpponentAnalysis=renderOpponents;
  rankHumanLegalCards=legal=>{
    const recommended=cardByDomainId(integration.play?.recommendedCardId);
    const ordered=[];
    if(recommended&&legal.some(c=>c.id===recommended.id)) ordered.push({card:recommended,reason:integration.play.immediateConsequence});
    for(const card of legal)if(!ordered.some(item=>item.card.id===card.id))ordered.push({card,reason:'Legal alternative; Domain Pack ranking unavailable in the synchronous game log.'});
    return ordered;
  };
  buildHandPathway=()=>({phase:'Domain Pack pathway',immediate:integration.comparison?.recommended?.primaryObjective||'Await Domain Pack analysis'});
  buildPostGameAnalysis=message=>({source:'domain-pack',message,pending:true});
  saveLearningProfile=()=>{};

  renderHand=function(){
    engineRenderHand();
    const recommended=String(integration.play?.recommendedCardId||'').replace(/^card:/,'');
    document.querySelectorAll('#humanHand .card').forEach(node=>{
      const raw=node.dataset.id,card=state.players[0]?.hand.find(c=>String(c.id)===raw);
      if(!card)return;
      const interactive=state.phase==='passing'||(state.phase==='playing'&&state.currentPlayer===0&&legalCards(0).some(c=>c.id===card.id));
      node.setAttribute('role','button');node.tabIndex=interactive?0:-1;
      node.setAttribute('aria-label',`${card.rank} of ${SUIT_NAME[card.suit]}, physical copy ${card.copy+1}${raw===recommended?', recommended':''}`);
      node.setAttribute('aria-disabled',interactive?'false':'true');
      node.setAttribute('aria-pressed',state.selected.has(card.id)?'true':'false');
      node.onkeydown=event=>{if(interactive&&(event.key==='Enter'||event.key===' ')){event.preventDefault();node.click();}};
      if(raw===recommended)node.classList.add('recommended');
    });
  };

  renderTrick=function(){
    engineRenderTrick();
    const node=$('trick');if(!node)return;
    node.setAttribute('role','status');node.setAttribute('aria-live','polite');
    const cancelled=state.trick.filter(play=>play.cancelled).map(play=>`${play.card.rank} of ${SUIT_NAME[play.card.suit]} by ${state.players[play.player].name}`);
    if(cancelled.length)node.insertAdjacentHTML('beforeend',`<div class="cancellation-a11y"><strong>Cancelled:</strong> ${esc(cancelled.join('; '))}. These cards cannot win.</div>`);
  };

  playCard=function(playerIndex,card){
    if(playerIndex!==0)return enginePlayCard(playerIndex,card);
    const before=adapter.adapt(0),cardId=adapter.cardId(card),attemptId=`hearts:${Date.now()}:${card.id}`;
    const result=enginePlayCard(playerIndex,card);
    client.evaluateDecision({state:before,cardId,learnerRef:'learner:current',attemptId,observedAt:new Date().toISOString()})
      .then(evaluation=>{integration.decisionEvaluations.push(evaluation);return refreshCoach();})
      .catch(error=>{integration.error=error;console.error('Domain Pack decision evaluation failed:',error);});
    return result;
  };

  async function chooseCpuCard(seat){
    const legal=legalCards(seat);if(!legal.length)return null;
    if(state.difficulty==='easy')return legal[Math.floor(Math.random()*legal.length)];
    try{
      const recommendation=await client.recommendPlay(adapter.adapt(seat));
      const candidates=[recommendation.recommendedCardId,...recommendation.alternatives.map(a=>a.cardId)].map(id=>cardByDomainId(id,seat)).filter(Boolean);
      if(state.difficulty==='medium'&&candidates[1]&&Math.random()<0.35)return candidates[1];
      if(state.difficulty==='hard'&&candidates[1]&&Math.random()<0.12)return candidates[1];
      return candidates[0]||legal[0];
    }catch(error){console.warn('Domain Pack CPU recommendation unavailable; using legality-only fallback.',error);return legal[0];}
  }

  continueTurn=function(){
    if(state.trickNumber===0)while(state.openingAutoPlayers.has(state.currentPlayer)&&state.trick.length<8)state.currentPlayer=(state.currentPlayer+1)%8;
    renderAll();
    if(state.currentPlayer===0){setStatus('Your turn. Choose a legal card.');renderHand();refreshCoach();return;}
    const seat=state.currentPlayer;setStatus(`${state.players[seat].name} is thinking…`);
    chooseCpuCard(seat).then(card=>{if(!card)return;setTimeout(()=>{if(state.phase==='playing'&&state.currentPlayer===seat)playCard(seat,card);},Math.round(6000/state.playSpeed));});
  };

  async function domainPassFor(seat){
    const hand=state.players[seat].hand;
    try{
      const recommendation=await client.recommendPass(adapter.adapt(seat));
      const ids=state.difficulty==='easy'&&recommendation.secondaryCardIds?recommendation.secondaryCardIds:recommendation.primaryCardIds;
      const cards=ids.map(id=>cardByDomainId(id,seat)).filter(Boolean);
      return cards.length===3?cards:hand.slice(0,3);
    }catch(error){console.warn('Domain Pack pass recommendation unavailable; using legality-only fallback.',error);return hand.slice(0,3);}
  }

  confirmHumanPass=async function(){
    if(state.selected.size!==3)return;
    const button=$('confirmPassBtn');if(button){button.disabled=true;button.textContent='Passing…';}
    const passes=[...Array(8)];
    passes[0]=[...state.selected].map(id=>state.players[0].hand.find(card=>card.id===id));
    const cpu=await Promise.all(state.players.slice(1).map((_,index)=>domainPassFor(index+1)));
    for(let i=1;i<8;i++)passes[i]=cpu[i-1];
    for(let i=0;i<8;i++)for(const card of passes[i])state.players[i].hand.splice(state.players[i].hand.findIndex(x=>x.id===card.id),1);
    for(let i=0;i<8;i++)state.players[(i+state.passOffset+8)%8].hand.push(...passes[i]);
    state.players.forEach(player=>sortHand(player.hand));state.selected.clear();$('passPanel').classList.add('hidden');
    if(button){button.textContent='Confirm Pass';}renderAll();await refreshCoach();startFirstTrick();
  };
  $('confirmPassBtn').onclick=()=>confirmHumanPass();

  beginRound=function(){
    integration.decisionEvaluations=[];integration.play=null;integration.pass=null;integration.postHand=null;integration.status='idle';
    const result=engineBeginRound();setTimeout(refreshCoach,0);return result;
  };
  startFirstTrick=function(){const result=engineStartFirstTrick();setTimeout(refreshCoach,0);return result;};

  async function requestPostHand(){
    if(!state.players?.length)return;
    try{
      const result=await client.analyzePostHand({state:adapter.adapt(0),decisions:integration.decisionEvaluations});
      integration.postHand=result;
      if(integration.lastPostHandRound!==state.round){integration.hands.push({round:state.round,decisions:[...integration.decisionEvaluations]});integration.lastPostHandRound=state.round;}
      const box=$('postHandAnalysis');if(box)box.innerHTML=`<div class="pathway-card"><h4>Strategy</h4><p>Original: ${esc(STRATEGIES[result.originalStrategy]||result.originalStrategy||'None')}<br>Current: ${esc(STRATEGIES[result.currentStrategy]||result.currentStrategy||'None')}</p></div><div class="pathway-card"><h4>Decision quality</h4>${list(result.executionQuality)}</div><div class="pathway-card"><h4>Next learning priority</h4><p>${esc(result.nextLearningPriority)}</p><p>Decision quality is outcome-independent.</p></div>`;
    }catch(error){const box=$('postHandAnalysis');if(box)box.innerHTML=`<div role="alert">${esc(error.message)}</div>`;}
  }
  renderPostHandAnalysis=()=>{void requestPostHand();};

  async function requestPostGame(){
    if(!state.gameOver)return;
    try{
      const result=await client.analyzePostGame({hands:integration.hands});integration.postGame=result;
      const box=$('postGameAnalysis');if(box)box.innerHTML=`<div class="pathway-card"><h4>Across ${result.handsObserved} hands</h4><p>Recurring strengths</p>${list(result.recurringStrengths)}<p>Recurring weaknesses</p>${list(result.recurringWeaknesses)}<p><strong>Recommended next practice:</strong> ${esc(result.recommendedNextPractice)}</p></div>`;
    }catch(error){const box=$('postGameAnalysis');if(box)box.innerHTML=`<div role="alert">${esc(error.message)}</div>`;}
  }
  renderPostGameAnalysis=()=>{void requestPostGame();};

  function installActivityDialog(){
    if(document.getElementById('domainActivityDialog'))return;
    const dialog=document.createElement('dialog');dialog.id='domainActivityDialog';dialog.className='domain-activity-dialog';
    dialog.innerHTML='<div class="dialog-head"><h3>Targeted practice</h3><button type="button" id="closeDomainActivity">Close</button></div><div id="domainActivityBody"></div>';
    document.body.appendChild(dialog);dialog.querySelector('#closeDomainActivity').onclick=()=>dialog.close();
    const refresh=$('refreshCoachBtn');if(refresh&&!document.getElementById('domainActivityBtn')){
      const button=document.createElement('button');button.id='domainActivityBtn';button.className='secondary compact';button.textContent='Targeted Practice';button.onclick=async()=>{
        try{
          const activity=await client.generateActivity(adapter.adapt(0),integration.postGame?.recommendedNextPractice||'safe-exit');
          const body=dialog.querySelector('#domainActivityBody');
          body.innerHTML=`<p>${esc(activity.prompt)}</p><div class="activity-hand"></div><p class="activity-response" aria-live="polite"></p>`;
          const hand=body.querySelector('.activity-hand');
          for(const visible of activity.state.learnerHand){const card=cardByDomainId(visible.cardId);if(!card)continue;const wrap=document.createElement('button');wrap.type='button';wrap.className='activity-card-button';wrap.innerHTML=cardHtml(card,'');wrap.setAttribute('aria-label',`${card.rank} of ${SUIT_NAME[card.suit]}`);wrap.onclick=()=>{body.querySelector('.activity-response').textContent=`Selected ${card.rank}${SUIT_SYMBOL[card.suit]}. This activity is rendered with the same card primitive as the game.`;};hand.appendChild(wrap);}
          dialog.showModal();
        }catch(error){renderFailure(error);}
      };refresh.after(button);
    }
  }

  $('strategySelect').onchange=()=>{
    if(state.mode==='practice'){state.coachStrategy=state.practiceType==='two'?'two-player-moon':'solo-moon';$('strategySelect').value=state.coachStrategy;return;}
    const next=$('strategySelect').value;
    if(state.coachStrategy&&next!==state.coachStrategy){state.strategyPivots.push({from:state.coachStrategy,to:next,reason:'Learner selected a different strategy from the coach view.'});}
    state.coachStrategy=next;if(!state.originalStrategy)state.originalStrategy=next;void refreshCoach();
  };
  $('refreshCoachBtn').onclick=()=>refreshCoach();

  normalizeStrategies();installActivityDialog();
  setTrainerStatus('Domain Pack integration loaded. Start a game to initialize coaching.','idle');
})(window);
