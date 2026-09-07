(function installCancellationHeartsGameStateAdapter(global){
  'use strict';

  const penalty=card=>card.suit==='H'?1:(card.suit==='S'&&card.rank==='Q'?13:0);
  const cardId=card=>`card:${card.id}`;
  const publicCard=card=>({cardId:cardId(card),rank:card.rank,suit:card.suit,copyId:card.copy});

  function mode(){
    if(state.mode!=='practice') return 'standard';
    return state.practiceType==='two'?'two-player-moon-practice':'solo-moon-practice';
  }

  function practiceMode(){
    if(state.mode!=='practice') return 'none';
    return state.practiceType==='two'?'two-player-moon':'solo-moon';
  }

  function roleFor(seat){
    if(seat===0) return 'human';
    if(state.mode==='practice'&&seat===state.partnerIndex) return 'partner';
    return 'cpu';
  }

  function visibleCard(card,seat){
    let playable=false;
    if(state.phase==='playing'&&state.currentPlayer===seat){
      try{ playable=legalCards(seat).some(candidate=>candidate.id===card.id); }catch(_error){}
    }
    const passEligible=state.phase==='passing'&&seat===0;
    return {
      ...publicCard(card), playable, passEligible,
      selected:seat===0&&state.selected?.has(card.id)===true,
      ...(playable||passEligible?{}:{disabledReason:state.phase==='playing'?'Not legal or not this seat\'s turn':'Not available in the current phase'})
    };
  }

  function currentWinnerSeat(){
    if(!state.trick?.length) return null;
    const led=typeof currentLedSuit==='function'?currentLedSuit():state.openingLeadSuit;
    if(!led) return null;
    const eligible=state.trick.filter(play=>play.card.suit===led&&!play.cancelled);
    if(!eligible.length) return null;
    return eligible.reduce((best,play)=>RANK_VALUE[play.card.rank]>RANK_VALUE[best.card.rank]?play:best).player;
  }

  function publicActions(){
    const actions=Array.isArray(state.actionLog)?state.actionLog:[];
    const seen=new Set();
    const result=[];
    for(const action of actions){
      const key=cardId(action.card); if(seen.has(key)) continue; seen.add(key);
      result.push({...publicCard(action.card),seatIndex:action.player});
    }
    for(const play of state.trick||[]){
      const key=cardId(play.card); if(seen.has(key)) continue; seen.add(key);
      result.push({...publicCard(play.card),seatIndex:play.player});
    }
    if(state.trickNumber>0){
      for(const copyId of [0,1]){
        const key=`opening-2C:${copyId}`;
        if(!seen.has(key)) result.push({cardId:key,rank:'2',suit:'C',copyId,seatIndex:-1});
      }
    }
    return result;
  }

  function knownVoids(){
    const bySeat=new Map();
    const byTrick=new Map();
    for(const action of state.actionLog||[]){
      if(!byTrick.has(action.trick)) byTrick.set(action.trick,[]);
      byTrick.get(action.trick).push(action);
    }
    for(const actions of byTrick.values()){
      if(!actions.length) continue;
      const led=actions[0].card.suit;
      for(const action of actions.slice(1)) if(action.card.suit!==led){
        const suits=bySeat.get(action.player)||new Set(); suits.add(led); bySeat.set(action.player,suits);
      }
    }
    return [...bySeat.entries()].map(([seatIndex,suits])=>({seatIndex,suits:[...suits]}));
  }

  function duplicateObservations(played){
    const counts=new Map();
    for(const card of played){
      if(card.seatIndex<0&&card.rank==='2'&&card.suit==='C'){
        counts.set('2C',2); continue;
      }
      const key=`${card.rank}${card.suit}`;
      counts.set(key,Math.min(2,(counts.get(key)||0)+1));
    }
    return [...counts.entries()].filter(([,copiesObserved])=>copiesObserved>0).map(([key,copiesObserved])=>({
      rank:key.slice(0,-1),suit:key.slice(-1),copiesObserved
    }));
  }

  function scoreIncentives(){
    if(!state.players?.length) return [];
    const low=Math.min(...state.players.map(player=>player.score));
    return state.players.map((player,seatIndex)=>({
      seatIndex,
      description:player.score===low?'Currently tied for the lowest game score; protect the finish position.':`Trailing the lowest score by ${player.score-low}; avoid helping a rival end the game favorably.`
    }));
  }

  function opponentEvidence(){
    const output=[];
    for(const [name,actions] of Object.entries(state.opponentHistory||{})){
      const seatIndex=state.players.findIndex(player=>player.name===name);
      if(seatIndex<0) continue;
      for(const action of actions||[]){
        output.push({seatIndex,handNumber:action.round||state.round,observation:`Played ${action.card.rank}${action.card.suit} on trick ${action.trick}.`});
      }
    }
    return output;
  }

  function pivotHistory(){
    return (state.strategyPivots||[]).map(pivot=>({
      from:pivot.from||state.originalStrategy||'point-avoidance',
      to:pivot.to||pivot.strategy||state.coachStrategy||'point-avoidance',
      reason:pivot.reason||'Strategy changed from public game evidence.',
      handNumber:state.round
    }));
  }

  function adapt(seat=0){
    if(!state.players?.length) throw new Error('Cannot adapt Cancellation Hearts state before a game exists.');
    const hand=state.players[seat]?.hand||[];
    const played=publicActions();
    const led=typeof currentLedSuit==='function'?currentLedSuit():null;
    const currentWinner=currentWinnerSeat();
    const trickPoints=(state.trick||[]).reduce((sum,play)=>sum+penalty(play.card),0);
    const players=state.players.map((player,seatIndex)=>({
      seatIndex,label:player.name,role:roleFor(seatIndex),visibleHandCardCount:player.hand.length,
      handScore:player.roundPoints||0,gameScore:player.score||0,dealer:seatIndex===state.dealer,
      activeTurn:state.phase==='playing'&&seatIndex===state.currentPlayer,
      ...(state.showPersonas&&seatIndex!==0?{persona:{label:player.persona,public:true}}:{})
    }));
    return {
      schemaVersion:1,
      game:{mode:mode(),targetScore:state.target,handNumber:state.round,dealerSeat:state.dealer,leaderSeat:state.leader,activeSeat:state.currentPlayer,playDirection:'clockwise',gameComplete:!!state.gameOver},
      players,learnerSeat:seat,learnerHand:hand.map(card=>visibleCard(card,seat)),
      trick:{
        plays:(state.trick||[]).map((play,order)=>({order,seatIndex:play.player,card:publicCard(play.card),cancelled:!!play.cancelled,eligible:!!led&&play.card.suit===led&&!play.cancelled,...(play.prelaid?{prelaid:true}:{})})),
        ledSuit:led||null,currentWinnerSeat:currentWinner,noWinner:!!led&&(state.trick||[]).length>0&&currentWinner===null,
        trickPoints,carryoverPoints:state.carryoverPoints||0
      },
      publicHistory:{playedCards:played,knownVoids:knownVoids(),heartsBroken:!!state.heartsBroken,duplicateObservations:duplicateObservations(played),scoreIncentives:scoreIncentives()},
      strategyContext:{selectedStrategy:state.coachStrategy||null,originalStrategy:state.originalStrategy||null,pivotHistory:pivotHistory(),practiceMode:practiceMode(),opponentEvidence:opponentEvidence()}
    };
  }

  global.CancellationHeartsGameStateAdapter=Object.freeze({adapt,cardId,publicCard});
})(window);
