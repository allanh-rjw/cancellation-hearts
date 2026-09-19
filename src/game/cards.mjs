export const SUITS=Object.freeze(['C','D','S','H']);
export const RANKS=Object.freeze(['2','3','4','5','6','7','8','9','10','J','Q','K','A']);
export const RANK_VALUE=Object.freeze(Object.fromEntries(RANKS.map((rank,index)=>[rank,index+2])));

export function makeDeck(){
  const deck=[];
  for(let copy=0;copy<2;copy++){
    for(const suit of SUITS){
      for(const rank of RANKS){
        deck.push(Object.freeze({id:`${copy}:${suit}:${rank}`,copy,suit,rank}));
      }
    }
  }
  return deck;
}

export function cardPoints(card){
  if(card.suit==='H')return 1;
  if(card.suit==='S'&&card.rank==='Q')return 13;
  return 0;
}

export function isTwoClubs(card){
  return card?.suit==='C'&&card?.rank==='2';
}

export function cardLabel(card){
  return `${card.rank}${card.suit}`;
}
