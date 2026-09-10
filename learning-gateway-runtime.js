(async function installLearningGatewayRuntime(){
  const api=await import('./learning-gateway-client.mjs');
  const STORAGE_KEY='cancellationHearts.learningGateway.mode';
  const DEFAULT_MODE='gateway';
  const allowed=new Set(['legacy','gateway','parity']);
  const runtime={
    mode:DEFAULT_MODE,
    lastResults:{},
    parityResults:{},
    lastError:null,
    gatewayBaseUrl:'',
    setMode,
    getMode:()=>runtime.mode,
    refreshCoach,
    execute,
    evaluatePlay,
    requestNextActivity,
    status:()=>({mode:runtime.mode,gatewayBaseUrl:runtime.gatewayBaseUrl,lastError:runtime.lastError,parityResults:{...runtime.parityResults}})
  };

  function configuredMode(){
    const query=new URLSearchParams(location.search).get('learningMode');
    if(allowed.has(query)) return query;
    try{const stored=localStorage.getItem(STORAGE_KEY);if(allowed.has(stored))return stored;}catch{}
    return DEFAULT_MODE;
  }
  function configuredBaseUrl(){
    const explicit=typeof window.CANCELLATION_HEARTS_GATEWAY_BASE_URL==='string'?window.CANCELLATION_HEARTS_GATEWAY_BASE_URL.trim():'';
    const meta=document.querySelector('meta[name="uls-learning-gateway-base-url"]')?.content?.trim()||'';
    return (explicit||meta).replace(/\/$/,'');
  }
  function setMode(value,{persist=true}={}){
    runtime.mode=api.normalizeMigrationMode(value,DEFAULT_MODE);
    if(persist){try{localStorage.setItem(STORAGE_KEY,runtime.mode);}catch{}}
    return runtime.mode;
  }
  runtime.mode=configuredMode();
  runtime.gatewayBaseUrl=configuredBaseUrl();
  const client=api.createLearningGatewayClient({baseUrl:runtime.gatewayBaseUrl});

  function appState(){return state;}
  function visibleState(){return api.adaptLearnerVisibleState(appState());}
  function observableCards(cards){return (cards||[]).map(card=>({...(card.id?{id:card.id}:{}),code:`${card.rank}${card.suit}`,rank:card.rank,suit:card.suit}));}
  function currentContext(){
    return {
      strategy:state.coachStrategy??undefined,
      weights:state.coachWeights??undefined,
      legalCards:state.phase==='playing'&&state.currentPlayer===0?legalCards(0):[]
    };
  }
  function code(card){return card?`${card.rank}${card.suit}`:null;}

  function legacyOperation(operation,context={}){
    const m=typeof humanHandMetrics==='function'&&state.players.length?humanHandMetrics():null;
    switch(operation){
      case 'assess-hand':{
        const strategy=m?recommendedStrategy(m):null;
        return strategy?{strategy,summary:`Legacy coach recommends ${STRATEGY_LABELS[strategy]}.`}:null;
      }
      case 'recommend-strategy':return m?recommendedStrategy(m):null;
      case 'rejected-strategies':{
        if(!m)return[];const rec=recommendedStrategy(m);
        return Object.keys(STRATEGY_LABELS).filter(strategy=>strategy!==rec).map(strategy=>({strategy,...(()=>{const [fit,missing,trap]=rejectedStrategyDetails(strategy,m,rec);return{fit,missing,trap};})()}));
      }
      case 'recommend-passing':{
        if(!m)return null;const strategy=context.strategy??state.coachStrategy??recommendedStrategy(m);
        const ranked=m.hand.map(card=>passCardScoreForStrategy(card,m,strategy)).sort((a,b)=>b.score-a.score);
        return{primary:ranked.slice(0,3).map(row=>({card:{code:code(row.card)}})),secondary:ranked.slice(3,6).map(row=>({card:{code:code(row.card)}}))};
      }
      case 'recommend-play':{
        const ranked=rankHumanLegalCards(context.legalCards??(state.phase==='playing'&&state.currentPlayer===0?legalCards(0):[]));
        return{recommended:ranked[0]??null,alternatives:ranked.slice(1,4)};
      }
      case 'detect-pivot':{
        const active=context.strategy??state.coachStrategy;
        if(!active)return{needed:false,from:null,to:null};
        const viability=strategyViability(active);
        return viability.viable?{needed:false,from:active,to:active}:{needed:true,from:active,to:viability.suggestions?.[0]??'avoidance'};
      }
      case 'moon-defense':{
        const threat=currentMoonThreat();
        return{required:Boolean(threat?.credible),objective:threat?.credible?'Force penalty points to a different collector.':'Continue ordinary strategy while preserving a stopper.'};
      }
      case 'analyze-opponents':return state.players.slice(1).map((player,index)=>({seat:index+1,name:player.name,...inferOpponent(index+1)}));
      case 'post-hand':return{originalStrategy:state.originalStrategy??state.coachStrategy??null,pivot:{needed:Boolean(state.strategyPivots?.length)}};
      case 'post-game':{
        if(!state.players.length)return null;const ordered=[...state.players].map((player,seat)=>({player,seat})).sort((a,b)=>a.player.score-b.player.score);
        return{learnerScore:state.players[0].score,placement:ordered.findIndex(row=>row.seat===0)+1};
      }
      case 'evaluate-play':{
        const ranked=rankHumanLegalCards(context.legalCards??[]);const chosen=context.chosenCardCode;const selected=ranked.find(row=>code(row.card)===chosen);
        return{recommendedCardCode:code(ranked[0]?.card),chosenCardCode:chosen,chosenDecisionScore:selected?.total??null,ambiguous:ranked.length>1&&Math.abs((ranked[0]?.total??0)-(ranked[1]?.total??0))<2,realizedOutcomeUsedForScoring:false};
      }
      case 'next-activity':return{familyId:null,targetSkillId:context.targetSkillId??null};
      default:return null;
    }
  }

  async function execute(operation,context={},capturedState=null){
    if(runtime.mode==='legacy') return{source:'legacy',result:legacyOperation(operation,context)};
    const learnerVisibleState=capturedState??visibleState();
    const operationInput=api.buildOperationInput(operation,context);
    let gateway;
    try{
      gateway=await client.execute(operation,learnerVisibleState,operationInput);
      runtime.lastError=null;
      runtime.lastResults[operation]=gateway;
    }catch(error){
      runtime.lastError={operation,code:error?.code||'gateway-unavailable',message:error?.message||'Learning service unavailable'};
      throw error;
    }
    if(runtime.mode==='parity'){
      const legacy=legacyOperation(operation,context);
      runtime.parityResults[operation]=api.compareSemanticOutputs(operation,legacy,gateway);
    }
    return{source:'gateway',result:gateway};
  }

  function escape(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function cardText(row){return escape(row?.card?.code??row?.code??'');}
  function dispositionMessage(result){
    if(result.disposition==='unsupported')return'<p>This coaching operation is not supported by the active Domain Runtime.</p>';
    if(result.disposition==='abstained')return'<p>The coach abstained because the supplied decision context was not sufficient to make a reliable judgment.</p>';
    return null;
  }
  function renderAssessment(result){
    const box=$('coachAssessment');if(!box)return;const d=result.output;const message=dispositionMessage(result);if(message){box.innerHTML=message;return;}if(!d)return;
    box.innerHTML=`<div class="assessment-card"><h4>Gateway assessment</h4><p>${escape(d.summary)}</p><p><strong>Strategy:</strong> ${escape(d.label??d.strategy)}</p><p><strong>Control:</strong> ${escape(d.control)} · <strong>Void candidate:</strong> ${escape(d.voidCandidate)}</p><p><strong>Spade vulnerability:</strong> ${escape(d.spadeVulnerability?.level??'unknown')}</p></div>`;
  }
  function renderStrategy(result){
    const box=$('coachRecommendation');if(!box)return;const message=dispositionMessage(result);if(message){box.innerHTML=message;return;}const strategy=result.output;if(!strategy)return;
    box.innerHTML=`<p><strong>Gateway recommendation:</strong> ${escape(STRATEGY_LABELS[strategy]??strategy)}</p>`;
    if(!state.coachStrategy){state.coachStrategy=strategy;state.originalStrategy=state.originalStrategy??strategy;$('strategySelect').value=strategy;}
  }
  function renderRejected(result){
    const box=$('rejectedStrategies');if(!box)return;const message=dispositionMessage(result);if(message){box.innerHTML=message;return;}const rows=Array.isArray(result.output)?result.output:[];
    box.innerHTML=rows.map(row=>`<div class="rejected-card"><h4>${escape(row.label??row.strategy)}</h4><ul><li><strong>What fits:</strong> ${escape(row.fit)}</li><li><strong>What is missing:</strong> ${escape(row.missing)}</li><li><strong>Likely trap:</strong> ${escape(row.trap)}</li></ul></div>`).join('');
  }
  function renderPassing(result){
    const box=$('passingRecommendations');if(!box)return;const message=dispositionMessage(result);if(message){box.innerHTML=message;return;}const d=result.output;if(!d)return;
    const group=(label,rows)=>`<div class="passing-card"><h4>${label}</h4><p>${(rows??[]).map(cardText).filter(Boolean).join(', ')||'No recommendation'}</p></div>`;
    box.innerHTML=group('Primary pass',d.primary)+group('Secondary pass',d.secondary);
  }
  function renderPlay(result){
    const box=$('cardRecommendation');if(!box)return;const message=dispositionMessage(result);if(message){box.innerHTML=message;return;}const d=result.output;if(!d)return;
    const rec=d.recommended;box.innerHTML=`<div class="recommendation"><h4>Gateway recommendation: ${cardText(rec)}</h4><p>${escape(rec?.reason??rec?.explanation??'Highest-ranked legal card under the current strategy and weighting.')}</p></div>`;
  }
  function renderPivot(result){
    if(!result.output?.needed)return;const box=$('currentStrategicState');if(!box)return;
    box.insertAdjacentHTML('afterbegin',`<div class="pivot-alert"><h4>Gateway strategy pivot</h4><p>${escape(result.output.trigger??`Move from ${result.output.from} to ${result.output.to}.`)}</p></div>`);
  }
  function renderMoon(result){
    const box=$('currentStrategicState');if(!box||!result.output?.required)return;
    box.insertAdjacentHTML('beforeend',`<div class="critical"><h4>Moon defense</h4><p>${escape(result.output.objective)}</p><p>${escape(result.output.intervention)}</p></div>`);
  }
  function renderOpponents(result){
    const box=$('opponentAnalysis');if(!box)return;const rows=Array.isArray(result.output)?result.output:[];
    box.innerHTML=rows.map(row=>`<div class="opponent-card"><h4>${escape(row.name)}</h4><div class="confidence">${escape(row.observations)} observed plays · ${Math.round(Number(row.confidence||0)*100)}% confidence</div><p class="evidence">Candidates: ${escape((row.personaCandidates??[]).join(', '))}</p></div>`).join('');
  }
  function renderPostHand(result){const box=$('postHandAnalysis');if(box&&result.output)box.innerHTML=`<div class="post-card"><h4>Gateway post-hand assessment</h4><p>${escape(result.output.analysis)}</p><p><strong>Original strategy:</strong> ${escape(result.output.originalStrategy)}</p><p><strong>Hand points:</strong> ${escape(result.output.handPoints)}</p></div>`;}
  function renderPostGame(result){const box=$('postGameAnalysis');if(box&&result.output)box.innerHTML=`<div class="post-card"><h4>Gateway post-game review</h4><p>${escape(result.output.focus)}</p><p><strong>Placement:</strong> ${escape(result.output.placement)} · <strong>Score:</strong> ${escape(result.output.learnerScore)}</p></div>`;}
  const renderers={
    'assess-hand':renderAssessment,'recommend-strategy':renderStrategy,'rejected-strategies':renderRejected,
    'recommend-passing':renderPassing,'recommend-play':renderPlay,'detect-pivot':renderPivot,'moon-defense':renderMoon,
    'analyze-opponents':renderOpponents,'post-hand':renderPostHand,'post-game':renderPostGame
  };

  async function runAndRender(operation,context){
    const {result}=await execute(operation,context);
    if(runtime.mode==='gateway')renderers[operation]?.(result);
    return result;
  }
  async function refreshCoach(){
    if(runtime.mode==='legacy'||!state.players?.length)return;
    const context=currentContext();
    const operations=['assess-hand','recommend-strategy','rejected-strategies','recommend-passing','detect-pivot','moon-defense','analyze-opponents'];
    if(state.phase==='playing'&&state.currentPlayer===0)operations.push('recommend-play');
    if(state.lastPostAnalysis)operations.push('post-hand');
    if(state.gameOver)operations.push('post-game');
    const settled=await Promise.allSettled(operations.map(operation=>runAndRender(operation,context)));
    const rejected=settled.find(row=>row.status==='rejected');
    if(rejected&&runtime.mode==='gateway'){
      const box=$('coachRecommendation');if(box)box.insertAdjacentHTML('beforeend',`<p class="evidence">Learning service: ${escape(rejected.reason?.message??'unavailable')}</p>`);
    }
  }

  async function evaluatePlay(chosenCard,decision={}){
    if(runtime.mode==='legacy')return null;
    const captured=api.adaptLearnerVisibleState(state);
    const legal=decision.legalCards??(state.phase==='playing'&&state.currentPlayer===0?legalCards(0):[]);
    const context={...currentContext(),...decision,legalCards:legal,chosenCardCode:decision.chosenCardCode??code(chosenCard)};
    return execute('evaluate-play',context,captured);
  }
  async function requestNextActivity(targetSkillId,seed){
    if(runtime.mode==='legacy')return null;
    return execute('next-activity',{targetSkillId,seed});
  }

  let scheduled=false;
  function scheduleRefresh(){
    if(runtime.mode==='legacy'||scheduled)return;scheduled=true;
    queueMicrotask(()=>{scheduled=false;void refreshCoach();});
  }
  function wrapRenderer(name){
    const original=window[name];if(typeof original!=='function')return;
    window[name]=function(...args){const result=original.apply(this,args);scheduleRefresh();return result;};
  }
  ['renderCoach','renderStrategyOverview','renderRejectedStrategies','renderPassingRecommendations','renderCardRecommendation','renderOpponentAnalysis','renderPostHandAnalysis','renderPostGameAnalysis'].forEach(wrapRenderer);

  const originalPlayCard=window.playCard;
  if(typeof originalPlayCard==='function'){
    window.playCard=function(playerIndex,card){
      if(playerIndex!==0||runtime.mode==='legacy')return originalPlayCard.apply(this,arguments);
      const legal=legalCards(0);const captured=api.adaptLearnerVisibleState(state);
      const context={...currentContext(),legalCards:legal,chosenCardCode:code(card)};
      const result=originalPlayCard.apply(this,arguments);
      void execute('evaluate-play',context,captured).catch(error=>console.warn('ULS evaluate-play failed:',error?.code||error?.message));
      return result;
    };
  }

  window.CancellationHeartsLearningRuntime=Object.freeze(runtime);
  window.__cancellationHeartsLearningGateway={
    schemaVersion:1,
    domainId:'cancellation-hearts',
    modes:['legacy','gateway','parity'],
    defaultMode:DEFAULT_MODE,
    learnerVisibleOnly:true,
    serviceCredentialsInBrowser:false,
    operations:[...api.LEARNING_OPERATIONS]
  };
  if(runtime.mode!=='legacy'&&state.players?.length)scheduleRefresh();
})().catch(error=>{
  console.error('ULS Learning Gateway integration failed to initialize:',error);
  window.__cancellationHeartsLearningGateway={schemaVersion:1,status:'initialization-failed'};
});
