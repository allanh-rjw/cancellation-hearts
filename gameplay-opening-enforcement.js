// Opening-trick integrity layer.
// The canonical rule-invariant module is the sole authority for opening play.
(function installOpeningEnforcement(){
  if(window.__cancellationHeartsOpeningEnforcement?.installed)return;
  const canonical=window.__cancellationHeartsRuleInvariants;
  if(!canonical?.installed||
     typeof canonical.openingLeader!=='function'||
     typeof canonical.resolveOpeningLeader!=='function'||
     typeof canonical.openingLegalCards!=='function'){
    throw new Error('Canonical opening rules are unavailable.');
  }

  window.__cancellationHeartsOpeningEnforcement=Object.freeze({
    installed:true,
    authority:'gameplay-rule-invariants',
    openingLeader:canonical.openingLeader,
    legalCards:canonical.openingLegalCards
  });
})();
