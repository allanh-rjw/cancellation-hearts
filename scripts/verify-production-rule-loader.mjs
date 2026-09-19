import {readFileSync} from 'node:fs';

const access=readFileSync(new URL('../access-gate.js',import.meta.url),'utf8');
const rules=readFileSync(new URL('../gameplay-rule-invariants.js',import.meta.url),'utf8');
const nextTrick=readFileSync(new URL('../gameplay-next-trick-flow.js',import.meta.url),'utf8');

function assert(ok,message){if(!ok)throw new Error(message);}

assert(access.includes("gameplay-rule-invariants.js?v=20260918-rules1"),'access gate no longer loads canonical rule invariant layer');
assert(access.includes("gameplay-next-trick-flow.js?v=20260918-nexttrick1"),'access gate no longer loads next-trick flow layer');
assert(access.includes("await loadRuleInvariants();\n    await loadNextTrickFlow();"),'gameplay guards do not load in the required order');
assert(access.includes("await loadGameplayGuards();\n        unlock();"),'app can unlock before gameplay guards load');
for(const signature of [
  "function openingRoundFeasible()",
  "card.suit==='C'||card.suit==='D'||(card.suit==='S'&&card.rank!=='Q')",
  "if(!openingRoundFeasible())",
  "setTimeout(beginRound,0);",
  "if(seatAlreadyPlayed(playerIndex))return [];",
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
  'const AUTO_ADVANCE_MS=3000;',
  "const coachOpen=()=>!coachPanel.classList.contains('hidden');",
  "if(coachOpen())showManualAdvance();",
  "else scheduleAutoAdvance();",
  "if(state.phase==='trick-end'&&state.trickNumber>previousTrickNumber&&state.trickNumber<13)syncTransition();"
])assert(nextTrick.includes(signature),`next-trick production guard missing: ${signature}`);

assert(!rules.includes("if(isPointCard(card)||card.suit==='S')return;"),'obsolete all-spades opening prohibition is still present');

console.log('production-rule-loader: gameplay invariants and coach-aware next-trick flow load before access unlock');
