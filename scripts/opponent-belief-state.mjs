const SUITS=['C','D','S','H'];
const cardKey=card=>`${card.suit}${card.rank}`;
const cloneCard=card=>({id:card.id,suit:card.suit,rank:card.rank});

export function createBelief({observerSeat,ownHand,playerCount=8}){
  return {
    observerSeat,playerCount,
    ownCards:new Map(ownHand.map(card=>[card.id,cloneCard(card)])),
    played:new Map(),knownHolders:new Map(),voids:Array.from({length:playerCount},()=>new Set()),
    handSizes:Array(playerCount).fill(13)
  };
}

export function recordPass(belief,{outgoing=[],incoming=[],recipientSeat,sourceSeat}){
  for(const card of outgoing){
    belief.ownCards.delete(card.id);
    belief.knownHolders.set(card.id,{seat:recipientSeat,card:cloneCard(card),source:'passed'});
  }
  for(const card of incoming){
    belief.ownCards.set(card.id,cloneCard(card));
    belief.knownHolders.delete(card.id);
  }
  return belief;
}

export function recordPlay(belief,{seat,card,ledSuit}){
  const seen=cloneCard(card);
  belief.played.set(card.id,{seat,card:seen});
  belief.knownHolders.delete(card.id);
  if(seat===belief.observerSeat)belief.ownCards.delete(card.id);
  if(ledSuit&&card.suit!==ledSuit)belief.voids[seat].add(ledSuit);
  belief.handSizes[seat]=Math.max(0,belief.handSizes[seat]-1);
  return belief;
}

export function cardLocation(belief,suit,rank){
  const own=[...belief.ownCards.values()].filter(card=>card.suit===suit&&card.rank===rank);
  const played=[...belief.played.values()].filter(x=>x.card.suit===suit&&x.card.rank===rank);
  const known=[...belief.knownHolders.values()].filter(x=>x.card.suit===suit&&x.card.rank===rank);
  const unknownCopies=Math.max(0,2-own.length-played.length-known.length);
  const possibleSeats=[];
  if(unknownCopies){
    for(let seat=0;seat<belief.playerCount;seat++){
      if(seat===belief.observerSeat||belief.handSizes[seat]===0||belief.voids[seat].has(suit))continue;
      possibleSeats.push(seat);
    }
  }
  return {
    key:`${rank}${suit}`,own:own.length,played:played.map(x=>x.seat),
    knownHolders:known.map(x=>x.seat),unknownCopies,possibleSeats
  };
}

export function beliefSnapshot(belief,dangerous=[['S','Q'],['S','A'],['S','K']]){
  const played=[...belief.played.values()].map(x=>({seat:x.seat,card:cloneCard(x.card)}));
  const own=[...belief.ownCards.values()].map(cloneCard);
  const remainingBySuit=Object.fromEntries(SUITS.map(suit=>[
    suit,26-played.filter(x=>x.card.suit===suit).length
  ]));
  const unseenToObserverBySuit=Object.fromEntries(SUITS.map(suit=>[
    suit,remainingBySuit[suit]-own.filter(card=>card.suit===suit).length
  ]));
  return {
    observerSeat:belief.observerSeat,ownCards:own,played,
    knownVoids:Object.fromEntries(belief.voids.map((set,seat)=>[seat,[...set].sort()])),
    remainingBySuit,unseenToObserverBySuit,
    dangerousLocations:Object.fromEntries(dangerous.map(([suit,rank])=>[cardKey({suit,rank}),cardLocation(belief,suit,rank)]))
  };
}
