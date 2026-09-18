const SUITS=['C','D','S','H'];
const cardKey=card=>`${card.suit}${card.rank}`;
const cloneCard=card=>({id:card.id,suit:card.suit,rank:card.rank});

export function createBelief({observerSeat,ownHand,playerCount=8}){
  return {
    observerSeat,playerCount,
    ownCards:new Map(ownHand.map(card=>[card.id,cloneCard(card)])),
    played:new Map(),knownHolders:new Map(),voids:Array.from({length:playerCount},()=>new Set()),
    handSizes:Array(playerCount).fill(13),passEvidence:{outgoing:[],incoming:[]}
  };
}

export function recordPass(belief,{outgoing=[],incoming=[],recipientSeat,sourceSeat}){
  for(const card of outgoing){
    const copy=cloneCard(card);
    belief.ownCards.delete(card.id);
    belief.knownHolders.set(card.id,{seat:recipientSeat,card:copy,source:'passed'});
    belief.passEvidence.outgoing.push({seat:recipientSeat,card:copy});
  }
  for(const card of incoming){
    const copy=cloneCard(card);
    belief.ownCards.set(card.id,copy);
    belief.knownHolders.delete(card.id);
    belief.passEvidence.incoming.push({seat:sourceSeat,card:copy});
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

function probabilityView(belief,possibleSeats,unknownCopies){
  if(!unknownCopies||!possibleSeats.length)return {seatProbabilities:{},expectedCopiesBySeat:{}};
  const capacity=possibleSeats.reduce((sum,seat)=>sum+belief.handSizes[seat],0);
  const denominator=capacity||possibleSeats.length;
  const seatProbabilities=Object.fromEntries(possibleSeats.map(seat=>[
    seat,(capacity?belief.handSizes[seat]:1)/denominator
  ]));
  const expectedCopiesBySeat=Object.fromEntries(possibleSeats.map(seat=>[
    seat,seatProbabilities[seat]*unknownCopies
  ]));
  return {seatProbabilities,expectedCopiesBySeat};
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
    knownHolders:known.map(x=>x.seat),unknownCopies,possibleSeats,
    ...probabilityView(belief,possibleSeats,unknownCopies)
  };
}

export function locationDiagnostic(location,trueUnknownHolderSeats=[]){
  if(trueUnknownHolderSeats.length!==location.unknownCopies){
    throw new Error(`truth count ${trueUnknownHolderSeats.length} != unknown copies ${location.unknownCopies}`);
  }
  const probabilities=Object.values(location.seatProbabilities);
  const expected=Object.values(location.expectedCopiesBySeat);
  const truthMass=trueUnknownHolderSeats.map(seat=>location.seatProbabilities[seat]??0);
  return {
    probabilitySum:probabilities.reduce((sum,value)=>sum+value,0),
    expectedCopySum:expected.reduce((sum,value)=>sum+value,0),
    meanTrueSeatProbability:truthMass.length?truthMass.reduce((sum,value)=>sum+value,0)/truthMass.length:null,
    impossibleTruthCount:truthMass.filter(value=>value===0).length
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
    observerSeat:belief.observerSeat,ownCards:own,played,passEvidence:belief.passEvidence,
    knownVoids:Object.fromEntries(belief.voids.map((set,seat)=>[seat,[...set].sort()])),
    remainingBySuit,unseenToObserverBySuit,
    dangerousLocations:Object.fromEntries(dangerous.map(([suit,rank])=>[cardKey({suit,rank}),cardLocation(belief,suit,rank)]))
  };
}
