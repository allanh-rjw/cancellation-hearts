import {readFileSync} from 'node:fs';

const access=readFileSync(new URL('../access-gate.js',import.meta.url),'utf8');
const rules=readFileSync(new URL('../gameplay-rule-invariants.js',import.meta.url),'utf8');

function assert(ok,message){if(!ok)throw new Error(message);}

assert(access.includes("gameplay-rule-invariants.js?v=20260918-rules1"),'access gate no longer loads canonical rule invariant layer');
assert(access.includes("await loadRuleInvariants();\n        unlock();"),'app can unlock before rule invariants load');
for(const signature of [
  "if(seatAlreadyPlayed(playerIndex))return [];",
  "if(state.trick.length===0&&playerIndex!==openingLeader())return [];",
  "if(twoClubs.length)return twoClubs;",
  "return hand.filter(card=>card.suit==='D'&&!isPointCard(card));",
  "if(playerIndex!==state.currentPlayer)return;",
  "if(isPointCard(card)||card.suit==='S')return;",
  "if(state.players[playerIndex].hand.some(isTwoClubs)&&!isTwoClubs(card))return;",
  "const pair=highestCancellingPair(state.trick,led);",
  "state.currentTrickAward={winner:null,points:total,carried,finalCancellation:true,split:true,awards};"
])assert(rules.includes(signature),`canonical rule guard missing: ${signature}`);

console.log('production-rule-loader: canonical invariant layer loads before access unlock');
