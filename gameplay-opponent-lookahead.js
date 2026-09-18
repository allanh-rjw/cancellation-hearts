// MULTI-TRICK OPPONENT LOOKAHEAD START
// Short-horizon Standard-game planner layered on Prompt 3's belief-aware policy.
// It may inspect only the acting CPU's hand plus observer-limited/public state.
const opponentLookaheadBaseChooseAiCard=chooseAiCard;
const opponentLookaheadClamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function opponentLookaheadDepth(){
  return state.difficulty==='expert'?2:state.difficulty==='hard'?1:0;
}
function opponentLookaheadScale(){
  return state.difficulty==='expert'?1:state.difficulty==='hard'?.65:0;
}
function opponentLookaheadRemainingHand(i,card){
  return state.players[i].hand.filter(candidate=>candidate.id!==card.id);
}
function opponentLookaheadExitCount(hand){
  return hand.filter(card=>card.suit!=='H'&&RANK_VALUE[card.rank]<=6).length;
}
function opponentLookaheadLeadCandidates(hand){
  if(state.heartsBroken)return hand;
  const nonHearts=hand.filter(card=>card.suit!=='H');
  return nonHearts.length?nonHearts:hand;
}
function opponentLookaheadControlBias(plan){
  return ({avoidance:-2.5,targeting:.5,cancellation:-.5,soloMoon:3.5,twoMoon:2.5})[plan?.strategy]??-1;
}
function opponentLookaheadOtherSeats(i,belief){
  return belief.handSizes.map((count,seat)=>({count,seat})).filter(x=>x.seat!==i&&x.count>0).map(x=>x.seat);
}
function opponentLookaheadLeadProjection(i,lead,belief,plan){
  const seats=opponentLookaheadOtherSeats(i,belief);
  const higher=beliefAwareHigherPressure(lead,belief,seats);
  const duplicate=beliefAwareProbabilityAtSeats(beliefAwareCardLocation(belief,lead.suit,lead.rank),seats);
  const release=1-(1-higher)*(1-duplicate);
  const control=1-release;
  const voidRate=seats.length?seats.filter(seat=>belief.voids[seat].has(lead.suit)).length/seats.length:0;
  const height=Math.max(0,(RANK_VALUE[lead.rank]-7)/7);
  const queen=beliefAwareProbabilityAtSeats(beliefAwareCardLocation(belief,'S','Q'),seats);
  const moon=['soloMoon','twoMoon'].includes(plan?.strategy);
  let utility=release*(moon?-1:1.8)+control*opponentLookaheadControlBias(plan)-height*voidRate*2.5;
  if(lead.suit==='S'&&['A','K'].includes(lead.rank))utility-=queen*(moon?1:4.5);
  if(cardPoints(lead)>0)utility+=moon?1.5:-2;
  return {utility,controlProbability:control,releaseProbability:release,voidRate};
}
function opponentLookaheadPath(i,hand,belief,plan,depth){
  if(depth<=0||!hand.length)return {score:0,lead:null};
  let best={score:-Infinity,lead:null};
  for(const lead of opponentLookaheadLeadCandidates(hand)){
    const projection=opponentLookaheadLeadProjection(i,lead,belief,plan);
    let score=projection.utility;
    if(depth>1&&projection.controlProbability>.2){
      const rest=hand.filter(card=>card.id!==lead.id);
      const next=opponentLookaheadPath(i,rest,belief,plan,depth-1);
      score+=projection.controlProbability*.45*next.score;
    }
    if(score>best.score)best={score,lead:lead.id,projection};
  }
  return best;
}
function opponentLookaheadInventoryScore(i,card,remaining,plan,winner){
  let score=Math.min(1.5,opponentLookaheadExitCount(remaining)*.3);
  if(plan?.voidCandidate&&card.suit===plan.voidCandidate){
    const left=remaining.filter(x=>x.suit===plan.voidCandidate).length;
    score+=left===0?2:left===1?.8:0;
  }
  if(card.suit==='S'&&['A','K'].includes(card.rank)&&winner!==i)score+=2.5;
  score-=remaining.filter(x=>x.suit==='S'&&['A','K'].includes(x.rank)).length*.35;
  return score;
}

function opponentLookaheadPassDisciplineWeight(){
  if(state.passOffset===4)return 1.5;
  if(state.passOffset===-3)return 1.3;
  if(state.passOffset===0)return 1.35;
  return .65;
}
function opponentLookaheadDisciplineAdjustment(i,card,plan,winner){
  if(window.__opponentLookahead?.prompt5Enabled===false)return 0;
  const legal=legalCards(i);
  if(legal.length<2||['soloMoon','twoMoon'].includes(plan?.strategy))return 0;
  const weight=opponentLookaheadPassDisciplineWeight();
  const loaded=state.carryoverPoints+state.trick.reduce((sum,play)=>sum+cardPoints(play.card),0)+cardPoints(card)>0;
  let score=0;
  if(!loaded&&winner===i&&legal.some(candidate=>candidate.id!==card.id&&beliefAwareProjectedWinner(i,candidate)!==i)){
    const strategyWeight=plan?.strategy==='avoidance'?1:plan?.strategy==='targeting'?.7:.5;
    score-=2*weight*strategyWeight;
  }
  if(winner!==i&&cardPoints(card)===0){
    const safe=legal.filter(candidate=>beliefAwareProjectedWinner(i,candidate)!==i);
    const highestSafe=safe.reduce((best,candidate)=>RANK_VALUE[candidate.rank]>RANK_VALUE[best.rank]?candidate:best,safe[0]);
    if(highestSafe&&highestSafe.id===card.id&&safe.some(candidate=>RANK_VALUE[candidate.rank]<=6&&RANK_VALUE[candidate.rank]<RANK_VALUE[card.rank])){
      score+=1.25*weight*(plan?.phase==='exit'?1.2:1);
    }
  }
  return opponentLookaheadClamp(score,-3.5,2.5);
}

