(function(){
  const curated=[
    {
      id:'guided-queen-protection',level:['beginner','developing'],title:'Protection before disposal',
      hand:['5C','QC','6D','10D','KD','2S','9S','QS','6H','7H','9H','10H','QH'],
      expert:{
        read:'The hand has three linked problems: Q♠ needs protection, K♦ can become forced control, and the medium-high heart block can become future winners.',
        strategy:'Avoidance',
        pathway:[
          'Stay off lead early and shed cards that may become future winners while higher cards still exist.',
          'Do not spend 2♠ casually because it protects Q♠ and may also become a later exit.',
          'Create a useful void only if it gives you a disposal channel for Q♠ or high hearts.',
          'Use K♦ to take control only when winning it enables a specific productive follow-up lead.',
          'After the objective is achieved, surrender control with the safest remaining low card.'
        ]
      },
      prompts:{
        objective:{question:'What is the most important structural problem you want to solve first, and why?',fallback:['Create a void because clubs are shortest','Protect Q♠ while shedding future winners','Take the lead immediately with K♦','Start leading hearts']},
        control:{question:'For that first objective, do you want control, no control, or does either work? Explain.',fallback:['Control','No control','Either']},
        cards:{question:'Which specific cards matter most to creating that state?',fallback:['2♠ and 9♠','K♦','Q♥, 10♥, 9♥','Q♣ and 10♦']},
        next:{question:'Once the first objective succeeds, what should the next objective become?',fallback:['Use a useful void to dispose of Q♠ or high hearts','Take every remaining trick','Break hearts immediately','Spend all low cards']},
        preserve:{question:'Which card or cards must be preserved because the next phase depends on them?',fallback:['2♠ while Q♠ remains exposed','K♦ no matter what','All hearts','No cards need preserving']}
      }
    },
    {
      id:'guided-useful-void',level:['beginner','developing'],title:'A void needs a job',
      hand:['3C','8C','KC','4D','7D','JD','2S','6S','10S','AS','4H','8H','JH'],
      expert:{read:'Clubs are short but not automatically the best void. A useful void is valuable only if it lets you dispose of a real liability, such as A♠ or a heart that is becoming an effective winner.',strategy:'Avoidance',pathway:['Identify the liabilities first.','Compare which short suit is most likely to be led later.','Create the void only if it opens a reliable disposal channel.','Preserve at least one low exit in a suit that is still safe.']},
      prompts:{
        objective:{question:'What would make a void useful in this hand?',fallback:['It is the shortest suit','It gives me a reliable place to unload a dangerous card','Any void is always good','It lets me win more tricks']},
        control:{question:'Do you need the lead in order to create or exploit that void?',fallback:['Always','Usually no, unless control creates the needed follow-up','Always yes after Trick 1']},
        cards:{question:'Which cards are liabilities that a useful void might help you unload?',fallback:['A♠ and J♥','3♣ and 4♦','2♠ only','Every low card']},
        next:{question:'After the void exists, what should you try to accomplish?',fallback:['Use it to dump the most dangerous future winner','Immediately regain the lead','Lead the voided suit yourself','Nothing changes']},
        preserve:{question:'What kind of card should you preserve while building this plan?',fallback:['A low exit in a still-safe suit','Only the highest card','No low cards','Every club']}
      }
    }
  ];
  const concepts={
    objective:['objective','accomplish','problem','shed','protect','void','winner','queen'],
    control:['control','lead','off lead','no control','lose','win'],
    cards:['2','9','q','k','10','heart','spade','diamond','club'],
    next:['next','then','once','after','dispose','dump','shed','void'],
    preserve:['preserve','keep','save','protect','later','depends']
  };
  function cardLabel(code){const r=code.slice(0,-1),s=code.slice(-1);return r+({C:'♣',D:'♦',S:'♠',H:'♥'}[s]||s);}
  function tokenScore(text,keys){const t=(text||'').toLowerCase();return keys.reduce((n,k)=>n+(t.includes(k)?1:0),0);}
  const Adapter={
    domain:'cancellation-hearts',
    selectExercise(profile){
      const level=profile.selfLevel||'developing';
      const lower=level==='beginner'||level==='developing';
      if(lower){
        const n=(profile.totalInteractions||0)%curated.length;return {...curated[n],source:'curated'};
      }
      if(typeof window.makeDeck==='function'){
        const deck=window.shuffle?window.shuffle(window.makeDeck()):window.makeDeck();
        const hand=deck.slice(0,13).map(c=>`${c.rank}${c.suit}`);
        return {id:'random-'+Date.now(),level:[level],title:'Random transfer hand',hand,source:'random',expert:null,prompts:curated[0].prompts};
      }
      return {...curated[0],source:'curated'};
    },
    expertModel(ex){
      if(ex.expert) return ex.expert;
      return {read:'Treat the hand as a changing control system: identify liabilities, protection, entries, exits, useful voids, and cards likely to become effective winners.',strategy:'Adaptive avoidance unless the actual hand supports a stronger objective',pathway:['Identify the biggest future liability.','Decide whether solving it requires control or staying off lead.','Name the cards that can create that state.','Define the next state you want after success.','Preserve cards the next state depends on.','Set a trigger that would make you revise the plan.']};
    },
    evaluate(step,response,context){
      const text=(response&&response.text||'').trim();
      const fallback=response&&response.choice||'';
      const combined=(text+' '+fallback).toLowerCase();
      const flags=[]; let score=0.45;
      if(text.length>25) score+=0.08;
      const hits=tokenScore(combined,concepts[step.id]||[]); score+=Math.min(0.25,hits*0.05);
      if(step.id==='objective'){
        if(/protect.*q|q.*protect|future winner|shed.*winner|liabilit/.test(combined)) score+=0.25;
        if(/shortest.*void|void.*shortest/.test(combined)){score-=0.25;flags.push('shortest_suit_equals_best_void');}
      }
      if(step.id==='control'){
        if(/no control|off lead|stay off|do not need.*lead|only.*if/.test(combined)) score+=0.2;
        if(/always.*control|take.*lead immediately/.test(combined)){score-=0.2;flags.push('control_without_purpose');}
      }
      if(step.id==='cards'){
        if(/2.?♠|2s|9.?♠|9s|q.?♥|qh|10.?♥|10h|k.?♦|kd|q.?♣|qc/.test(combined)) score+=0.2;
      }
      if(step.id==='next'){
        if(/dispose|dump|shed|next objective|after|once/.test(combined)) score+=0.2;
      }
      if(step.id==='preserve'){
        if(/2.?♠|2s|preserve|keep|protect/.test(combined)) score+=0.22;
        if(/nothing|no card/.test(combined)){score-=0.18;flags.push('fails_to_preserve_future_option');}
      }
      score=Math.max(0,Math.min(1,score));
      const skills={objective:['objective_reasoning','causal_planning_state_transition'],control:['control_reasoning','causal_planning_control_requirements'],cards:['entry_selection','queen_structure','effective_winner_reasoning'],next:['useful_void_reasoning','causal_planning_state_transition'],preserve:['exit_preservation','causal_planning_preservation']}[step.id]||['hand_reading'];
      let feedback;
      if(score>=0.8) feedback='Strong. Your reasoning connects the current hand to a future state rather than merely naming a card convention.';
      else if(score>=0.58) feedback='Partly there. You identified a relevant idea, but make the causal link explicit: what state are you trying to create, and what does that state let you do next?';
      else feedback='The reasoning is still too local. Do not choose a card or void just because it looks safe. Start with the future position you want, then work backward to the cards that create it.';
      if(flags.includes('shortest_suit_equals_best_void')) feedback+=' A short suit is not automatically the best void. Name the liability that the void will let you unload.';
      if(flags.includes('control_without_purpose')) feedback+=' Taking the lead is useful only if you can name the productive follow-up it enables.';
      return {score,skills,flags,feedback};
    },
    cardLabel
  };
  window.CancellationHeartsTutorAdapter=Adapter;
})();
