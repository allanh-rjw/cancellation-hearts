import {cardPoints,isTwoClubs} from './cards.mjs';

export function findOpeningLeader(players,dealer){
  const twoClubs=[];
  players.forEach((player,seat)=>{
    for(const card of player.hand)if(isTwoClubs(card))twoClubs.push({seat,card});
  });
  if(twoClubs.length!==2)throw new Error(`Expected exactly two physical 2♣ cards; found ${twoClubs.length}.`);
  for(let step=1;step<=players.length;step++){
    const seat=(dealer+step)%players.length;
    if(twoClubs.some(entry=>entry.seat===seat))return seat;
  }
  throw new Error('Unable to resolve opening leader.');
}

export function openingHandHasLegalCard(hand){
  return hand.some(card=>card.suit==='C'||card.suit==='D'||(card.suit==='S'&&card.rank!=='Q'));
}

export function openingRoundFeasible(players){
  return players.every(player=>openingHandHasLegalCard(player.hand));
}

export function openingLegalCards(state,playerIndex){
  if(state.phase!=='playing'||state.trickNumber!==0)return [];
  if(state.trick.some(play=>play.player===playerIndex))return [];
  if(state.trick.length===0&&playerIndex!==state.openingLeaderSeat)return [];

  const hand=state.players[playerIndex].hand;
  const twos=hand.filter(isTwoClubs);
  if(twos.length)return twos;

  const clubs=hand.filter(card=>card.suit==='C');
  if(clubs.length)return clubs;

  return hand.filter(card=>cardPoints(card)===0&&(card.suit==='D'||card.suit==='S'));
}

export function validateOpeningPlay(state,playerIndex,card){
  if(playerIndex!==state.currentPlayer)return false;
  const legal=openingLegalCards(state,playerIndex);
  return !!card&&legal.some(candidate=>candidate.id===card.id);
}
