// Empirical starting-hand calibration for Shoot-the-Moon practice.
// Strength labels are represented by progressively weaker control structures,
// not by hidden play-time probability bonuses. Two-player Ridiculous gives
// both shooters independent scoring routes and is held to the same monotonic
// calibration gate as the Solo ladder.

const baseDealPracticeRoundForCalibration=dealPracticeRound;
dealPracticeRound=function(){
  state.practiceSuccess=false;
  const deck=shuffle(makeDeck());
  const human=state.players[0].hand;
  const solo={
    ridiculous:[['C','A',2],['D','A',2],['S','A',2],['H','A',2],['H','K',2],['H','Q',2],['H','J',1]],
    strong:[['C','A',2],['C','K',1],['D','A',2],['D','K',1],['S','A',1],['S','K',1],['S','Q',1],['H','A',2],['H','K',1],['H','Q',1]],
    solid:[['C','A',2],['C','K',1],['D','A',2],['D','K',1],['S','A',1],['S','K',1],['S','Q',1],['H','A',1],['H','K',1],['H','Q',1],['H','J',1]],
    marginal:[['C','A',1],['C','K',1],['C','7',1],['D','A',1],['D','K',1],['D','8',1],['S','A',1],['S','Q',1],['S','5',1],['H','A',1],['H','K',1],['H','Q',1],['H','J',1]]
  };

  // Ridiculous two-player uses complementary protected controls. The human
  // owns hearts plus club kings and diamond aces. Partner owns club aces,
  // diamond kings/queens, and the protected A-K-Q spade chain (including both
  // Q♠). This supplies safe reversible control lanes instead of asking either
  // shooter to throw a low card and hope the table behaves.
  const twoHuman={
    ridiculous:[['H','A',2],['H','K',2],['H','Q',2],['H','J',2],['H','10',1],['C','K',2],['D','A',2]],
    strong:[['H','A',2],['H','K',1],['H','Q',1],['H','J',1],['H','10',1],['S','Q',1],['S','A',1],['S','K',1],['C','A',1],['C','K',1],['D','A',1],['D','K',1]],
    solid:[['H','A',1],['H','Q',1],['H','10',1],['H','8',1],['S','A',1],['S','K',1],['S','Q',1],['C','A',1],['C','K',1],['C','Q',1],['D','A',1],['D','K',1],['D','Q',1]],
    marginal:[['H','A',1],['H','Q',1],['H','8',1],['S','A',1],['S','Q',1],['S','7',1],['C','A',1],['C','9',1],['C','5',1],['D','K',1],['D','8',1],['D','4',1],['D','3',1]]
  };
  const twoPartner={
    ridiculous:[['S','A',2],['S','K',2],['S','Q',2],['C','A',2],['D','K',2],['D','Q',2],['H','7',1]],
    strong:[['C','A',1],['C','K',1],['C','Q',2],['D','A',1],['D','K',1],['D','Q',2],['S','A',1],['S','K',1],['S','Q',1],['H','K',1],['H','Q',1]],
    solid:[['H','K',1],['H','J',1],['H','9',1],['H','7',1],['S','A',1],['S','K',1],['S','Q',1],['C','A',1],['C','K',1],['C','J',1],['D','A',1],['D','K',1],['D','J',1]],
    marginal:[['H','K',1],['H','J',1],['H','7',1],['S','K',1],['S','Q',1],['S','6',1],['C','K',1],['C','10',1],['C','6',1],['D','A',1],['D','9',1],['D','5',1],['D','2',1]]
  };

  const strength=state.practiceStrength in solo?state.practiceStrength:'strong';
  addPattern(human,deck,(state.practiceType==='solo'?solo:twoHuman)[strength]);
  while(human.length<13&&deck.length) human.push(deck.pop());

  if(state.practiceType==='two'&&state.partnerIndex!=null){
    const partner=state.players[state.partnerIndex].hand;
    addPattern(partner,deck,twoPartner[strength]);
    while(partner.length<13&&deck.length) partner.push(deck.pop());
  }

  let cursor=1;
  while(deck.length){
    if(cursor===state.partnerIndex&&state.practiceType==='two'){cursor=cursor%7+1;continue;}
    if(state.players[cursor].hand.length<13) state.players[cursor].hand.push(deck.pop());
    cursor=cursor%7+1;
  }
};

