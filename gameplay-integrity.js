(()=>{
  const originalStartFirstTrick=startFirstTrick;
  startFirstTrick=function(){
    // The opening rule requires both 2♣ cards to be prelaid while preserving
    // one-card-per-seat trick progression. If passing leaves both copies in
    // one hand, normalize the copies across seats before the opening begins.
    ensureTwoClubsSeparated();
    state.players.forEach(player=>sortHand(player.hand));
    return originalStartFirstTrick();
  };
})();
