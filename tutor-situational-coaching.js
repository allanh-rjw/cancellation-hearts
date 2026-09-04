(function(){
  const tutor=window.CancellationHeartsTutor;
  const adapter=window.CancellationHeartsTutorAdapter;
  if(!tutor||!tutor.core||!adapter||tutor.__situationalCoachingInstalled) return;

  function textOfResponse(response){return String(response&&((response.text||response.choice))||'').trim();}
  function norm(s){return String(s||'').toLowerCase().replace(/10s/g,'10♠').replace(/as/g,'a♠').replace(/jh/g,'j♥').replace(/qs/g,'q♠').replace(/qh/g,'q♥').replace(/10h/g,'10♥').replace(/qc/g,'q♣').replace(/10d/g,'10♦').replace(/2s/g,'2♠').replace(/9s/g,'9♠').replace(/3c/g,'3♣').replace(/8c/g,'8♣').replace(/kc/g,'k♣').replace(/4d/g,'4♦').replace(/4h/g,'4♥');}
  function hasReasoning(t){return /\b(because|since|so that|so i can|so i could|in order to|which lets|which allows|that way|therefore|then i can|to avoid|to keep|to make)\b/.test(t);}
  function arr(x){if(!x)return[];return Array.isArray(x)?x.filter(Boolean):[x];}
  function first(x){return arr(x)[0]||'';}

  const originalEvaluate=adapter.evaluate.bind(adapter);
  adapter.evaluate=function(step,response,context,profile){
    const result=originalEvaluate(step,response,context,profile)||{};
    const ex=context&&context.exercise;
    const raw=textOfResponse(response);
    const t=norm(raw);
    const d={...(result.diagnosis||{})};
    const explicitReason=hasReasoning(t)||raw.split(/\s+/).length>=12;

    // Do not infer reasoning merely because a conclusion matches the expert answer.
    if(raw&& !explicitReason && ['objective','control','cards','next','preserve'].includes(step&&step.id)){
      const conclusionOnly=raw.split(/\s+/).length<=10;
      if(conclusionOnly){
        d.ambiguous=d.ambiguous||'I can evaluate the choice you stated, but you have not given enough of your reason for choosing it.';
        d.nextQuestion=d.nextQuestion||'What in this hand made you choose that answer?';
        result.gradeable=false;
      }
    }

    if(ex&&ex.id==='guided-useful-void'){
      if(step.id==='objective'){
        if(/a♠|ace of spades/.test(t)){
          d.correct='You correctly identified A♠ as a major card to plan a safe exit for.';
          if(/j♥|jack of hearts/.test(t)) d.correct+=' J♥ can also become harder to lose later, although A♠ is the clearer immediate danger.';
          if(!explicitReason){
            d.ambiguous='You named the right danger, but I still do not know what position you want to create so A♠ can leave safely.';
            d.nextQuestion='What would you like to make true before you try to unload A♠?';
            result.gradeable=false;
          }
        }
        if(/clubs?.*(short|shortest)|shortest.*clubs?/.test(t)&&!/dump|discard|unload|a♠|ace of spades/.test(t)){
          d.incorrect='Choosing clubs only because they are shortest is not enough. A void is useful only if it creates a real disposal opportunity.';
          d.nextQuestion='Which card would the club void help you unload, and why is that card dangerous to keep?';
        }
      }
      if(step.id==='control'&&/no control|off lead|stay off/.test(t)&&!explicitReason){
        d.correct='Staying off lead is a reasonable choice for the first phase of this hand.';
        d.ambiguous='I still need your reason. I do not yet know what staying off lead helps you accomplish with A♠ or the clubs.';
        d.nextQuestion='What becomes easier to do if another player keeps the lead?';
        result.gradeable=false;
      }
      if(step.id==='cards'){
        if(/k♣|8♣|3♣/.test(t)) d.correct='You are looking at the actual club cards that must be managed if clubs are going to become a useful void.';
        if(/k♣|8♣|3♣/.test(t)&&!explicitReason){
          d.ambiguous='You named relevant clubs, but I do not yet know which one you want to lose first or which one you want to keep until last.';
          d.nextQuestion='What job should K♣, 8♣, and 3♣ each have in the plan?';
          result.gradeable=false;
        }
      }
      if(step.id==='preserve'&&/4♦|4♥/.test(t)){
        d.correct='4♦ and 4♥ are sensible cards to preserve because they can still help you avoid or surrender the lead later.';
        if(!explicitReason){d.ambiguous='The choice is sensible, but I still need to know what later job you are saving them for.';d.nextQuestion='After A♠ is gone, how could 4♦ or 4♥ help you get off lead?';result.gradeable=false;}
      }
    }

    if(ex&&ex.id==='guided-queen-protection'){
      if(step.id==='objective'&&/q♠|queen of spades|q♥|queen of hearts|10♥|ten of hearts/.test(t)){
        d.correct='You correctly identified Q♠ and the higher hearts as cards that can become costly or difficult to lose later.';
        if(!explicitReason){
          d.ambiguous='You have identified the danger, but you have not yet said what position you want to create so those cards can leave safely.';
          d.nextQuestion='What would make it easier to unload Q♠ safely: preserving spade protection, creating a void, staying off lead, or some combination? Explain why.';
          result.gradeable=false;
        }
      }
      if(step.id==='control'&&/no control|off lead|stay off/.test(t)&&!explicitReason){
        d.correct='Staying off lead is the stronger early choice for this hand.';
        d.ambiguous='I still need to know why you want someone else to keep the lead.';
        d.nextQuestion='Which cards become easier to shed while another player is leading their suits?';
        result.gradeable=false;
      }
      if(step.id==='cards'&&/2♠|9♠/.test(t)&&!explicitReason){
        d.correct='2♠ and 9♠ are relevant because they sit underneath Q♠.';
        d.ambiguous='I do not yet know which one you intend to preserve longer and why.';
        d.nextQuestion='What job does 2♠ have that makes it more valuable to keep while Q♠ is still in your hand?';
        result.gradeable=false;
      }
    }

    result.diagnosis=d;
    return result;
  };

  function activeStepId(){
    const active=document.querySelector('#tutorBody .tutor-progress>div.active');
    if(!active)return null;
    const s=active.textContent.toLowerCase();
    if(s.includes('objective')&&!s.includes('next'))return'objective';
    if(s.includes('control'))return'control';
    if(s.includes('cards'))return'cards';
    if(s.includes('next'))return'next';
    if(s.includes('preserve'))return'preserve';
    return null;
  }
  function pathwayAnswers(){
    const vals=[...document.querySelectorAll('#tutorBody .pathway-line strong')].map(x=>x.textContent.trim()).map(x=>x==='…'?'':x);
    return {objective:vals[0]||'',control:vals[1]||'',cards:vals[2]||'',next:vals[3]||'',preserve:vals[4]||''};
  }
  function quote(s,max=110){s=String(s||'').trim();return s.length>max?s.slice(0,max-1)+'…':s;}

  function questionFor(ex,step,answers){
    if(!ex||!step)return'';
    const objective=quote(answers.objective);
    if(ex.id==='guided-useful-void'){
      if(step==='objective')return'Looking at A♠, 10♠, J♥, K♣, and J♦, which card is the most important one to keep from trapping you later, and what do you want to make possible for that card?';
      if(step==='control')return objective?`You said your first goal is “${objective}”. For that goal, is it better to stay off lead or take the lead? What does that choice let you do with A♠ or the cards you need to shed?`:'Is it better to stay off lead or take the lead while you are trying to create a safe way to unload A♠? What does that choice let you do?';
      if(step==='cards')return'If your plan is to make clubs a disposal route for A♠, what has to happen to K♣, 8♣, and 3♣? Which club would you prefer to lose first, and which would you prefer to keep until last?';
      if(step==='next')return'Suppose you have successfully made yourself void in clubs. What do you want to happen on the next club lead, and which card would you try to unload first?';
      if(step==='preserve')return'While you work toward unloading A♠ through a club void, which low cards should you avoid spending too early? What job will 4♦ or 4♥ still need to do after A♠ is gone?';
    }
    if(ex.id==='guided-queen-protection'){
      if(step==='objective')return'Looking at Q♠, Q♥, 10♥, 9♥, Q♣, and 10♦, which cards are most likely to become a problem later, and what do you want to prevent from happening to them?';
      if(step==='control')return objective?`You said your first goal is “${objective}”. While you work on that goal, would you rather stay off lead or take the lead? Which specific cards become easier to shed or protect because of that choice?`:'Would you rather stay off lead or take the lead while Q♠ and the higher hearts are still in your hand? Which cards become easier to manage because of that choice?';
      if(step==='cards')return'To get Q♠ to a safe disposal point, what jobs do 2♠ and 9♠ have? At the same time, which of Q♣ and 10♦ should you try to lose before they become harder to get rid of?';
      if(step==='next')return'Once Q♣ or 10♦ has been shed and Q♠ is still protected, what should you try to create next so Q♠ or a dangerous heart can leave the hand safely?';
      if(step==='preserve')return'While you work toward unloading Q♠, which card must you keep because Q♠ still depends on it? Which other low card would you like to keep as a way to get off lead later?';
    }
    const hand=(ex.hand||[]).map(c=>adapter.cardLabel(c)).join(', ');
    if(step==='objective')return`Looking at this hand (${hand}), which card or group of cards is most likely to cause trouble later, and what do you want to prevent?`;
    if(step==='control')return objective?`You said your first goal is “${objective}”. For that specific goal, do you want the lead or do you want someone else to keep it? What does that choice let you do next?`:'For the problem you identified in this hand, would having the lead help you solve it or make it harder? Explain what you would do next.';
    if(step==='cards')return objective?`To accomplish “${objective}”, which specific cards in this hand have jobs in the plan? For each card you name, say whether you need to keep it, shed it, use it to take the lead, or use it to get off lead.`:'Which specific cards in this hand help you solve the problem you identified, and what job does each one have?';
    if(step==='next')return objective?`Suppose you successfully accomplish “${objective}”. What new opportunity does that create, and which card becomes your next priority?`:'After the first problem is solved, what becomes possible that was not possible before?';
    if(step==='preserve')return'Which card in this hand would be easy to spend now but important to keep because you will need it for the next part of your plan? What later job are you saving it for?';
    return'';
  }

  function rewriteQuestion(){
    const q=document.querySelector('#tutorBody .tutor-question');
    if(!q)return;
    const ex=window.__currentTutorExercise;
    const step=activeStepId();
    const wording=questionFor(ex,step,pathwayAnswers());
    if(wording&&q.textContent!==wording)q.textContent=wording;
  }

  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;rewriteQuestion();});
  });
  const root=document.getElementById('tutorRoot');
  if(root)observer.observe(root,{childList:true,subtree:true});
  rewriteQuestion();
  tutor.__situationalCoachingInstalled=true;
})();
