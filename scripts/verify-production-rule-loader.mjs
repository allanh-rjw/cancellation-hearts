import {readFileSync} from 'node:fs';

const access=readFileSync(new URL('../access-gate.js',import.meta.url),'utf8');
const rules=readFileSync(new URL('../gameplay-rule-invariants.js',import.meta.url),'utf8');
const opening=readFileSync(new URL('../gameplay-opening-enforcement.js',import.meta.url),'utf8');
const nextTrick=readFileSync(new URL('../gameplay-next-trick-flow.js',import.meta.url),'utf8');
const standardFixes=readFileSync(new URL('../gameplay-standard-fixes.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

function assert(ok,message){if(!ok)throw new Error(message);}

function scriptOrder(source){
  return [...source.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);
}

// The opening/legality/final-trick canonical authority and the coach-aware
// next-trick UI flow must be plain, static <script> tags that the browser
// loads deterministically in document order - never dynamically injected by
// an unrelated module (access-gate.js used to do this, racing against
// learning-gateway-runtime.js's own async playCard wrapper with no
// handshake between them; see the app-layer rebuild plan, Phase 1).
const order=scriptOrder(html);
const required=['app.js','gameplay-standard-fixes.js','gameplay-opponent-lookahead.js','gameplay-moon-fixes.js','gameplay-moon-calibration.js','gameplay-rule-invariants.js','gameplay-opening-enforcement.js','gameplay-next-trick-flow.js','learning-gateway-runtime.js','access-gate.js'];
let cursor=-1;
for(const name of required){
  const index=order.indexOf(name,cursor+1);
  assert(index>cursor,`index.html script order is wrong or missing an entry: expected ${name} after position ${cursor}, got order ${JSON.stringify(order)}`);
  cursor=index;
}
assert(/<div id="app" inert>/.test(html),'#app must start inert in the static markup so no interaction is possible before access-gate.js unlocks it');

// access-gate.js must be a pure access-verification module: it must never
// again load, wait on, or even reference the gameplay rule files by name -
// that was the mechanism that made the opening/play-legality race possible.
for(const forbidden of [
  'gameplay-rule-invariants.js','gameplay-opening-enforcement.js','gameplay-next-trick-flow.js',
  'loadRuleInvariants','loadOpeningEnforcement','loadNextTrickFlow','loadGameplayGuards',
  "document.createElement('script')"
])assert(!access.includes(forbidden),`access-gate.js must not reference gameplay loading again: ${forbidden}`);
// It must, however, fail loudly (not silently proceed) if the static load
// order was ever broken - this is the safety net for the fix above.
assert(access.includes('window.__cancellationHeartsRuleInvariants?.installed'),'access-gate.js no longer asserts gameplay rule modules are pre-installed');
assert(access.includes('window.__cancellationHeartsOpeningEnforcement?.installed'),'access-gate.js no longer asserts opening enforcement is pre-installed');
assert(access.includes('window.__cancellationHeartsNextTrickFlow?.installed'),'access-gate.js no longer asserts next-trick flow is pre-installed');

// startFirstTrick must have exactly one real (reachable) owner: app.js's
// original declaration, unconditionally overwritten by gameplay-rule-
// invariants.js. gameplay-standard-fixes.js must not reassign it again.
assert(!standardFixes.includes('startFirstTrick=function'),'gameplay-standard-fixes.js must not reassign startFirstTrick - gameplay-rule-invariants.js is the sole authority');

assert(access.includes('const CHECK_INTERVAL_MS=60*60_000;'),'silent access revalidation cadence changed unexpectedly');
assert(access.includes('const STALE_AFTER_MS=60*60_000;'),'focus/visibility staleness policy changed unexpectedly');
assert(access.includes("if(!hasAuthorizedSession||accessFailure(error))"),'active session no longer preserves access on transient revalidation failure');
for(const signature of [
  "function resolveOpeningLeader()",
  "if(twos.length!==2)",
  "state.openingLeaderSeat=seat;",
  "const openingLeader=()=>Number.isInteger(state.openingLeaderSeat)?state.openingLeaderSeat:firstTwoClubsHolderLeftOfDealer();",
  "function openingRoundFeasible()",
  "card.suit==='C'||card.suit==='D'||(card.suit==='S'&&card.rank!=='Q')",
  "state.openingLeaderSeat=null;",
  "const leader=resolveOpeningLeader();",
  "if(state.trick.length===0&&playerIndex!==openingLeader())return [];",
  "if(twoClubs.length)return twoClubs;",
  "return hand.filter(card=>!isPointCard(card)&&(card.suit==='D'||card.suit==='S'));",
  "if(playerIndex!==state.currentPlayer)return;",
  "if(isPointCard(card))return;",
  "if(state.players[playerIndex].hand.some(isTwoClubs)&&!isTwoClubs(card))return;",
  "const pair=highestCancellingPair(state.trick,led);",
  "state.currentTrickAward={winner:null,points:total,carried,finalCancellation:true,split:true,awards};"
])assert(rules.includes(signature),`canonical rule guard missing: ${signature}`);

for(const signature of [
  "const canonical=window.__cancellationHeartsRuleInvariants;",
  "typeof canonical.openingLeader!=='function'",
  "typeof canonical.resolveOpeningLeader!=='function'",
  "authority:'gameplay-rule-invariants'",
  "openingLeader:canonical.openingLeader",
  "legalCards:canonical.openingLegalCards"
])assert(opening.includes(signature),`opening integrity layer missing: ${signature}`);
for(const forbidden of [
  'legalCards=function',
  'startFirstTrick=function',
  'playCard=function'
])assert(!opening.includes(forbidden),`opening integrity layer is overriding gameplay again: ${forbidden}`);

for(const signature of [
  'const AUTO_ADVANCE_MS=3000;',
  "const coachOpen=()=>!coachPanel.classList.contains('hidden');",
  "if(coachOpen())showManualAdvance();",
  "else scheduleAutoAdvance();",
  "if(state.phase==='trick-end'&&state.trickNumber>previousTrickNumber&&state.trickNumber<13)syncTransition();"
])assert(nextTrick.includes(signature),`next-trick production guard missing: ${signature}`);

assert(!rules.includes("if(isPointCard(card)||card.suit==='S')return;"),'obsolete all-spades opening prohibition is still present');

console.log('production-rule-loader: gameplay-rule-invariants is the sole opening authority and loads before unlock; hourly silent revalidation remains fail-closed on real access loss');
