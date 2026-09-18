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
  return {score:opponentLookaheadClamp(score*scale,-7,7),nextLead,retainControl};
}

const opponentLookaheadControl=window.__opponentLookahead??{};
Object.assign(opponentLookaheadControl,{
  enabled:opponentLookaheadControl.enabled!==false,
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
    return {c:card,s:base+beliefScore+lookahead.score,base,belief:beliefScore,lookahead:lookahead.score,nextLead:lookahead.nextLead,retainControl:lookahead.retainControl};
  }).sort((a,b)=>b.s-a.s);
  let chosen,reason='lookahead-top-ranked';
  if(profile.blunder&&Math.random()<profile.blunder){chosen=ranked[Math.min(1,ranked.length-1)].c;reason='lookahead-difficulty-blunder';}
  else if(ranked.length>1&&ranked[0].s-ranked[1].s<profile.noise&&Math.random()<.22){chosen=ranked[1].c;reason='lookahead-close-score-noise';}
  else chosen=ranked[0].c;
  const decision={seat:i,reason,chosen:chosen.id,depth:opponentLookaheadDepth(),ranked:ranked.map(x=>({id:x.c.id,base:x.base,belief:x.belief,lookahead:x.lookahead,total:x.s,nextLead:x.nextLead,retainControl:x.retainControl}))};
  opponentLookaheadControl.lastDecision=decision;
  beliefAwareControl.lastDecision=decision;
  traceOpponentDecision(i,legal,ranked,chosen,reason,plan);
  return chosen;
};
// MULTI-TRICK OPPONENT LOOKAHEAD END
