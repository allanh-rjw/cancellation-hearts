(function(){
  const adapter=window.CancellationHeartsTutorAdapter;
  if(!adapter||adapter.__structuredDiagnosisWrapped) return;
  const original=adapter.evaluate.bind(adapter);

  function normalize(text){
    return String(text||'').toLowerCase()
      .replace(/10h/g,'10♥').replace(/qh/g,'q♥').replace(/jh/g,'j♥')
      .replace(/qs/g,'q♠').replace(/as/g,'a♠').replace(/10s/g,'10♠').replace(/6s/g,'6♠').replace(/2s/g,'2♠').replace(/9s/g,'9♠')
      .replace(/kd/g,'k♦').replace(/jd/g,'j♦').replace(/10d/g,'10♦').replace(/7d/g,'7♦').replace(/4d/g,'4♦')
      .replace(/kc/g,'k♣').replace(/qc/g,'q♣').replace(/8c/g,'8♣').replace(/3c/g,'3♣')
      .replace(/8h/g,'8♥').replace(/4h/g,'4♥');
  }
  function has(t,re){return re.test(t);}

  function queenProtectionDiagnosis(id,t){
    if(id==='objective'){
      if(has(t,/(q♠|queen of spades|q♥|queen of hearts|10♥|ten of hearts|future winner|forced winner)/)){
        return {
          recognized:'You picked out the main cards that can hurt you later, especially Q♠ and the higher hearts such as Q♥ and 10♥.',
          missing:'The next thing to decide is how you want those cards to leave your hand safely.',
          nextQuestion:'Would you rather stay off lead and lose them under higher cards, create a void so you can discard them, or keep Q♠ protected until a safe chance to dump it appears?'
        };
      }
      if(has(t,/(shortest.*void|void.*shortest|clubs.*shortest)/)){
        return {
          recognized:'You noticed that clubs are short, which can matter.',
          correction:'Being short in a suit is not enough by itself to make that suit the best void.',
          missing:'A useful void needs a specific job.',
          nextQuestion:'If you became void in clubs, which dangerous card would you hope to throw away on a later club lead?'
        };
      }
      return {
        recognized:'You are looking for the cards that could become hard to get rid of later.',
        missing:'Name the specific cards in this hand that worry you most.',
        nextQuestion:'Which of Q♠, Q♥, 10♥, Q♣, or 10♦ would be most dangerous to still hold late in the hand, and why?'
      };
    }
    if(id==='control'){
      if(has(t,/(no control|off lead|stay off|don't want.*lead|do not want.*lead)/)){
        return {
          recognized:'Right. Early in this hand, staying off lead gives you more chances to lose Q♣, 10♦, or other risky cards under higher cards.',
          missing:'Now identify the exception: when would taking the lead actually help you?',
          nextQuestion:'What would you want to lead immediately after winning with K♦, and what would that lead accomplish?'
        };
      }
      return {
        recognized:'You are thinking about whether winning the lead helps the plan.',
        missing:'For this hand, taking the lead only makes sense when you already know the follow-up.',
        nextQuestion:'If K♦ wins, what exact card would you lead next, and what change in your hand are you trying to create?'
      };
    }
    if(id==='cards'){
      if(has(t,/(2♠|q♠|9♠)/)){
        return {
          recognized:'Good. You are treating the spades as a group: 2♠ and 9♠ help keep Q♠ from being exposed too early.',
          missing:'Now separate the cards you want to preserve from the cards you want to shed while they are still safe to lose.',
          nextQuestion:'Which would you rather get rid of early, Q♣ or 5♣, and 10♦ or 6♦? Why?'
        };
      }
      return {
        recognized:'You named cards that matter to the plan.',
        missing:'Now give each one a job: protect, shed, take the lead later, or help you get off lead.',
        nextQuestion:'Which card protects Q♠, and which cards become more dangerous the longer you hold them?'
      };
    }
    if(id==='next'){
      if(has(t,/(void|dump|discard|dispose|q♠|q♥|10♥)/)){
        return {
          recognized:'Right. The point of creating a void is to give yourself a place to throw away a dangerous card such as Q♠, Q♥, or 10♥.',
          missing:'Now make the sequence concrete rather than stopping at “create a void.”',
          nextQuestion:'If Q♣ is already gone and 5♣ is your last club, how could K♦ and 5♣ work together to create that disposal opportunity?'
        };
      }
      return {
        recognized:'You are thinking about what should happen after the first part of the plan succeeds.',
        missing:'The next step should solve one of the remaining dangers in this hand.',
        nextQuestion:'After you shed one early liability, what position would make it easier to get rid of Q♠ or the high hearts?'
      };
    }
    if(id==='preserve'){
      if(has(t,/(2♠|protect.*q♠|q♠.*protect)/)){
        return {
          recognized:'Right. 2♠ has a future job because it lets you survive another spade lead without exposing Q♠.',
          missing:'Now think about one low card that could still help you get off lead later.',
          nextQuestion:'Besides 2♠, which low card would you prefer to keep as a later exit?'
        };
      }
      return {
        recognized:'You are looking for cards whose value comes from what they can do later.',
        missing:'Focus on cards that protect Q♠ or help you surrender the lead after an objective is complete.',
        nextQuestion:'Which low card would you regret spending now if you still needed protection or an exit several tricks from now?'
      };
    }
    return null;
  }

  function usefulVoidDiagnosis(id,t){
    if(id==='objective'){
      if(has(t,/(a♠|ace of spades|j♥|jack of hearts|forced winner|future winner|dangerous card)/)){
        return {
          recognized:'You identified the right kind of problem: A♠ and J♥ can become awkward cards to hold, and a void is useful only if it gives you a safe way to unload cards like those.',
          missing:'Now choose which suit you would actually want to become void in and explain why that suit gives you the best chance to use the void.',
          nextQuestion:'Would clubs be a useful void here? If so, which club would you want to get rid of first, and which dangerous card would you hope to discard on a later club lead?'
        };
      }
      if(has(t,/(shortest.*void|void.*shortest|clubs.*shortest)/)){
        return {
          recognized:'You noticed that clubs are relatively short.',
          correction:'That is only useful if a club void helps you get rid of a card that could otherwise hurt you later.',
          missing:'Name the card the club void would be for.',
          nextQuestion:'If you became void in clubs, would A♠, J♥, or another card be your first disposal target?'
        };
      }
      return {
        recognized:'You are looking for a way to make a void useful rather than simply making the shortest suit disappear.',
        missing:'Start by naming the dangerous card you want the void to help you unload.',
        nextQuestion:'Which worries you more in this hand, A♠, J♥, 10♠, K♣, or J♦, and why?'
      };
    }
    if(id==='control'){
      if(has(t,/(no control|off lead|stay off|don't need.*lead|do not need.*lead|usually no)/)){
        return {
          recognized:'Right. You usually do not need to take the lead just to create or use a void.',
          missing:'The important question is whether taking the lead gives you a specific way to advance the void plan.',
          nextQuestion:'With this hand, what exact card would you want to lead if you did take control, and how would that help you get closer to the void you want?'
        };
      }
      return {
        recognized:'You are considering whether having the lead helps create the void.',
        missing:'Do not take the lead merely because you can. Tie it to a specific follow-up from this hand.',
        nextQuestion:'Which actual card in this hand would you lead next, and what would you want that lead to accomplish?'
      };
    }
    if(id==='cards'){
      if(has(t,/(a♠|j♥|10♠|k♣|j♦)/)){
        return {
          recognized:'Good. You are identifying the cards that the void might eventually help you unload, especially A♠ and J♥.',
          missing:'Now separate disposal targets from the cards that can help create the void.',
          nextQuestion:'Which clubs would you want to shed to become void, and which low cards such as 4♦ or 4♥ would you prefer to keep as exits?'
        };
      }
      return {
        recognized:'You named cards that matter to the hand.',
        missing:'Now sort them by job: cards to unload through the void, cards that help create the void, and low cards worth preserving.',
        nextQuestion:'Which cards are your disposal targets, which clubs help create the void, and which low cards would you keep for later?'
      };
    }
    if(id==='next'){
      if(has(t,/(dump|discard|dispose|a♠|j♥|void)/)){
        return {
          recognized:'Right. Once the void exists, its job is to let you throw away the most dangerous card you are still holding.',
          missing:'Now choose the first disposal target instead of leaving it open-ended.',
          nextQuestion:'If both A♠ and J♥ are still in your hand when the club void is ready, which would you try to unload first, and why?'
        };
      }
      return {
        recognized:'You are thinking about what the void should let you do next.',
        missing:'Tie the next objective to one of the dangerous cards actually in this hand.',
        nextQuestion:'Once you are void in clubs, which card would you most want to discard on the next club lead?'
      };
    }
    if(id==='preserve'){
      if(has(t,/(4♦|4♥|3♣|2♠|low|exit|preserve|keep)/)){
        return {
          recognized:'Right. Low cards such as 4♦ or 4♥ can still be valuable because they may help you avoid taking control later.',
          missing:'Now choose which low card you most want to keep while you build the void.',
          nextQuestion:'Between 4♦, 4♥, and 2♠, which looks like the safest later exit, and what would make you change that choice?'
        };
      }
      return {
        recognized:'You are looking for cards that still have a job after the void is created.',
        missing:'Keep at least one low card that can help you get off lead later.',
        nextQuestion:'Which low card in this hand would you most want to save for surrendering the lead later?'
      };
    }
    return null;
  }

  function genericDiagnosis(id,t,exercise){
    const cards=(exercise&&exercise.hand)||[];
    const labels=cards.map(c=>adapter.cardLabel(c));
    const sample=labels.slice(0,5).join(', ');
    if(id==='objective') return {recognized:'You are trying to identify what could become difficult later.',missing:'Keep the answer tied to the cards actually in this hand.',nextQuestion:`Which cards in this hand worry you most${sample?` among ${sample}${labels.length>5?', …':''}`:''}, and why?`};
    if(id==='control') return {recognized:'You are thinking about whether you want the lead.',missing:'Tie that choice to what you would actually do next with this hand.',nextQuestion:'If you won the lead, what exact card would you lead next, and what would that accomplish?'};
    if(id==='cards') return {recognized:'You are identifying cards that matter to the plan.',missing:'Give each named card a specific job in this hand.',nextQuestion:'Which cards are for shedding, which are for preserving, and which can change who has the lead?'};
    if(id==='next') return {recognized:'You are thinking beyond the first objective.',missing:'Name the exact next problem you want to solve with the cards still in front of you.',nextQuestion:'After your first objective succeeds, which remaining card becomes the next priority?'};
    if(id==='preserve') return {recognized:'You are thinking about cards that need to survive for later.',missing:'Choose the specific card whose future job matters most.',nextQuestion:'Which card in this hand would you regret spending now because you still need it later?'};
    return null;
  }

  function diagnose(step,response,context,result){
    const raw=(response&&response.text)||(response&&response.choice)||'';
    const t=normalize(raw);
    const exercise=context&&context.exercise;
    const id=step&&step.id;
    if(exercise&&exercise.id==='guided-queen-protection') return queenProtectionDiagnosis(id,t);
    if(exercise&&exercise.id==='guided-useful-void') return usefulVoidDiagnosis(id,t);
    return genericDiagnosis(id,t,exercise);
  }

  adapter.evaluate=function(step,response,context,profile){
    const result=original(step,response,context,profile)||{};
    const diagnosis=diagnose(step,response,context,result);
    if(diagnosis) result.diagnosis=diagnosis;
    delete result.feedback;
    return result;
  };
  adapter.__structuredDiagnosisWrapped=true;
})();
