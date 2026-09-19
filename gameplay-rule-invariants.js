// Canonical gameplay rule invariants.
// This layer is deliberately strategy-agnostic: AI, tutor, and UI choices must all obey it.

(function installGameplayRuleInvariants(){
  if(window.__cancellationHeartsRuleInvariants?.installed)return;

  const isTwoClubs=card=>card?.suit==='C'&&card?.rank==='2';
  const isPointCard=card=>cardPoints(card)>0;
  const seatAlreadyPlayed=seat=>state.trick.some(play=>play.player===seat);
  const openingLeader=()=>firstTwoClubsHolderLeftOfDealer();

  function openingRoundFeasible(){
    return state.players.every(player=>player.hand.some(card=>card.suit==='C'||card.suit==='D'));
  }

  function openingLegalCards(playerIndex){
    const hand=state.players[playerIndex].hand;
    if(seatAlreadyPlayed(playerIndex))return [];
    if(state.trick.length===0&&playerIndex!==openingLeader())return [];

    const twoClubs=hand.filter(isTwoClubs);
    if(twoClubs.length)return twoClubs;

    const clubs=hand.filter(card=>card.suit==='C');
    if(clubs.length)return clubs;

    // Opening trick may never contain points or spades. A player void in clubs
    // therefore may discard only a diamond.
    return hand.filter(card=>card.suit==='D'&&!isPointCard(card));
  }

  const baseLegalCards=legalCards;
  legalCards=function(playerIndex){
    if(seatAlreadyPlayed(playerIndex))return [];
    if(state.trickNumber===0)return openingLegalCards(playerIndex);
    return baseLegalCards(playerIndex);
  };

  startFirstTrick=function(){
    if(!openingRoundFeasible()){
      state.ruleRedealAttempts=(state.ruleRedealAttempts||0)+1;
      if(state.ruleRedealAttempts>20)throw new Error('Unable to generate a hand with a legal opening trick after 20 attempts.');
      setStatus('Redealing: at least one player has no legal opening-trick card under the no-points/no-spades rule.');
      setTimeout(beginRound,0);
      return;
    }
    state.ruleRedealAttempts=0;
    state.phase='playing';
    state.trickNumber=0;
    state.leader=openingLeader();
    state.currentPlayer=state.leader;
    state.trick=[];
    state.openingAutoPlayers=new Set();
    state.openingLeadSuit='C';
    renderAll();
    setStatus(`${state.players[state.leader].name} has the first 2♣ clockwise from the dealer and must lead exactly one copy.`);
    continueTurn();
  };

  const basePlayCard=playCard;
  playCard=function(playerIndex,card){
    if(!card||state.phase!=='playing')return;
    if(playerIndex!==state.currentPlayer)return;
    if(seatAlreadyPlayed(playerIndex))return;

    if(state.trickNumber===0){
      if(isPointCard(card)||card.suit==='S')return;
      if(state.trick.length===0&&(playerIndex!==openingLeader()||!isTwoClubs(card)))return;
      if(state.players[playerIndex].hand.some(isTwoClubs)&&!isTwoClubs(card))return;
    }

    const legal=legalCards(playerIndex);
    if(!legal.some(candidate=>candidate.id===card.id))return;
    basePlayCard(playerIndex,card);
  };

  function highestCancellingPair(trick,ledSuit){
    const groups=new Map();
    for(const play of trick){
      if(play.card.suit!==ledSuit||!play.cancelled)continue;
      const key=`${play.card.suit}:${play.card.rank}`;
      const group=groups.get(key)||[];
      group.push(play);
      groups.set(key,group);
    }
    return [...groups.values()]
      .filter(group=>group.length===2)
      .sort((a,b)=>RANK_VALUE[b[0].card.rank]-RANK_VALUE[a[0].card.rank])[0]||null;
  }

  function splitWholePoints(total,pair){
    const first=Math.ceil(total/2),second=Math.floor(total/2);
    return [
      {player:pair[0].player,points:first},
      {player:pair[1].player,points:second}
    ];
  }

  const baseFinishTrick=finishTrick;
  finishTrick=function(){
    const led=currentLedSuit();
    const eligible=state.trick.filter(play=>play.card.suit===led&&!play.cancelled);
    const finalTrick=gameplayAllHandsEmpty();
    if(!finalTrick||eligible.length)return baseFinishTrick();

    const pair=highestCancellingPair(state.trick,led);
    if(!pair)throw new Error('Final cancelled trick has no cancelling pair in the led suit.');

    const trickPoints=state.trick.reduce((sum,play)=>sum+cardPoints(play.card),0);
    const carried=state.carryoverPoints;
    const total=trickPoints+carried;
    const awards=splitWholePoints(total,pair);
    for(const award of awards)state.players[award.player].roundPoints+=award.points;
    state.players[awards[0].player].tricks.push(...state.carryoverCards,...state.trick.map(play=>play.card));
    state.carryoverPoints=0;
    state.carryoverCards=[];
    state.currentTrickAward={winner:null,points:total,carried,finalCancellation:true,split:true,awards};
    renderTrickCoach();
    state.trickNumber++;
    state.phase='trick-end';
    $('nextTrickBtn').classList.add('hidden');
    setStatus(`The final trick cancelled. ${state.players[awards[0].player].name} and ${state.players[awards[1].player].name} split ${total} unresolved penalty point${total===1?'':'s'} as the highest-value canceling pair.`);
    renderAll();

    if(state.mode==='practice'&&total>0){
      const outsider=awards.find(award=>award.points>0&&practiceShootBroken(award.player,award.points));
      if(outsider){endBrokenPractice(outsider.player,outsider.points);return;}
    }
    setTimeout(finishRound,350);
  };

  function updateRulesUi(){
    const rules=document.querySelector('#rulesDialog .rules-copy');
    if(!rules)return;
    rules.innerHTML=`
      <p>Eight players use two standard decks. Everyone receives 13 cards.</p>
      <p>Each heart is worth 1 point. Each queen of spades is worth 13 points.</p>
      <p>Identical cards cancel. If the highest eligible cards cancel, the next-highest uncancelled card wins the trick.</p>
      <p>If every card in the led suit cancels before the final trick, the trick has no winner. Its penalty points carry into the next trick, and the same player leads again. The next player to win a trick collects both the new points and all carried points.</p>
      <p>The 2♣ cards may be passed. On the opening trick, the first player clockwise from the dealer holding a 2♣ must lead exactly one 2♣. A player holding both copies plays exactly one. Every other player holding a 2♣ must play exactly one when reached.</p>
      <p>Every player may contribute only one card to a trick. No player may play twice in the same trick.</p>
      <p>The opening trick may never contain a point card or any spade. Players must follow clubs when able; a player void in clubs may discard only a diamond. If a post-pass hand leaves any player with no legal opening card, the hand is redealt before play begins.</p>
      <p>If the final trick has no uncancelled card in the led suit, all unresolved penalty points are split between the two players who played the highest-ranked canceling pair. Whole points are split as evenly as possible; any odd remainder goes to the earlier-played member of that pair.</p>
      <p>Hearts are broken only when a heart is discarded.</p>
      <p>Passing rotates: one seat left, one right, two left, two right, three left, three right, across, then hold.</p>
      <p>Solo moon: one player captures all 52 penalty points; every other player receives 104.</p>
      <p>Two-player moon: exactly two players collectively capture all 52 penalty points; both receive 0 and every other player receives 26.</p>`;
  }

  updateRulesUi();
  window.__cancellationHeartsRuleInvariants=Object.freeze({
    installed:true,
    openingRoundFeasible,
    openingLegalCards,
    highestCancellingPair,
    splitWholePoints,
    updateRulesUi
  });
})();
