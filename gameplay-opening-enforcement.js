// Final opening-trick enforcement layer.
// Delegates legality to the canonical rule invariant module, then installs last
// so older gameplay compatibility layers cannot bypass opening rules.
(function installOpeningEnforcement(){
  if(window.__cancellationHeartsOpeningEnforcement?.installed)return;
  const canonical=window.__cancellationHeartsRuleInvariants;
  if(!canonical?.installed||typeof canonical.openingLegalCards!=='function'){
    throw new Error('Canonical opening rules are unavailable.');
  }

  const canonicalLegalCards=canonical.openingLegalCards;
  const previousLegalCards=legalCards;
  legalCards=function(playerIndex){
    if(state.trickNumber===0)return canonicalLegalCards(playerIndex);
    return previousLegalCards(playerIndex);
  };

  const previousStartFirstTrick=startFirstTrick;
  startFirstTrick=function(){
    const required=firstTwoClubsHolderLeftOfDealer();
    previousStartFirstTrick();
    if(state.phase==='playing'&&state.trickNumber===0&&state.trick.length===0){
      if(state.leader!==required||state.currentPlayer!==required){
        throw new Error('Opening leader invariant violated.');
      }
    }
  };

  const previousPlayCard=playCard;
  playCard=function(playerIndex,card){
    if(state.trickNumber===0){
      if(state.phase!=='playing'||playerIndex!==state.currentPlayer)return;
      const legal=canonicalLegalCards(playerIndex);
      if(!card||!legal.some(candidate=>candidate.id===card.id))return;
    }
    return previousPlayCard(playerIndex,card);
  };

  window.__cancellationHeartsOpeningEnforcement=Object.freeze({
    installed:true,
    legalCards:canonicalLegalCards
  });
})();
