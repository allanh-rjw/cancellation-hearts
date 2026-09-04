(function(){
  const adapter=window.CancellationHeartsTutorAdapter;
  if(!adapter||adapter.__structuredDiagnosisWrapped) return;
  const original=adapter.evaluate.bind(adapter);

  function normalize(text){
    return String(text||'').toLowerCase()
      .replace(/10h/g,'10♥').replace(/qh/g,'q♥').replace(/jh/g,'j♥')
      .replace(/qs/g,'q♠').replace(/as/g,'a♠').replace(/10s/g,'10♠').replace(/6s/g,'6♠').replace(/2s/g,'2♠').replace(/9s/g,'9♠')
      .replace(/kd/g,'k♦').replace(/jd/g,'j♦').replace(/10d/g,'10♦').replace(/7d/g,'7♦').replace(/6d/g,'6♦').replace(/4d/g,'4♦')
      .replace(/kc/g,'k♣').replace(/qc/g,'q♣').replace(/8c/g,'8♣').replace(/5c/g,'5♣').replace(/3c/g,'3♣')
      .replace(/10c/g,'10♣').replace(/8h/g,'8♥').replace(/7h/g,'7♥').replace(/6h/g,'6♥').replace(/5h/g,'5♥').replace(/4h/g,'4♥');
  }
  function has(t,re){return re.test(t);}
  function done(recognized){return {recognized};}

  function queenProtectionDiagnosis(id,t){
    if(id==='objective'){
      const identifiesDanger=has(t,/(q♠|queen of spades|q♥|queen of hearts|10♥|ten of hearts|high hearts?|future winners?|forced winners?|liabilit|danger)/);
      const statesObjective=has(t,/(avoid|prevent|keep.*from|not.*becom|don'?t.*want|dispose|dump|discard|shed|lose.*saf|protect|void|off lead|under higher)/);
      if(identifiesDanger&&statesObjective){
        return done('You answered both parts: you identified Q♠ and the higher hearts as the main future liabilities, and you stated the objective of keeping them from becoming forced winners or otherwise getting trapped in your hand.');
      }
      if(identifiesDanger){
        return {recognized:'You picked out the main cards that can hurt you later, especially Q♠ and the higher hearts such as Q♥ and 10♥.',missing:'You identified the danger, but not yet what you want to prevent from happening to those cards.',nextQuestion:'What do you want to prevent from happening to Q♠, Q♥, and 10♥ as the hand develops?'};
      }
      if(has(t,/(shortest.*void|void.*shortest|clubs.*shortest)/)){
        return {recognized:'You noticed that clubs are short, which can matter.',correction:'Being short in a suit is not enough by itself to make that suit the best void.',missing:'Start with the actual cards that are most likely to become costly later.',nextQuestion:'Which cards in this hand are most at risk of becoming forced winners or carrying a large penalty?'};
      }
      return {recognized:'You are looking for the cards that could become hard to get rid of later.',missing:'Name the specific cards in this hand that worry you most.',nextQuestion:'Which of Q♠, Q♥, 10♥, Q♣, or 10♦ would be most dangerous to still hold late in the hand, and why?'};
    }

    if(id==='control'){
      const choosesOffLead=has(t,/(no control|off lead|stay off|don'?t want.*lead|do not want.*lead|someone else.*lead)/);
      const explainsBenefit=has(t,/(shed|lose|discard|dump|under higher|q♣|10♦|q♥|10♥|q♠|protect|safe|opponent.*lead|another player.*lead)/);
      if(choosesOffLead&&explainsBenefit)return done('You answered both parts: you want to stay off lead, and you tied that choice to making cards such as Q♣, 10♦, Q♠, or the higher hearts easier to shed or protect while other players lead.');
      if(choosesOffLead)return {recognized:'Staying off lead is the stronger early choice for this hand.',missing:'The missing part is why that helps this particular holding.',nextQuestion:'Which specific cards become easier to shed or protect while another player keeps the lead?'};
      const takesControl=has(t,/(take.*lead|want.*lead|control|win.*k♦|k♦.*win)/);
      const namesFollowUp=has(t,/(lead.*(5♣|2♠|9♠|6♥|7♥)|5♣|2♠|9♠|6♥|7♥|void|spade round|heart round|finish.*club)/);
      if(takesControl&&namesFollowUp)return done('You did not treat control as an end in itself: you named taking the lead and also supplied a concrete follow-up that advances the hand plan.');
      if(takesControl)return {recognized:'You are considering taking the lead.',missing:'For this hand, control is useful only if you already know the immediate follow-up.',nextQuestion:'If K♦ wins, what exact card would you lead next, and what would that accomplish?'};
      return {recognized:'You are thinking about whether winning the lead helps the plan.',missing:'Choose whether you want control or not, then tie that choice to a concrete effect on this hand.',nextQuestion:'Would you rather stay off lead or take the lead, and which cards become easier to manage because of that choice?'};
    }

    if(id==='cards'){
      const namesProtection=has(t,/(2♠|9♠|protect.*q♠|q♠.*protect|underneath.*q♠|shield.*q♠)/);
      const namesShed=has(t,/(q♣|10♦).*(shed|lose|discard|dump|get rid)|(shed|lose|discard|dump|get rid).*(q♣|10♦)|q♣.*10♦|10♦.*q♣/);
      if(namesProtection&&namesShed)return done('You covered both jobs the prompt asked for: the low spades protect Q♠, while Q♣ and 10♦ are cards you would prefer to shed before they become harder to lose.');
      if(namesProtection)return {recognized:'You correctly identified 2♠ and 9♠ as part of the protection system underneath Q♠.',missing:'The other part of the question was which non-spade liabilities you want to lose early.',nextQuestion:'What do you want to do with Q♣ and 10♦ while higher cards can still cover them?'};
      if(namesShed)return {recognized:'You correctly identified Q♣ and 10♦ as early shedding targets.',missing:'The other part is the protection structure around Q♠.',nextQuestion:'What jobs do 2♠ and 9♠ have while Q♠ is still in your hand?'};
      return {recognized:'You named cards that matter to the plan.',missing:'Separate the protection cards from the early shedding targets.',nextQuestion:'Which cards protect Q♠, and which cards should you try to lose before they promote into winners?'};
    }

    if(id==='next'){
      const createsRoute=has(t,/(void|disposal|place to (dump|discard)|chance to (dump|discard)|safe.*(dump|discard|lose)|create.*opportun)/);
      const namesTarget=has(t,/(q♠|q♥|10♥|high hearts?|queen of spades)/);
      if(createsRoute&&namesTarget)return done('You answered both parts: after the early liabilities are reduced, you want to create a safe disposal route, and you tied that new state to getting rid of Q♠ or the dangerous high hearts.');
      if(createsRoute)return {recognized:'You correctly identified a useful void or other disposal route as the next state to create.',missing:'Name the dangerous card that route is supposed to carry out of your hand.',nextQuestion:'Would Q♠, Q♥, or 10♥ be your first disposal target?'};
      if(namesTarget)return {recognized:'You correctly kept Q♠ and the high hearts in view as the next liabilities to solve.',missing:'Now name the position you want to create so one of them can leave safely.',nextQuestion:'What state would make it easier to unload that card safely?'};
      return {recognized:'You are thinking about what should happen after the first part of the plan succeeds.',missing:'The next step should create a concrete disposal opportunity for one of the remaining dangerous cards.',nextQuestion:'What position would make it easier to get rid of Q♠ or the high hearts?'};
    }

    if(id==='preserve'){
      const preservesProtection=has(t,/(2♠|protect.*q♠|q♠.*protect)/);
      const namesExit=has(t,/(5♣|6♦|6♥|7♥|low (club|diamond|heart)|low card).*(exit|get off lead|lose|surrender)|exit.*(5♣|6♦|6♥|7♥))/);
      if(preservesProtection&&namesExit)return done('You answered both parts: 2♠ must be preserved while Q♠ still depends on it, and you also identified a low card to keep as a later way to surrender the lead.');
      if(preservesProtection)return {recognized:'Right. 2♠ has a future job because it protects Q♠ through another spade round.',missing:'The second part was to preserve a separate low card that can help you get off lead later.',nextQuestion:'Besides 2♠, which low card would you keep as a later exit?'};
      if(namesExit)return {recognized:'You identified a useful low exit to preserve for later.',missing:'The other card that must survive is the one Q♠ still depends on for protection.',nextQuestion:'Which spade must you preserve while Q♠ is still exposed?'};
      return {recognized:'You are looking for cards whose value comes from what they can do later.',missing:'Identify both the Q♠ protection card and a separate low exit.',nextQuestion:'Which card protects Q♠, and which low card would you keep for surrendering the lead later?'};
    }
    return null;
  }

  function usefulVoidDiagnosis(id,t){
    if(id==='objective'){
      const namesDanger=has(t,/(a♠|ace of spades|j♥|jack of hearts|forced winner|future winner|dangerous card|liabilit)/);
      const statesGoal=has(t,/(unload|dump|discard|shed|lose.*saf|void|place to|get rid|avoid.*win|prevent.*win)/);
      if(namesDanger&&statesGoal)return done('You answered both parts: you identified the card or cards most likely to trap you later, and you stated that the useful state is one that lets those liabilities leave the hand safely.');
      if(namesDanger)return {recognized:'You identified the right kind of danger, especially A♠ and possibly J♥.',missing:'The second part is what you want to make possible for that card.',nextQuestion:'What position would let you unload that card safely later?'};
      if(has(t,/(shortest.*void|void.*shortest|clubs.*shortest)/))return {recognized:'You noticed that clubs are relatively short.',correction:'That alone does not make clubs the best void.',missing:'A useful void needs a specific dangerous card to carry out of the hand.',nextQuestion:'Which card would you want a club void to help you unload?'};
      return {recognized:'You are looking for a way to make a void useful rather than simply making the shortest suit disappear.',missing:'Start by naming the dangerous card you want the void to help you unload.',nextQuestion:'Which worries you more in this hand, A♠, J♥, 10♠, K♣, or J♦, and why?'};
    }

    if(id==='control'){
      const choosesOffLead=has(t,/(no control|off lead|stay off|don'?t need.*lead|do not need.*lead|someone else.*lead)/);
      const explainsBenefit=has(t,/(shed|lose|discard|dump|club|void|a♠|j♥|unload|other player|opponent)/);
      if(choosesOffLead&&explainsBenefit)return done('You answered both parts: you prefer to stay off lead, and you connected that choice to letting other players open the suits you need in order to shed clubs or unload a dangerous card.');
      if(choosesOffLead)return {recognized:'Staying off lead is a reasonable choice while you build the void.',missing:'The second part is what staying off lead makes easier.',nextQuestion:'What becomes easier to do with A♠ or your clubs while another player keeps the lead?'};
      const takesLead=has(t,/(take.*lead|want.*lead|control|win.*lead)/);
      const followUp=has(t,/(lead.*club|club.*lead|k♣|8♣|3♣|advance.*void|shorten.*club)/);
      if(takesLead&&followUp)return done('You tied taking control to a concrete club follow-up that advances the void plan, so both parts of the control question are addressed.');
      return {recognized:'You are considering whether having the lead helps create the void.',missing:'Choose the control state and tie it to what you would actually do next.',nextQuestion:'Would you rather keep the lead or give it away, and what would that choice let you do with this hand?'};
    }

    if(id==='cards'){
      const namesClubs=has(t,/(k♣|8♣|3♣|clubs?)/);
      const givesOrder=has(t,/(first|last|before|after|keep.*3♣|3♣.*last|lose.*k♣|shed.*k♣|k♣.*first|8♣.*before|exhaust|become void)/);
      if(namesClubs&&givesOrder)return done('You answered the card-management question by identifying the club holding and giving it an order or job sequence that moves the hand toward a useful club void.');
      if(namesClubs)return {recognized:'You identified the actual clubs that have to be managed if clubs are going to disappear from your hand.',missing:'The second part is the order or job for those cards.',nextQuestion:'Which club would you prefer to lose first, and which would you prefer to keep until last?'};
      return {recognized:'You are identifying cards that matter to the void plan.',missing:'Focus on the actual club holding and how it must be reduced.',nextQuestion:'What jobs should K♣, 8♣, and 3♣ have if clubs are going to become a useful void?'};
    }

    if(id==='next'){
      const usesVoid=has(t,/(dump|discard|dispose|unload|shed|use.*void|club lead)/);
      const namesTarget=has(t,/(a♠|j♥|10♠|ace of spades|jack of hearts)/);
      if(usesVoid&&namesTarget)return done('You answered both parts: once the void exists, you want to use the next club lead as a disposal opportunity, and you named the dangerous card you would try to unload.');
      if(usesVoid)return {recognized:'You correctly identified what the void is for: disposing of a dangerous card on a later club lead.',missing:'The second part is which card gets priority.',nextQuestion:'If A♠ and J♥ are both still present, which would you unload first?'};
      if(namesTarget)return {recognized:'You identified a sensible disposal target.',missing:'Now state how the club void will actually be used to get that card out.',nextQuestion:'What do you want to do when another player next leads clubs?'};
      return {recognized:'You are thinking about what the void should let you do next.',missing:'Tie the void to both an action and a specific disposal target.',nextQuestion:'On the next club lead, what will you do and which card will you try to unload?'};
    }

    if(id==='preserve'){
      const namesLow=has(t,/(4♦|4♥|2♠|low card|low diamond|low heart)/);
      const statesJob=has(t,/(exit|get off lead|surrender.*lead|lose.*lead|avoid.*control|stay off lead|later loser)/);
      if(namesLow&&statesJob)return done('You answered both parts: you identified a low card worth preserving and explained its later job as an exit or a way to avoid being trapped on lead.');
      if(namesLow)return {recognized:'You picked a sensible low card to preserve.',missing:'The other part is the later job you are saving it for.',nextQuestion:'After A♠ is gone, how could that low card help you surrender the lead?'};
      return {recognized:'You are looking for cards that still have a job after the void is created.',missing:'Choose a low card and explain the later exit job you are preserving it for.',nextQuestion:'Which low card would you save, and how would it help you get off lead later?'};
    }
    return null;
  }

  function genericDiagnosis(id,t,exercise){
    const cards=(exercise&&exercise.hand)||[];
    const labels=cards.map(c=>adapter.cardLabel(c));
    const sample=labels.slice(0,5).join(', ');
    if(id==='objective') return {recognized:'You are trying to identify what could become difficult later.',missing:'Keep the answer tied to both the dangerous cards and the outcome you want to prevent.',nextQuestion:`Which cards in this hand worry you most${sample?` among ${sample}${labels.length>5?', …':''}`:''}, and what do you want to prevent from happening to them?`};
    if(id==='control') return {recognized:'You are thinking about whether you want the lead.',missing:'Give both the control choice and the hand-specific reason for it.',nextQuestion:'Do you want the lead or not, and what does that choice make easier to do next?'};
    if(id==='cards') return {recognized:'You are identifying cards that matter to the plan.',missing:'Give each named card a specific job in this hand.',nextQuestion:'Which cards are for shedding, which are for preserving, and which can change who has the lead?'};
    if(id==='next') return {recognized:'You are thinking beyond the first objective.',missing:'Name both the new state you want and the card problem that state solves.',nextQuestion:'After your first objective succeeds, what becomes possible and which remaining card does that help you manage?'};
    if(id==='preserve') return {recognized:'You are thinking about cards that need to survive for later.',missing:'Name the card and the future job you are preserving it for.',nextQuestion:'Which card would you regret spending now, and what later job does it still need to do?'};
    return null;
  }

  function diagnose(step,response,context){
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
    const diagnosis=diagnose(step,response,context);
    if(diagnosis) result.diagnosis=diagnosis;
    delete result.feedback;
    return result;
  };
  adapter.__structuredDiagnosisWrapped=true;
})();
