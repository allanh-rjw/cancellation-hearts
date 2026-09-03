(function(){
  const curated=[
    {
      id:'guided-queen-protection',level:['beginner','developing'],title:'Protection before disposal',
      hand:['5C','QC','6D','10D','KD','2S','9S','QS','6H','7H','9H','10H','QH'],
      expert:{
        read:'This is an avoidance hand built around mobility. Q♠ needs protection, Q♥/10♥/9♥ can promote into forced winners, Q♣ and 10♦ should be shed while higher cards still cover them, and K♦ is useful only when taking the lead creates a specific productive continuation.',
        strategy:'Avoidance',
        desiredState:'Reach the middle and late hand with Q♠ either safely disposed of or still protected, the medium-high hearts reduced before they promote, at least one low exit preserved, and any deliberate lead acquisition tied to a concrete follow-up.',
        suitPlan:[
          {suit:'Clubs',plan:'Q♣ is the liability; 5♣ is the useful low card. Prefer to shed Q♣ first. If 5♣ later becomes the last club, exhausting it can create a club void that is valuable because a future club lead can carry Q♠ or a high heart out of the hand.'},
          {suit:'Diamonds',plan:'10♦ is a future-winner risk and should be lost while higher diamonds still exist. 6♦ is a low mobility card. K♦ is conditional control: keep it until it can either lose safely or win for a named follow-up purpose.'},
          {suit:'Spades',plan:'2♠ and 9♠ are not generic low cards. They are the protection system underneath Q♠. Preserve 2♠ longest; shed 9♠ opportunistically if enough queen protection remains. Dispose of Q♠ only into a trick whose post-cancellation winner is safely someone else.'},
          {suit:'Hearts',plan:'The five-card heart block is long but not controlling. 6♥ and 7♥ are mobility; Q♥, 10♥, and 9♥ are promotion risks. If a void opens, dispose in roughly Q♥ → 10♥ → 9♥ order unless the live-card state changes.'}
        ],
        cardPlan:[
          {card:'5C',role:'Low loser / possible exit / possible final club',action:'Preserve longer than Q♣',why:'It gives a safe follow or lead-surrender option. If it later becomes the last club, spending it can intentionally finish the club suit.',changes:'After Q♣ is gone, its value rises as either an exit or the card that completes a useful club void.'},
          {card:'QC',role:'Early shedding target',action:'Lose it while A♣/K♣ or their twins can still beat it',why:'Q♣ is much more likely than 5♣ to promote into an effective winner later.',changes:'Once Q♣ is gone, clubs become easier to exhaust without sacrificing the useful low card first.'},
          {card:'6D',role:'Low loser / mobility',action:'Usually preserve',why:'It is unlikely to seize control early and can later help surrender the lead.',changes:'If diamonds become dangerous or nearly exhausted, reassess whether it remains a safe exit.'},
          {card:'10D',role:'Future-winner liability',action:'Shed while higher diamonds remain live',why:'Its relative rank rises sharply as A♦/K♦/Q♦/J♦ disappear.',changes:'The fewer higher diamonds remain, the more urgent it becomes to get rid of 10♦.'},
          {card:'KD',role:'Conditional entry / control card',action:'Do not cash merely because it can win',why:'Winning is valuable only if the next lead advances the hand pathway.',changes:'It becomes a desirable entry when one of the named follow-up plans below is available.'},
          {card:'2S',role:'Primary Q♠ protection; later possible exit',action:'Preserve while Q♠ remains exposed',why:'It buys another spade round without forcing Q♠ out.',changes:'After Q♠ is safely gone, 2♠ can be repurposed as an ordinary low exit.'},
          {card:'9S',role:'Secondary Q♠ protection + future-winner risk',action:'Shed opportunistically without stripping all queen protection',why:'It helps shield Q♠ now but can promote into a winner later.',changes:'Its shedding priority rises as higher spades disappear; its protection value falls after Q♠ is gone.'},
          {card:'QS',role:'13-point liability',action:'Dispose only when the post-cancellation winner is safely another player',why:'The goal is not merely to play Q♠ but to transfer the penalty without accidentally winning after duplicate cancellation.',changes:'Once gone, the remaining low spades can be repurposed as ordinary mobility/exit cards.'},
          {card:'6H',role:'Low heart / mobility',action:'Preserve longer than high hearts',why:'It lets you follow hearts without taking control.',changes:'Reassess only if heart ranks above it are exhausted enough to make it dangerous.'},
          {card:'7H',role:'Low heart / mobility',action:'Preserve longer than high hearts',why:'Like 6♥, it is a safer follower than the upper heart block.',changes:'Its value changes as the heart suit collapses.'},
          {card:'9H',role:'Medium promotion risk',action:'Prefer to dispose after Q♥ and 10♥ when a safe channel opens',why:'It may become an effective winner after higher hearts disappear.',changes:'Its urgency rises as A♥/K♥/Q♥/J♥/10♥ equivalents leave play.'},
          {card:'10H',role:'High promotion risk',action:'Dispose through a useful void when possible',why:'It is much more likely than 6♥/7♥ to become a forced winner late.',changes:'Its urgency rises quickly as the upper heart ranks disappear.'},
          {card:'QH',role:'Highest heart liability in this hand',action:'Usually first heart to dump through a useful void',why:'It is the most likely heart in this holding to become a costly forced winner.',changes:'If higher hearts remain abundant it can still lose safely, but that window closes over time.'}
        ],
        controlPlans:[
          {entry:'K♦',condition:'Q♣ has been shed and 5♣ is now the last club or clubs are close to exhaustion.',followUp:'Win with K♦ → lead 5♣.',induce:'Try to force another club round or finish your club holding while opponents still have clubs.',creates:'A club void that has a specific job: on a later club lead, dump Q♠ if safe; otherwise unload Q♥, then 10♥/9♥ as they become dangerous.',preserve:'Do not spend the disposal target before the void exists, and retain another low exit so you can get off lead after the club objective is complete.'},
          {entry:'K♦',condition:'Q♠ is still protected and enough higher spades remain live that a low spade lead is unlikely to hand you control.',followUp:'Win with K♦ → lead 2♠ or, if 2♠ must remain as the final protection card, lead 9♠.',induce:'Force another spade round while higher spades can still absorb the trick.',creates:'Reduce your spade length and move Q♠ closer to a safe disposal point without stripping all protection at once.',preserve:'Keep at least one protective spade underneath Q♠ until the queen can be discarded safely.'},
          {entry:'K♦',condition:'A♥/K♥/J♥ and/or their twins are still live and the upper heart block Q♥/10♥/9♥ is becoming the major future-winner problem.',followUp:'Win with K♦ → lead 6♥ or 7♥.',induce:'Encourage a heart round while higher hearts still exist to cover your Q♥/10♥/9♥ on later rounds.',creates:'Shorten the heart block before the medium-high hearts promote into effective winners.',preserve:'Lead a low heart, not Q♥/10♥, so the dangerous hearts remain available to be shed under higher hearts or through a void.'},
          {entry:'K♦',condition:'None of the club, spade, or heart follow-up conditions is currently favorable.',followUp:'Do not seek the K♦ win.',induce:'Remain off lead and let opponents continue opening suits while you shed liabilities.',creates:'Preserves flexibility instead of volunteering control without a destination.',preserve:'Keep K♦ as optional future control until a productive continuation actually exists.'}
        ],
        pathway:[
          'Early: stay off lead and use safe losing opportunities to shed Q♣, 10♦, and then 9♠ when doing so does not expose Q♠.',
          'Protect Q♠ with 2♠ and enough secondary spade cover while monitoring for a genuinely safe queen-disposal trick.',
          'Build a void only when you can name the card it will carry out of the hand; clubs become attractive after Q♣ is gone and 5♣ can be exhausted for a purpose.',
          'Treat K♦ as conditional entry. Before allowing it to win, choose one concrete continuation: K♦ → 5♣ to finish clubs; K♦ → low spade to advance Q♠ disposal; or K♦ → 6♥/7♥ to shorten the dangerous heart block while high hearts still cover you.',
          'After that follow-up achieves its objective, surrender control with the safest remaining low card, while preserving 2♠ if Q♠ still depends on it.',
          'Recompute card roles after every cancellation: a protected card can become exposed, a medium card can promote into the effective high card, and a planned exit can stop being safe.'
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
      expert:{read:'Clubs are short but not automatically the best void. A useful void is valuable only if it lets you dispose of a real liability, such as A♠ or a heart that is becoming an effective winner.',strategy:'Avoidance',desiredState:'Preserve low mobility while creating only a void that has a named disposal target.',pathway:['Identify the liabilities first.','Compare which short suit is most likely to be led later.','Create the void only if it opens a reliable disposal channel.','Preserve at least one low exit in a suit that is still safe.'],cardPlan:[],controlPlans:[],suitPlan:[]},
      prompts:{
        objective:{question:'What would make a void useful in this hand?',fallback:['It is the shortest suit','It gives me a reliable place to unload a dangerous card','Any void is always good','It lets me win more tricks']},
        control:{question:'Do you need the lead in order to create or exploit that void?',fallback:['Always','Usually no, unless control creates the needed follow-up','Always yes after Trick 1']},
        cards:{question:'Which cards are liabilities that a useful void might help you unload?',fallback:['A♠ and J♥','3♣ and 4♦','2♠ only','Every low card']},
        next:{question:'After the void exists, what should you try to accomplish?',fallback:['Use it to dump the most dangerous future winner','Immediately regain the lead','Lead the voided suit yourself','Nothing changes']},
        preserve:{question:'What kind of card should you preserve while building this plan?',fallback:['A low exit in a still-safe suit','Only the highest card','No low cards','Every club']}
      }
    }
  ];
  const concepts={objective:['objective','accomplish','problem','shed','protect','void','winner','queen'],control:['control','lead','off lead','no control','lose','win'],cards:['2','9','q','k','10','heart','spade','diamond','club'],next:['next','then','once','after','dispose','dump','shed','void'],preserve:['preserve','keep','save','protect','later','depends']};
  function cardLabel(code){const r=code.slice(0,-1),s=code.slice(-1);return r+({C:'♣',D:'♦',S:'♠',H:'♥'}[s]||s);}
  function tokenScore(text,keys){const t=(text||'').toLowerCase();return keys.reduce((n,k)=>n+(t.includes(k)?1:0),0);}
  const Adapter={
    domain:'cancellation-hearts',
    selectExercise(profile){const level=profile.selfLevel||'developing';const lower=level==='beginner'||level==='developing';if(lower){const n=(profile.totalInteractions||0)%curated.length;return {...curated[n],source:'curated'};}if(typeof window.makeDeck==='function'){const deck=window.shuffle?window.shuffle(window.makeDeck()):window.makeDeck();const hand=deck.slice(0,13).map(c=>`${c.rank}${c.suit}`);return {id:'random-'+Date.now(),level:[level],title:'Random transfer hand',hand,source:'random',expert:null,prompts:curated[0].prompts};}return {...curated[0],source:'curated'};},
    expertModel(ex){if(ex.expert)return ex.expert;return {read:'Treat the hand as a changing control system: identify liabilities, protection, entries, exits, useful voids, and cards likely to become effective winners.',strategy:'Adaptive avoidance unless the actual hand supports a stronger objective',desiredState:'Create the next useful state while preserving the cards required by the state after that.',pathway:['Identify the biggest future liability.','Decide whether solving it requires control or staying off lead.','Name the cards that can create that state.','Define the exact follow-up lead if control is required.','Define the next state you want after success.','Preserve cards the next state depends on.','Set a trigger that would make you revise the plan.'],cardPlan:[],controlPlans:[],suitPlan:[]};},
    evaluate(step,response,context){
      const text=(response&&response.text||'').trim();const fallback=response&&response.choice||'';const combined=(text+' '+fallback).toLowerCase();const flags=[];let score=0.45;if(text.length>25)score+=0.08;const hits=tokenScore(combined,concepts[step.id]||[]);score+=Math.min(0.25,hits*0.05);
      if(step.id==='objective'){if(/protect.*q|q.*protect|future winner|shed.*winner|liabilit/.test(combined))score+=0.25;if(/shortest.*void|void.*shortest/.test(combined)){score-=0.25;flags.push('shortest_suit_equals_best_void');}}
      if(step.id==='control'){if(/no control|off lead|stay off|do not need.*lead|only.*if/.test(combined))score+=0.2;if(/always.*control|take.*lead immediately/.test(combined)){score-=0.2;flags.push('control_without_purpose');}if(/k.?d|k.?♦/.test(combined)&&!/lead|follow|then|club|spade|heart/.test(combined)){score-=0.08;flags.push('entry_without_followup');}}
      if(step.id==='cards'){if(/2.?♠|2s|9.?♠|9s|q.?♥|qh|10.?♥|10h|k.?♦|kd|q.?♣|qc/.test(combined))score+=0.2;}
      if(step.id==='next'){if(/dispose|dump|shed|next objective|after|once/.test(combined))score+=0.2;}
      if(step.id==='preserve'){if(/2.?♠|2s|preserve|keep|protect/.test(combined))score+=0.22;if(/nothing|no card/.test(combined)){score-=0.18;flags.push('fails_to_preserve_future_option');}}
      score=Math.max(0,Math.min(1,score));const skills={objective:['objective_reasoning','causal_planning_state_transition'],control:['control_reasoning','causal_planning_control_requirements'],cards:['entry_selection','queen_structure','effective_winner_reasoning'],next:['useful_void_reasoning','causal_planning_state_transition'],preserve:['exit_preservation','causal_planning_preservation']}[step.id]||['hand_reading'];
      let feedback;if(score>=0.8)feedback='Strong. Your reasoning connects the current hand to a future state rather than merely naming a card convention.';else if(score>=0.58)feedback='Partly there. You identified a relevant idea, but make the causal link explicit: what state are you trying to create, and what does that state let you do next?';else feedback='The reasoning is still too local. Do not choose a card or void just because it looks safe. Start with the future position you want, then work backward to the cards that create it.';
      if(flags.includes('shortest_suit_equals_best_void'))feedback+=' A short suit is not automatically the best void. Name the liability that the void will let you unload.';if(flags.includes('control_without_purpose'))feedback+=' Taking the lead is useful only if you can name the productive follow-up it enables.';if(flags.includes('entry_without_followup'))feedback+=' Naming K♦ as an entry is incomplete. Finish the sentence: K♦ wins → I lead ___ → I expect ___ → that creates ___.';
      return {score,skills,flags,feedback};
    },
    cardLabel
  };
  window.CancellationHeartsTutorAdapter=Adapter;
})();
