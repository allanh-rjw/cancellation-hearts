// Shoot-the-Moon practice repair layer.
// Adds bounded control forecasting for shooter decisions while preserving the
// standard-game engine and existing defender/persona logic.

function moonExposedCards(){
  return [...state.actionLog.map(a=>a.card),...state.trick.map(x=>x.card)];
}
function moonOutsideCount(playerIndex,suit,rank){
  const own=state.players[playerIndex].hand.filter(c=>c.suit===suit&&c.rank===rank).length;
  const seen=moonExposedCards().filter(c=>c.suit===suit&&c.rank===rank).length;
  return Math.max(0,2-own-seen);
}
function moonHigherOutside(playerIndex,card){
  let count=0;
  for(const rank of RANKS){
    if(RANK_VALUE[rank]<=RANK_VALUE[card.rank]) continue;
    count+=moonOutsideCount(playerIndex,card.suit,rank);
  }
  return count;
}
function moonControlDepth(playerIndex,suit){
  const hand=state.players[playerIndex].hand.filter(c=>c.suit===suit).sort((a,b)=>RANK_VALUE[b.rank]-RANK_VALUE[a.rank]);
  let depth=0;
  for(const card of hand){
    const higher=moonHigherOutside(playerIndex,card);
    const twin=moonOutsideCount(playerIndex,card.suit,card.rank);
    if(higher===0&&twin===0) depth++;
    else break;
  }
  return depth;
}
function moonLeadForecast(playerIndex,card){
  const higher=moonHigherOutside(playerIndex,card);
  const twin=moonOutsideCount(playerIndex,card.suit,card.rank);
  const depth=moonControlDepth(playerIndex,card.suit);
  const suit=state.players[playerIndex].hand.filter(c=>c.suit===card.suit);
  const higherOwn=suit.filter(c=>RANK_VALUE[c.rank]>RANK_VALUE[card.rank]).length;
  const rank=RANK_VALUE[card.rank];
  let score=0;
  const notes=[];

  if(higher===0){score+=34;notes.push('no higher outside card remains live');}
  else {score-=Math.min(34,higher*5);notes.push(`${higher} higher outside card${higher===1?' is':'s are'} still live`);}
  if(twin===0){score+=18;notes.push('the matching copy cannot cancel externally');}
  else {score-=18*twin;notes.push('an external matching copy can cancel this lead');}
  score+=Math.min(24,depth*8);
  if(depth>=2) notes.push(`${depth} protected top controls remain in the suit`);
  if(rank>=12) score+=10;
  if(rank<=7&&higherOwn>0){score-=28;notes.push('a stronger card in this suit can test control without surrendering it cheaply');}
  if(card.suit==='S'&&card.rank==='Q'&&twin>0){score-=45;notes.push('the other queen can cancel and promote an outside spade');}
  if(card.suit==='H'){
    if(!state.heartsBroken) score-=45;
    if(higher===0&&twin===0) score+=18;
    else score-=12;
  }
  return {score,higher,twin,depth,notes};
}
function moonShooterForecast(playerIndex,card){
  const shooters=practiceShooters();
  const following=state.trick.length>0;
  if(!following) return moonLeadForecast(playerIndex,card);
  const projected=currentWinningPlayerIfPlayed(card,playerIndex);
  const points=state.carryoverPoints+state.trick.reduce((n,x)=>n+cardPoints(x.card),0)+cardPoints(card);
  let score=0;
  const notes=[];
  if(shooters.has(projected)){
    score+=points>0?55:18;
    notes.push(points>0?'keeps the loaded trick inside the shooting side':'keeps control inside the shooting side');
  }else{
    score-=points>0?100:18;
    notes.push(points>0?'would send penalty points outside the shooting side':'temporarily gives control to a defender');
  }
  if(projected===playerIndex) score+=10;
  return {score,projected,points,notes};
}

const baseMoonCardDecisionScores=cardDecisionScores;
cardDecisionScores=function(card){
  const base=baseMoonCardDecisionScores(card);
  if(state.mode!=='practice'||(state.coachStrategy!=='soloMoon'&&state.coachStrategy!=='twoMoon')) return base;
  const forecast=moonShooterForecast(0,card);
  const following=state.trick.length>0;
  if(!following){
    // Lead evaluation must not treat the human as an automatic winner merely
    // because opponents have not responded yet. Rebuild the lead factors from
    // bounded control evidence instead of the one-card simulation result.
    base.board=clamp(50+forecast.score*.72);
    base.strategy=clamp(52+forecast.score);
    base.score=clamp(50+forecast.score*.35);
  }else{
    base.board=clamp(base.board+forecast.score*.45);
    base.strategy=clamp(base.strategy+forecast.score*.7);
    base.score=clamp(base.score+forecast.score*.25);
  }
  base.moonForecast=forecast;
  return base;
};