function opponentLookaheadDecision(i,card,belief,plan){
  const scale=opponentLookaheadScale(),depth=opponentLookaheadDepth();
  if(!scale||!depth||state.mode!=='standard')return {score:0,nextLead:null,retainControl:0};
  const remaining=opponentLookaheadRemainingHand(i,card);
  if(!remaining.length)return {score:0,nextLead:null,retainControl:0};
  const future=beliefAwareFutureSeats(i,belief);
  const winner=beliefAwareProjectedWinner(i,card);
  let score=opponentLookaheadInventoryScore(i,card,remaining,plan,winner),retainControl=0,nextLead=null;
  if(winner===i){
    const higher=beliefAwareHigherPressure(card,belief,future);
    const duplicate=beliefAwareProbabilityAtSeats(beliefAwareCardLocation(belief,card.suit,card.rank),future);
    const release=1-(1-higher)*(1-duplicate);
    retainControl=1-release;
    const path=opponentLookaheadPath(i,remaining,belief,plan,depth);
    nextLead=path.lead;
    const moon=['soloMoon','twoMoon'].includes(plan?.strategy);
    score+=(moon?-1:1.2)*release+retainControl*(path.score+opponentLookaheadControlBias(plan)*.6);
    if(plan?.strategy==='avoidance')score+=release*1.2-retainControl*.8;
    if(moon)score+=retainControl*1.5;
  }else{
    score+=Math.min(1.2,opponentLookaheadExitCount(remaining)*.2);
  }
  const discipline=opponentLookaheadDisciplineAdjustment(i,card,plan,winner)*scale;
  return {score:opponentLookaheadClamp(score*scale+discipline,-7,7),nextLead,retainControl,discipline};
}

const opponentLookaheadControl=window.__opponentLookahead??{};
Object.assign(opponentLookaheadControl,{
  enabled:opponentLookaheadControl.enabled!==false,
  prompt5Enabled:opponentLookaheadControl.prompt5Enabled!==false,
  depth:opponentLookaheadDepth,
  lastDecision:null,
  scoreCard:(seat,card)=>opponentLookaheadDecision(seat,card,beliefAwareObservedState(seat),opponentStrategyPlan(seat))
});
window.__opponentLookahead=opponentLookaheadControl;

chooseAiCard=function(i){
  if(!opponentLookaheadControl.enabled||state.mode!=='standard'||opponentLookaheadDepth()===0)return opponentLookaheadBaseChooseAiCard(i);
  const legal=legalCards(i),player=state.players[i],profile=difficultyProfile(),plan=opponentStrategyPlan(i),belief=beliefAwareObservedState(i);
  const ranked=legal.map(card=>{
    const base=evaluateCard(i,card,player.persona)+practiceDefenseAdjustment(i,card)+standardTacticalAdjustment(i,card)+opponentStrategyAdjustment(i,card,plan)+opponentPathwayAdjustment(i,card,plan)+futureHandScore(i,card)+scoreAwareAdjustment(i,card)+advancedInferenceAdjustment(i,card);
    const beliefScore=beliefAwareDecisionAdjustment(i,card,belief);
    const lookahead=opponentLookaheadDecision(i,card,belief,plan);
    return {c:card,s:base+beliefScore+lookahead.score,base,belief:beliefScore,lookahead:lookahead.score,discipline:lookahead.discipline??0,nextLead:lookahead.nextLead,retainControl:lookahead.retainControl};
  }).sort((a,b)=>b.s-a.s);
  let chosen,reason='lookahead-top-ranked';
  if(profile.blunder&&Math.random()<profile.blunder){chosen=ranked[Math.min(1,ranked.length-1)].c;reason='lookahead-difficulty-blunder';}
  else if(ranked.length>1&&ranked[0].s-ranked[1].s<profile.noise&&Math.random()<.22){chosen=ranked[1].c;reason='lookahead-close-score-noise';}
  else chosen=ranked[0].c;
  const decision={seat:i,reason,chosen:chosen.id,depth:opponentLookaheadDepth(),ranked:ranked.map(x=>({id:x.c.id,base:x.base,belief:x.belief,lookahead:x.lookahead,discipline:x.discipline,total:x.s,nextLead:x.nextLead,retainControl:x.retainControl}))};
  opponentLookaheadControl.lastDecision=decision;
  beliefAwareControl.lastDecision=decision;
  traceOpponentDecision(i,legal,ranked,chosen,reason,plan);
  return chosen;
};
// MULTI-TRICK OPPONENT LOOKAHEAD END