// In two-player Ridiculous, teammate controls are not "outside" threats. Make
// the same pair-aware fact visible to both the card scorer and the QA forecast,
// so the coach does not secretly optimize against a different model than the
// explanation it presents.
const baseMoonLeadForecastForPairControl=moonLeadForecast;
moonLeadForecast=function(playerIndex,card){
  const forecast=baseMoonLeadForecastForPairControl(playerIndex,card);
  if(state.mode!=='practice'||state.practiceType!=='two'||state.practiceStrength!=='ridiculous'||state.partnerIndex==null) return forecast;
  const other=playerIndex===0?state.partnerIndex:0;
  if(other==null||other<0) return forecast;
  const teammate=state.players[other]?.hand||[];
  const seen=moonExposedCards();
  let pairHigher=0;
  for(const rank of RANKS){
    if(RANK_VALUE[rank]<=RANK_VALUE[card.rank]) continue;
    const own=state.players[playerIndex].hand.filter(c=>c.suit===card.suit&&c.rank===rank).length;
    const mate=teammate.filter(c=>c.suit===card.suit&&c.rank===rank).length;
    const exposed=seen.filter(c=>c.suit===card.suit&&c.rank===rank).length;
    pairHigher+=Math.max(0,2-own-mate-exposed);
  }
  if(forecast.higher>0&&pairHigher===0){
    // Base forecast penalized live higher cards that are actually protected in
    // Partner's hand. Replace that penalty with the normal "no higher outside"
    // reward used by the solo forecast.
    const oldHigherContribution=-Math.min(34,forecast.higher*5);
    forecast.score+=34-oldHigherContribution;
    forecast.higher=0;
    forecast.notes=forecast.notes.filter(n=>!n.includes('higher outside card'));
    forecast.notes.unshift('all higher cards are controlled by the shooting pair');
  }

  const ownPoints=state.players[playerIndex]?.roundPoints||0;
  const otherPoints=state.players[other]?.roundPoints||0;
  // Once the human has scored, both copies of C-K are a deliberately protected
  // bridge to Partner's two C-A cards. Reward this only when every higher club
  // is pair-controlled; there is no low-card gamble and no outsider can win.
  if(playerIndex===0&&ownPoints>0&&otherPoints===0&&card.suit==='C'&&card.rank==='K'&&pairHigher===0){
    forecast.score+=70;
    forecast.notes.unshift('protected club handoff establishes Partner control');
  }
  return forecast;
};

// A two-player moon requires both members of the pair to become actual
// collectors. Once one member has scored and the other has not, loaded tricks
// should preferentially establish the zero-point member.
const baseMoonShooterForecastForPairBalance=moonShooterForecast;
moonShooterForecast=function(playerIndex,card){
  const forecast=baseMoonShooterForecastForPairBalance(playerIndex,card);
  if(state.mode!=='practice'||state.practiceType!=='two'||state.trick.length===0) return forecast;
  const shooters=practiceShooters();
  if(!shooters.has(playerIndex)) return forecast;
  const other=playerIndex===0?state.partnerIndex:0;
  const ownPoints=state.players[playerIndex]?.roundPoints||0;
  const otherPoints=state.players[other]?.roundPoints||0;
  const projected=currentWinningPlayerIfPlayed(card,playerIndex);
  const loaded=state.carryoverPoints+state.trick.reduce((n,x)=>n+cardPoints(x.card),0)+cardPoints(card);
  if(loaded>0){
    if(ownPoints===0&&otherPoints>0){
      forecast.score+=(projected===playerIndex?90:-45);
      forecast.notes.push(projected===playerIndex?'establishes the second required scorer':'misses the chance to establish the second required scorer');
    }else if(otherPoints===0&&ownPoints>0){
      forecast.score+=(projected===other?80:projected===playerIndex?-50:0);
      forecast.notes.push(projected===other?'transfers a loaded trick to the zero-point partner':'the zero-point partner still needs a penalty trick');
    }
  }
  return forecast;
};

const baseEndBrokenPracticeForOutcome=endBrokenPractice;
endBrokenPractice=function(winner,points){
  state.practiceSuccess=false;
  return baseEndBrokenPracticeForOutcome(winner,points);
};
const baseFinishRoundForOutcome=finishRound;
finishRound=function(){
  if(state.mode==='practice'){
    const shooters=practiceShooters();
    const shooterPoints=[...shooters].reduce((n,i)=>n+(state.players[i]?.roundPoints||0),0);
    const outsiderPoints=state.players.reduce((n,p,i)=>n+(shooters.has(i)?0:p.roundPoints),0);
    state.practiceSuccess=state.practiceType==='solo'
      ? state.players[0].roundPoints===52&&outsiderPoints===0
      : outsiderPoints===0&&shooterPoints===52&&state.players[0].roundPoints>0&&state.players[state.partnerIndex].roundPoints>0;
  }
  return baseFinishRoundForOutcome();
};
