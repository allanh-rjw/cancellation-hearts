(function(){
  const adapter=window.CancellationHeartsTutorAdapter;
  if(!adapter||adapter.__structuredDiagnosisWrapped) return;
  const original=adapter.evaluate.bind(adapter);

  function normalize(text){return String(text||'').toLowerCase().replace(/10h/g,'10♥').replace(/qh/g,'q♥').replace(/qs/g,'q♠').replace(/2s/g,'2♠').replace(/9s/g,'9♠').replace(/kd/g,'k♦').replace(/qc/g,'q♣').replace(/10d/g,'10♦');}
  function has(t,re){return re.test(t);}

  function diagnose(step,response,context,result){
    const raw=(response&&response.text)|| (response&&response.choice)||'';
    const t=normalize(raw);
    const exercise=context&&context.exercise;
    const id=step&&step.id;

    if(id==='objective'){
      const namesMainLiabilities=has(t,/(q♠|queen of spades|q♥|queen of hearts|10♥|ten of hearts|future winner|forced winner)/);
      const shortestVoid=has(t,/(shortest.*void|void.*shortest|clubs.*shortest)/);
      if(namesMainLiabilities){
        return {
          recognized:'You picked out the main cards that can hurt you later, especially Q♠ and the higher hearts such as Q♥ and 10♥.',
          missing:'The next thing to decide is how you want those cards to leave your hand safely.',
          nextQuestion:'Would you rather stay off lead and lose them under higher cards, create a void so you can discard them, or keep Q♠ protected until a safe chance to dump it appears?'
        };
      }
      if(shortestVoid){
        return {
          recognized:'You noticed that clubs are short, which can matter.',
          correction:'Being short in a suit is not enough by itself to make that suit the best void.',
          missing:'A useful void needs a specific job.',
          nextQuestion:'If you became void in clubs, which dangerous card would you hope to throw away on the next club lead?'
        };
      }
      return {
        recognized:'You are trying to identify what could cause trouble later in the hand.',
        missing:'Name the specific card or group of cards you most want to keep from trapping you later.',
        nextQuestion:'Which cards in this hand are most likely to force you to take an unwanted trick if you keep them too long?'
      };
    }

    if(id==='control'){
      if(has(t,/(no control|off lead|stay off|don't want.*lead|do not want.*lead)/)){
        return {
          recognized:'Right. For the first part of this plan, staying off lead gives you more chances to lose Q♣, 10♦, or other risky cards under higher cards.',
          missing:'Now identify the exception: when would taking the lead actually help you?',
          nextQuestion:'What would you want to lead immediately after winning with K♦, and what would that lead accomplish?'
        };
      }
      if(has(t,/(control|take.*lead|win.*lead)/)){
        return {
          recognized:'You see that taking the lead can sometimes be useful.',
          missing:'For this hand, winning the lead is only useful if you already know what you will do next.',
          nextQuestion:'If K♦ wins, what exact card would you lead next, and what change in your hand are you trying to create?'
        };
      }
      return {
        recognized:'You are thinking about whether the lead helps or hurts the plan.',
        missing:'Choose which is better for the first objective: having the lead or letting someone else keep it.',
        nextQuestion:'Would Q♣ and 10♦ be easier to get rid of while you are leading, or while someone else is leading their suits?'
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
        missing:'Give each one a job: something to keep, something to shed, something that can take the lead, or something that protects another card.',
        nextQuestion:'Which card protects Q♠, and which cards are becoming more dangerous the longer you hold them?'
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
        missing:'The next step should solve one of the remaining dangers in your hand.',
        nextQuestion:'After you shed one early liability, what position would make it easier to get rid of Q♠ or the high hearts?'
      };
    }

    if(id==='preserve'){
      if(has(t,/(2♠|protect.*q♠|q♠.*protect)/)){
        return {
          recognized:'Right. 2♠ has a future job because it lets you survive another spade lead without exposing Q♠.',
          missing:'Now think about the other kind of card worth keeping: a low card that can help you get off lead later.',
          nextQuestion:'Besides 2♠, which low card could still be useful later for surrendering the lead after you finish an objective?'
        };
      }
      return {
        recognized:'You are looking for cards whose value comes from what they can do later, not just what they do on the next trick.',
        missing:'Focus on cards that protect a liability or let you get off lead later.',
        nextQuestion:'Which low card would you regret spending now if you still had Q♠ or needed an exit several tricks from now?'
      };
    }

    return null;
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
