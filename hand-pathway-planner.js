function lowCardsBySuit(m,suit){
  return m.hand.filter(c=>c.suit===suit).sort((a,b)=>RANK_VALUE[a.rank]-RANK_VALUE[b.rank]);
}
function spadeSystemAssessment(m){
  const spades=lowCardsBySuit(m,'S');
  const queen=spades.find(c=>c.rank==='Q');
  const lows=spades.filter(c=>RANK_VALUE[c.rank]<12);
  const veryLow=lows.filter(c=>RANK_VALUE[c.rank]<=5);
  const exposedHigh=spades.filter(c=>['A','K','Q'].includes(c.rank));
  if(!queen) return {queen:null,lows,veryLow,exposedHigh,text:spades.length?`No Q♠ in hand. Your ${spades.map(cardLabel).join(', ')} can be judged mainly as control and exit cards.`:'You are void in spades.'};
  if(veryLow.length>=1&&lows.length>=2) return {queen,lows,veryLow,exposedHigh,text:`Q♠ is protected by ${lows.map(cardLabel).join(' and ')}. Those low spades are part of the queen-protection system, not disposable exits.`};
  if(lows.length>=1) return {queen,lows,veryLow,exposedHigh,text:`Q♠ has only partial protection from ${lows.map(cardLabel).join(', ')}. Spending the low spade${lows.length>1?'s':''} early can leave the queen exposed.`};
  return {queen,lows,veryLow,exposedHigh,text:'Q♠ is severely exposed because you have no lower spade protection.'};
}
function heartLiabilityAssessment(m){
  const hearts=lowCardsBySuit(m,'H');
  const awkward=hearts.filter(c=>RANK_VALUE[c.rank]>=9&&RANK_VALUE[c.rank]<=12);
  const control=hearts.filter(c=>RANK_VALUE[c.rank]>=13);
  return {hearts,awkward,control,text:awkward.length?`${awkward.map(cardLabel).join(', ')} are medium-high hearts that can become forced winners as higher hearts disappear.`:(hearts.length>=5?'Your long heart holding can become a control trap late even without obvious medium-high liabilities.':'Your hearts do not currently form the main structural problem.')};
}
function usefulVoidCandidates(m){
  const spade=spadeSystemAssessment(m);
  return SUITS.map(s=>{
    const cards=lowCardsBySuit(m,s);
    let score=cards.length*12;
    if(s==='H') score+=25;
    if(s==='S'&&spade.queen) score+=35;
    if(cards.some(c=>RANK_VALUE[c.rank]<=5)) score+=10;
    if(cards.some(c=>cardPoints(c)>0)) score-=6;
    return {s,count:cards.length,cards,score};
  }).filter(x=>x.count>0).sort((a,b)=>a.score-b.score);
}
function protectedCardsForPlan(m){
  const protected=[];
  const sp=spadeSystemAssessment(m);
  if(sp.queen) protected.push(...sp.veryLow.slice(0,2));
  const bySuit=SUITS.flatMap(s=>lowCardsBySuit(m,s).slice(0,1));
  for(const c of bySuit){
    if(!protected.some(x=>x.id===c.id) && RANK_VALUE[c.rank]<=6) protected.push(c);
  }
  return protected;
}
function likelyLiabilityCards(m){
  const sp=spadeSystemAssessment(m), hearts=heartLiabilityAssessment(m);
  const cards=[];
  if(sp.queen) cards.push(sp.queen);
  cards.push(...hearts.awkward);
  cards.push(...likelyFutureWinners(m));
  return [...new Map(cards.map(c=>[c.id,c])).values()].sort((a,b)=>cardPoints(b)-cardPoints(a)||RANK_VALUE[b.rank]-RANK_VALUE[a.rank]);
}
function pathwayPhase(title,goal,condition,action,followUp,preserve,advance,avoid){
  return {title,goal,condition,action,followUp,preserve,advance,avoid};
}
function buildHandPathway(){
  if(!state.players.length) return {strategy:'avoidance',phase:'Waiting',immediate:'Start the hand',desired:'Preserve flexibility',entry:'None yet',exit:'None yet',preserve:'None',transition:'Deal the cards',abort:'None',steps:[],phases:[]};
  const m=humanHandMetrics();
  const strategy=state.coachStrategy||recommendedStrategy(m);
  const sp=spadeSystemAssessment(m);
  const hearts=heartLiabilityAssessment(m);
  const voids=usefulVoidCandidates(m);
  const liabilities=likelyLiabilityCards(m);
  const protectedCards=protectedCardsForPlan(m);
  const entries=reliableEntryCards(m);
  const reliableEntries=entries.filter(x=>x.reliable);
  const entryObj=reliableEntries[0]||entries[0]||null;
  const entry=entryObj?.c||null;
  const exits=[...m.exits].filter(c=>!protectedCards.some(x=>x.id===c.id)).sort((a,b)=>RANK_VALUE[a.rank]-RANK_VALUE[b.rank]);
  const fallbackExits=[...m.exits].sort((a,b)=>RANK_VALUE[a.rank]-RANK_VALUE[b.rank]);
  const exit=exits[0]||fallbackExits[0]||null;
  const target=scoreTargetIndex();
  const targetName=target!=null?state.players[target].name:'the low-score leader';
  const targetVoids=target!=null?[...inferredVoids(target)]:[];
  const threat=currentMoonThreat();
  const prePass=state.phase==='passing'&&state.passOffset!==0;
  const entryText=entry?`${cardLabel(entry)}${entryObj&&!entryObj.reliable?' is only conditional because its twin is still live':' is currently the most reliable high-card entry'}`:'No reliable lead-acquisition card is established yet';
  const exitText=exit?cardLabel(exit):'No clean low exit is established yet';
  const preserveText=protectedCards.length?`Preserve ${protectedCards.map(cardLabel).join(', ')} unless their protective role disappears.`:'Preserve at least one genuinely low card in a suit that is still safe to lead or follow.';
  let phase='',immediate='',desired='',transition='',abort='',steps=[],phases=[];

  if(prePass){
    const highSide=m.hand.filter(c=>c.suit!=='H'&&RANK_VALUE[c.rank]>=10).sort((a,b)=>cardPoints(b)-cardPoints(a)||RANK_VALUE[b.rank]-RANK_VALUE[a.rank]);
    phase='Shape the post-pass hand';
    immediate=`Do not commit to a void, entry card, or exit card yet. First use the pass to reduce the hand's actual liabilities, then rebuild the pathway after the three incoming cards arrive.`;
    desired=`Finish the pass with fewer forced winners, adequate Q♠ protection if you keep the queen, and at least one low card that still gives you mobility. ${sp.text} ${hearts.text}`;
    transition='The moment the incoming three cards arrive, discard this provisional plan and generate a new one from the 13-card post-pass hand.';
    abort='Do not create a nominal void if doing so strips Q♠ protection or trades away useful low cards merely because that suit is shortest.';
    const candidateText=highSide.slice(0,4).map(cardLabel).join(', ')||'your highest side-suit liabilities';
    phases=[
      pathwayPhase('1. Fix the hand structure',
        `Reduce the cards most likely to force unwanted control. Current candidates include ${candidateText}.`,
        'You are still before the pass, so incoming cards can completely change which suit should become a void.',
        `Compare three-card pass packages, not isolated cards. If Q♠ is retained, treat ${sp.lows.length?sp.lows.map(cardLabel).join(' and '):'low spades'} as protection rather than automatic pass/exit cards.`,
        `After the pass returns, recount every suit and reassess Q♠, heart density, future winners, and the safest route off lead.`,
        preserveText,
        'Advance only after the incoming cards are known.',
        'Do not name a final void or tell yourself that K♦, A♣, etc. is an “entry” if that card may be passed away.'
      ),
      pathwayPhase('2. Build the real line of play',
        'Turn the post-pass hand into a causal sequence: shed liabilities → create/use a discard channel → take control only for a specific follow-up → get off lead when that job is done.',
        'The post-pass suit structure is known.',
        'Choose the first concrete objective from the actual returned hand.',
        'Every lead-acquisition card must be paired with a named follow-up lead and a reason for taking control.',
        'Keep whichever low cards support queen protection or later lead surrender.',
        'Advance when the first objective has a specific card-level route.',
        'If the planner cannot fill in “win with X → lead Y → accomplish Z,” it must not recommend seizing the lead.'
      )
    ];
    steps=phases.map(x=>`${x.goal} ${x.action}`);
  } else if(strategy==='avoidance'){
    const vc=voids[0];
    const voidName=vc?suitName(vc.s):'no obvious suit';
    const awkward=liabilities.filter(c=>!protectedCards.some(x=>x.id===c.id)).slice(0,5);
    const disposalPriority=[
      ...(sp.queen?[sp.queen]:[]),
      ...hearts.awkward,
      ...likelyFutureWinners(m)
    ].filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i);
    const followSuit=vc?.s||null;
    phase=vc&&vc.count<=2?`Create a useful ${voidName} discard channel`:awkward.length?'Shed cards before they become winners':'Preserve mobility';
    immediate=awkward.length?`Look for safe losing opportunities to remove ${awkward.map(cardLabel).join(', ')} without spending the cards that keep Q♠ protected or let you surrender the lead later.`:`Stay off lead unless taking control creates a specific next move that improves the hand.`;
    desired=`Reach the late hand with a usable discard channel, Q♠ either gone or still protected, fewer medium-high hearts, and at least one safe route off lead. ${sp.text} ${hearts.text}`;
    transition=vc&&vc.count<=2?`Advance once you are actually void in ${voidName}; the void matters only when it can dispose of a specific liability.`:'Advance when a useful void appears or the dangerous medium/high cards have been shed.';
    abort=`If ${threat.credible?state.players[threat.collectors[0]?.i]?.name+' is a credible moon threat':'a credible moon threat develops'}, switch temporarily to moon defense and preserve a stopper even if that means taking a small penalty.`;
    phases=[
      pathwayPhase('1. Shed liabilities while losing is still easy',
        awkward.length?`Get rid of ${awkward.map(cardLabel).join(', ')} before higher cards disappear and promote them.`:'Keep your current low-card mobility while waiting for a useful structural opportunity.',
        'Another player is already winning the led suit with a card that safely covers one of your liabilities after cancellation is considered.',
        'Play the highest card that is still safely losing rather than automatically spending your lowest card.',
        vc&&vc.count<=2?`Use those safe losses to shorten ${voidName} if doing so does not sacrifice Q♠ protection.`:'Let the first useful void emerge from actual play rather than forcing the shortest suit mechanically.',
        preserveText,
        vc&&vc.count<=2?`Move to Phase 2 when your last ${voidName.toLowerCase()} is gone.`:'Move to Phase 2 when you become void in a suit or can unload Q♠/a dangerous heart safely.',
        'Do not burn a protected low spade merely because it is the lowest legal card.'
      ),
      pathwayPhase('2. Turn the void into a disposal channel',
        disposalPriority.length?`Use the void to unload ${disposalPriority.slice(0,4).map(cardLabel).join(', ')} in that order as safety permits.`:'Use the void to unload whichever card has become the strongest unwanted winner.',
        'Someone else leads the suit in which you are void and the post-cancellation winner is unlikely to become you.',
        'Discard the liability whose future cost is highest, not simply the highest printed rank.',
        entry?`If taking control afterward would let you force another disposal opportunity, ${cardLabel(entry)} can become an entry card; otherwise stay off lead.`:'Continue using other players’ leads rather than manufacturing control.',
        preserveText,
        'Move to Phase 3 only when there is a concrete reason to own the lead.',
        'A void that merely lets you dump onto the wrong player or expose a moon threat is not automatically useful.'
      ),
      pathwayPhase('3. Seize the lead only with a named follow-up',
        entry?`Use ${cardLabel(entry)} to take control only when you can state the next move as “win with ${cardLabel(entry)} → lead a specific suit → accomplish a specific disposal/targeting goal.”`:'Do not seek the lead yet; no reliable entry card currently supports a productive continuation.',
        'The trick is clean enough to win and the follow-up lead advances the hand rather than simply transferring control to you.',
        entry?`Before playing ${cardLabel(entry)} as a winner, identify the exact card or suit you will lead next.`:'Continue shedding and preserving mobility.',
        followSuit?`A likely follow-up is ${suitName(followSuit)} only if leading it completes/uses the planned void rather than feeding points to an opponent who is already void.`:'Choose the follow-up from confirmed suit information.',
        preserveText,
        'Once that follow-up objective is completed, immediately enter Phase 4.',
        'If you cannot name the useful follow-up, decline the lead when possible.'
      ),
      pathwayPhase('4. Cede control after the job is done',
        `Get off lead before your remaining medium/high cards become point magnets.`,
        'The reason for taking control has been accomplished.',
        `Use ${exitText} only if it is still genuinely safe at that moment; recompute the exit from current voids and Q♠ status rather than treating the opening label as permanent.`,
        'Return to safe shedding or exploit the discard channel created earlier.',
        sp.queen&&sp.lows.some(c=>exit&&c.id===exit.id)?`Do not spend ${exitText} merely as an exit while Q♠ remains exposed.`:preserveText,
        'Enter endgame calculation when only a few cards remain and effective winners are mostly known.',
        'A printed low card is not a safe exit if the suit has collapsed and that card has become an effective winner.'
      )
    ];
    steps=phases.map(x=>`${x.goal} ${x.action}`);
  } else if(strategy==='targeting'){
    phase=targetVoids.length?'Build a delivery route to the target':'Learn the target before spending control';
    immediate=targetVoids.length?`${targetName} is known void in ${targetVoids.map(suitName).join(' and ')}. Build a sequence that forces points toward ${targetName} rather than merely taking the lead.`:`Use clean tricks to learn which suits ${targetName} still holds before committing your best control cards.`;
    desired=`Create a route of the form “take control with X → lead Y → force ${targetName} into the loaded outcome → get off lead.”`;
    transition=`Advance when ${targetName}'s vulnerable suit is known and you still own a card that can reliably seize the lead.`;
    abort=`If pushing points to ${targetName} would end the game in someone else's favor, abandon the targeting pathway.`;
    phases=[
      pathwayPhase('1. Map the target','Confirm where the target can and cannot follow.','At least one more informative lead/follow is available.',targetVoids.length?`Exploit the confirmed ${targetVoids.map(suitName).join('/')} void only if it helps place points rather than lets ${targetName} dump them harmlessly.`:`Preserve control while collecting suit information about ${targetName}.`,'Identify the exact suit that will be used for delivery.',preserveText,'Advance when a delivery suit is confirmed.','Do not spend the queen or your strongest entry merely because the target is currently low score.'),
      pathwayPhase('2. Acquire with purpose',entry?`Use ${cardLabel(entry)} as the entry into the targeting sequence.`:'Wait for a reliable entry to emerge.','The delivery suit is ready and the target outcome is favorable.',entry?`Win with ${cardLabel(entry)}, then immediately lead the prepared delivery suit.`:'Stay off lead until the sequence is executable.',`Force ${targetName} into the point-placement line, then reassess who wins after any cancellation.`,preserveText,'Advance after the delivery attempt resolves.','Abort if duplicate cancellation promotes the wrong player.'),
      pathwayPhase('3. Exit or repeat','Stop owning the lead once the targeting purpose is complete.','The point-placement attempt has resolved.',`Use ${exitText} if still safe, or repeat the delivery only if the target remains constrained.`,'Return to avoidance if the target route disappears.',preserveText,'Re-enter Phase 1 when new void information changes the map.','Do not turn targeting into indiscriminate point dumping.')
    ];
    steps=phases.map(x=>`${x.goal} ${x.action}`);
  } else if(strategy==='cancellation'){
    phase=state.trickNumber<4?'Map live duplicate chains':'Create a calculated cancellation';
    immediate='Identify not just which twins are live, but who becomes winner after the matching cards disappear.';
    desired='Use cancellation only when it creates a predictable next winner and a useful next state.';
    transition='Advance when the full post-cancellation winner can be named.';
    abort='Abort any cancellation whose promoted winner is unknown, strategically wrong, or would collect a dangerous carryover pot.';
    phases=[
      pathwayPhase('1. Map the duplicate chain','Know which high twins remain live and which ranks become promoted if they cancel.','Enough copies have been seen to calculate the next uncancelled rank.','Track A/K/Q/J copies in the suits that matter.','Name the exact post-cancellation winner before committing.',preserveText,'Advance once the winner after cancellation is predictable.','“A duplicate exists” is not a reason to cancel.'),
      pathwayPhase('2. Create the useful cancellation','Change control in the intended direction.','The promoted winner benefits your strategy.',entry?`Use ${cardLabel(entry)} only if it helps set up the calculated chain.`:'Let another player supply the control if your own entry is unreliable.','Execute the cancellation and verify the promoted winner.',preserveText,'Advance after control changes as planned.','Abort if an outsider is promoted onto a loaded trick.'),
      pathwayPhase('3. Convert and exit','Use the new winner/lead state to accomplish something concrete, then get off lead if needed.','The cancellation has resolved.','Exploit the resulting lead or void immediately.',`Use ${exitText} only after the cancellation's strategic purpose is complete.`,preserveText,'Return to mapping as new duplicate information appears.','Do not keep forcing cancellations after the useful window closes.')
    ];
    steps=phases.map(x=>`${x.goal} ${x.action}`);
  } else if(strategy==='soloMoon'){
    const myPts=state.players[0].roundPoints;
    phase=myPts<8?'Verify control before committing':myPts<26?'Connect the control suits':'Close the moon';
    immediate=myPts<8?'Test whether your apparent winners survive cancellation and whether every weak suit has a route back to control.':'Keep every penalty-bearing trick with you and prevent any control transfer to an outsider.';
    desired='Create continuous control: secure queens, connect suit winners, and remove every route by which an outsider could capture a penalty card.';
    transition='Commit fully only when the weak-suit tests and queen topology confirm that control can remain with you.';
    abort='The moment another player captures a penalty card, solo moon is dead. Pivot immediately.';
    phases=[
      pathwayPhase('1. Test control','Verify your weakest suit and the live duplicate risks before exposing the full moon attempt.','A clean non-penalty trick can test a control suit.',entry?`Use ${cardLabel(entry)} only if its post-cancellation winner remains you.`:'Probe through a suit where control can be inferred without surrendering points.','Use the result to identify the next connected control suit.','Preserve any low card that is actually needed to recover lead after a cancellation.','Advance when every weak suit has a known route back to your control.','Abort if an outsider wins any penalty card.'),
      pathwayPhase('2. Secure the queens','Make both Q♠ outcomes remain inside your control.','The queen can be played/captured without promoting an outsider.','Calculate the winner after any Q♠ cancellation before playing into it.','Once queens are safe, connect into the heart run.',preserveText,'Advance when queen risk is resolved and heart control is stable.','Never cancel queens if the promoted winner is outside your control.'),
      pathwayPhase('3. Run and close','Keep all remaining penalty cards while denying outsiders a winning entry.','Remaining effective winners are mostly known.','Cash control suits in the order that prevents a forced surrender.','Use non-penalty tricks only to move between your own control suits.','Stop preserving exits once losing the lead is more dangerous than retaining flexibility.','Finish when all remaining penalty tricks are forced to you.','Any outsider penalty capture ends the plan.')
    ];
    steps=phases.map(x=>`${x.goal} ${x.action}`);
  } else {
    const threatNow=currentMoonThreat();
    const other=threatNow.collectors.find(x=>x.i!==0);
    const partner=state.mode==='practice'&&state.partnerIndex!=null?state.players[state.partnerIndex].name:(other?state.players[other.i].name:'the prospective partner');
    phase='Build a two-player control network';
    immediate=`Verify which suits you control and which must be covered by ${partner}; every planned lead transfer must survive duplicate cancellation.`;
    desired=`Create a chain “you win → transfer to ${partner} → ${partner} covers your weak suit → transfer back,” with no penalty-bearing trick escaping to a third player.`;
    transition=`Advance when ${partner} has demonstrated reliable control in at least one suit where you are vulnerable.`;
    abort='If a third player captures any penalty card, the two-player moon is dead. Pivot immediately.';
    phases=[
      pathwayPhase('1. Divide control','Assign each weak suit to one member of the shooting pair.','Both players have shown enough cards to infer complementary control.',`Identify the suit you cannot safely win and verify that ${partner} can.`,'Choose the exact card/suit used to transfer the lead into that partner-controlled suit.',preserveText,'Advance when at least one safe transfer route is demonstrated.','Do not assume partnership control from high printed ranks alone; cancellation can promote an outsider.'),
      pathwayPhase('2. Transfer without leakage','Move the lead between the two shooters while keeping every loaded winner inside the pair.','The post-cancellation winner of the transfer trick is known.',`Lead toward ${partner} only when the matching duplicate cannot promote a third player.`,'Use the partner-controlled suit to cover your weakness and create the route back.',preserveText,'Advance when all remaining weak suits are covered inside the pair.','Any third-player penalty capture ends the plan.'),
      pathwayPhase('3. Close the network','Stop using ordinary exits and keep control circulating only inside the pair.','Remaining winners can be assigned to one of the two shooters.','Cash/transfer control in the forced order.','Prevent a third player from gaining even one penalty-bearing trick.','Preserve control cards rather than low exits once the network is closed.','Finish when all penalty cards are collected by the pair.','Do not continue a dead moon after a third collector appears.')
    ];
    steps=phases.map(x=>`${x.goal} ${x.action}`);
  }

  const plan={strategy,phase,immediate,desired,entry:entryText,exit:exitText,preserve:preserveText,transition,abort,steps,phases,spadeStatus:sp.text,heartStatus:hearts.text};
  state.currentHandPathway=plan;
  return plan;
}
function renderHandPathway(){
  const box=$('handPathway'); if(!box||!state.players.length)return;
  const p=buildHandPathway();
  const phaseHtml=(p.phases||[]).map(ph=>`<div class="pathway-card causal-phase"><h4>${ph.title}</h4><p><strong>Objective:</strong> ${ph.goal}</p><p><strong>When this is available:</strong> ${ph.condition}</p><p><strong>Action:</strong> ${ph.action}</p><p><strong>What that should create:</strong> ${ph.followUp}</p><p><strong>Preserve:</strong> ${ph.preserve}</p><p><strong>Advance when:</strong> ${ph.advance}</p><p class="pathway-warning"><strong>Do not:</strong> ${ph.avoid}</p></div>`).join('');
  box.innerHTML=`<div class="pathway-summary"><div><span>Strategy</span><strong>${STRATEGY_LABELS[p.strategy]}</strong></div><div><span>Current phase</span><strong>${p.phase}</strong></div></div><div class="pathway-card"><h4>The position you are trying to create</h4><p>${p.desired}</p><p><strong>Spades:</strong> ${p.spadeStatus}</p><p><strong>Hearts:</strong> ${p.heartStatus}</p></div><div class="pathway-card"><h4>What to do now</h4><p>${p.immediate}</p></div><div class="pathway-card causal-chain"><h4>Pathway through the hand</h4><p class="small-copy">Each phase must create the condition needed for the next one. If a phase cannot name its useful follow-up, the coach should not ask you to seize control.</p></div>${phaseHtml}<div class="pathway-card"><h4>Global transition / pivot</h4><p>${p.transition}</p><p class="pathway-warning"><strong>Abort / pivot trigger:</strong> ${p.abort}</p></div>`;
}