const baseMoonRecommendationReason=recommendationReason;
recommendationReason=function(card,f){
  const reason=baseMoonRecommendationReason(card,f);
  if(state.mode!=='practice'||!f?.moonForecast) return reason;
  const evidence=f.moonForecast.notes?.slice(0,2).join('; ');
  if(!evidence) return reason;
  return `${reason.replace(/\.$/,'')}; control forecast: ${evidence}.`;
};

const basePracticeDefenseAdjustment=practiceDefenseAdjustment;
practiceDefenseAdjustment=function(i,c){
  const base=basePracticeDefenseAdjustment(i,c);
  if(state.mode!=='practice'||state.practiceType!=='two'||i!==state.partnerIndex) return base;
  const forecast=moonShooterForecast(i,c);
  // Partner cooperation is strongest when the current trick is loaded. On a
  // lead, prefer protected control chains rather than generic low-card exits.
  const scale=state.trick.length?1.15:1.35;
  return base+forecast.score*scale;
};

const baseFinishRoundForMoonPractice=finishRound;
finishRound=function(){
  if(state.mode!=='practice') return baseFinishRoundForMoonPractice();

  const shooters=practiceShooters();
  const shooterPoints=[...shooters].reduce((n,i)=>n+(state.players[i]?.roundPoints||0),0);
  const outsiderPoints=state.players.reduce((n,p,i)=>n+(shooters.has(i)?0:p.roundPoints),0);
  const soloSuccess=state.practiceType==='solo'&&state.players[0].roundPoints===52&&outsiderPoints===0;
  const twoSuccess=state.practiceType==='two'&&outsiderPoints===0&&shooterPoints===52&&state.players[0].roundPoints>0&&state.players[state.partnerIndex].roundPoints>0;
  const success=soloSuccess||twoSuccess;

  let msg;
  if(soloSuccess){
    state.players.forEach((p,i)=>{if(i!==0)p.score+=104;});
    msg='You completed the solo moon. Every other player receives 104.';
  }else if(twoSuccess){
    state.players.forEach((p,i)=>{if(!shooters.has(i))p.score+=26;});
    msg=`You and Partner completed the two-player moon. Every other player receives 26.`;
  }else{
    // Preserve actual Hearts scoring for the unusual case where the hand
    // reaches trick 13 without an outside penalty capture but misses the
    // selected practice objective (for example, one member of a two-player
    // pair captured all 52 points alone).
    const scorers=state.players.map((p,i)=>({i,pts:p.roundPoints})).filter(x=>x.pts>0);
    if(scorers.length===1&&scorers[0].pts===52){
      state.players.forEach((p,i)=>{if(i!==scorers[0].i)p.score+=104;});
    }else if(scorers.length===2&&scorers.reduce((n,x)=>n+x.pts,0)===52){
      const ids=new Set(scorers.map(x=>x.i));
      state.players.forEach((p,i)=>{if(!ids.has(i))p.score+=26;});
    }else state.players.forEach(p=>p.score+=p.roundPoints);
    msg=`Practice hand completed, but the ${state.practiceType==='solo'?'solo':'two-player'} moon objective was not achieved.`;
  }

  const priorTotals=state.scoreHistory.reduce((totals,h)=>{
    state.players.forEach((p,i)=>{totals[i]+=(h[p.name]||0);});
    return totals;
  },state.players.map(()=>0));
  const handRecord={};
  state.players.forEach((p,i)=>{handRecord[p.name]=p.score-priorTotals[i];});
  state.scoreHistory.push(handRecord);
  state.practiceEnded=true;
  state.gameOver=true;
  state.phase='practice-end';
  $('nextTrickBtn').classList.add('hidden');
  $('nextRoundBtn').classList.add('hidden');
  state.lastPostAnalysis=buildPostGameAnalysis(msg);
  state.handAnalysisHistory.push({...state.lastPostAnalysis,decisions:state.humanDecisionLog.map(x=>({...x})),pivots:[]});
  renderPostHandAnalysis();renderPostGameAnalysis();renderOpponentAnalysis();renderScoreDialog();renderAll();
  setStatus(success?`${msg} Practice complete.`:msg);
};
