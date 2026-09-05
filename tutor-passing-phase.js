(function(){
  if(window.CancellationHeartsPassingPhase)return;
  const LEVELS=new Set(['developing','advanced','expert']);
  const DIRECTIONS=['one seat left','one seat right','two seats left','two seats right','three seats left','three seats right','across'];
  function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function label(code){return window.CancellationHeartsTutorAdapter?.cardLabel?.(code)||code;}
  function red(code){return /[DH]$/.test(code)?' red':'';}
  function buildDoubleDeck(){const ranks=['2','3','4','5','6','7','8','9','10','J','Q','K','A'],suits=['C','D','S','H'],deck=[];for(let copy=0;copy<2;copy++)for(const s of suits)for(const r of ranks)deck.push(r+s);return deck;}
  function unseenDeck(hand){const deck=buildDoubleDeck();for(const code of hand){const i=deck.indexOf(code);if(i>=0)deck.splice(i,1);}for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;}
  function handAfterPass(hand,selectedIndices){const chosen=new Set(selectedIndices),passed=hand.filter((_,i)=>chosen.has(i)),kept=hand.filter((_,i)=>!chosen.has(i)),incoming=unseenDeck(hand).slice(0,3);return {passed,incoming,hand:[...kept,...incoming]};}
  function cardsMarkup(hand,selected=new Set(),clickable=false){return `<div class="tutor-hand passing-hand">${hand.map((c,i)=>`<${clickable?'button':'span'} ${clickable?'type="button"':''} class="mini-card passing-card${red(c)}${selected.has(i)?' tutor-highlight selected':''}" ${clickable?`data-pass-index="${i}"`:''}>${esc(label(c))}</${clickable?'button':'span'}>`).join('')}</div>`;}
  function feedbackMarkup(result){const text=result?.feedback||result?.diagnosis?.missing||'';return text?`<div class="hint-panel passing-feedback">${esc(text)}</div>`:'';}
  function shouldRun(profile,exercise){return LEVELS.has(profile?.selfLevel)&&Array.isArray(exercise?.hand)&&exercise.hand.length===13;}
  async function start({core,exercise,onComplete}){
    const body=document.getElementById('tutorBody');if(!body)return onComplete(exercise);
    const originalHand=[...exercise.hand],direction=DIRECTIONS[(core.state.totalInteractions||0)%DIRECTIONS.length];
    const selected=new Set();let preDraft='',postDraft='';
    function renderPre(lastResult=null){
      body.innerHTML=`<div class="tutor-card passing-phase"><div class="eyebrow">Developing skill: passing</div><h3>Plan before the pass</h3><p>You will pass <strong>three cards ${esc(direction)}</strong>. Before seeing what comes back, decide what you want the hand to become.</p>${cardsMarkup(originalHand,selected,true)}<div class="passing-count">Selected: <strong>${selected.size}/3</strong></div><label class="passing-label" for="prePassPlan">Your pathway before the pass</label><textarea id="prePassPlan" rows="5" placeholder="What is your hand-level objective? Which three cards are you passing, why those three, and what do you hope the hand can do afterward?">${esc(preDraft)}</textarea>${feedbackMarkup(lastResult)}<div class="tutor-actions"><button id="submitPrePass">Evaluate pass plan</button></div></div>`;
      const area=document.getElementById('prePassPlan');area.oninput=()=>{preDraft=area.value;};
      body.querySelectorAll('[data-pass-index]').forEach(btn=>btn.onclick=()=>{preDraft=area.value;const i=Number(btn.dataset.passIndex);if(selected.has(i))selected.delete(i);else if(selected.size<3)selected.add(i);renderPre(lastResult);});
      document.getElementById('submitPrePass').onclick=async()=>{
        preDraft=area.value.trim();if(selected.size!==3||!preDraft){renderPre({feedback:selected.size!==3?'Choose exactly three cards before submitting the pass plan.':'Explain the pathway you want the pass to create.'});return;}
        const codes=[...selected].sort((a,b)=>a-b).map(i=>originalHand[i]);
        const response={text:`${preDraft}\nPass cards: ${codes.join(', ')}`};
        const result=await core.evaluate({id:'prepass_pathway'},response,{exercise:{...exercise,hand:originalHand},answers:{passCards:codes,prePassPlan:preDraft}});
        if((result.score??0)<0.78){renderPre(result);return;}
        const changed=handAfterPass(originalHand,[...selected]);
        renderPost(changed,preDraft,null);
      };
    }
    function renderPost(changed,prePlan,lastResult=null){
      const postExercise={...exercise,expert:null,hand:[...changed.hand],prePassHand:originalHand,passedCards:changed.passed,receivedCards:changed.incoming,passDirection:direction,source:exercise.source||'curated'};
      body.innerHTML=`<div class="tutor-card passing-phase"><div class="eyebrow">After the pass</div><h3>Rebuild the pathway</h3><p>You passed <strong>${changed.passed.map(label).join(', ')}</strong> and received <strong>${changed.incoming.map(label).join(', ')}</strong>.</p><div class="passing-comparison"><div><h4>Before</h4>${cardsMarkup(originalHand)}</div><div><h4>After</h4>${cardsMarkup(changed.hand)}</div></div><div class="framework-callout"><strong>Your pre-pass plan:</strong> ${esc(prePlan)}</div><label class="passing-label" for="postPassPlan">Your pathway after the pass</label><textarea id="postPassPlan" rows="6" placeholder="What changed? What is safer or more dangerous now? What is your first objective, and which cards must be preserved for the next phase?">${esc(postDraft)}</textarea>${feedbackMarkup(lastResult)}<div class="tutor-actions"><button id="submitPostPass">Evaluate revised pathway</button></div></div>`;
      const area=document.getElementById('postPassPlan');area.oninput=()=>{postDraft=area.value;};
      document.getElementById('submitPostPass').onclick=async()=>{
        postDraft=area.value.trim();if(!postDraft){renderPost(changed,prePlan,{feedback:'Explain how the incoming cards changed or confirmed the pathway.'});return;}
        const result=await core.evaluate({id:'postpass_pathway'},{text:postDraft},{exercise:postExercise,answers:{prePassPlan:prePlan,passCards:changed.passed,receivedCards:changed.incoming,postPassPlan:postDraft}});
        if((result.score??0)<0.78){renderPost(changed,prePlan,result);return;}
        postExercise.passing={direction,prePlan,postPlan:postDraft,passed:[...changed.passed],received:[...changed.incoming]};
        onComplete(postExercise);
      };
    }
    renderPre();
  }
  window.CancellationHeartsPassingPhase={shouldRun,start};
})();
