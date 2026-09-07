import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const loader=read('causal-loader.js');
const client=read('domain-pack-client.js');
const adapter=read('game-state-adapter.js');
const integration=read('domain-pack-integration.js');
const css=read('domain-pack-integration.css');
const app=read('app.js');

const operations=[
  'assessHand','recommendStrategy','compareStrategies','recommendPass','recommendPlay','detectPivot',
  'analyzeOpponent','analyzeGameState','evaluateDecision','analyzePostHand','analyzePostGame',
  'generateCounterfactual','generateActivity','getInstructionalAnnotations'
];

for(const operation of operations) assert(client.includes(`'${operation}'`)||client.includes(`"${operation}"`),`Domain Pack client must expose ${operation}`);
assert(client.includes('/v1/domains/cancellation-hearts'),'client must have one canonical domain endpoint');

for(const file of ['domain-pack-client.js','game-state-adapter.js','domain-pack-integration.js','domain-pack-integration.css']){
  assert(loader.includes(file),`production loader must load ${file}`);
}
for(const retired of ['hearts-tutor.js','hearts-tutor-adapter.js','hearts-feedback-diagnosis.js','hearts-advanced-reasoning.js','hearts-passing-reasoning.js','adaptive-trainer/','causal/patch','eval(']){
  assert(!loader.includes(retired),`production loader must not invoke retired trainer path: ${retired}`);
}
assert(loader.includes('__legacyCancellationHeartsTrainerProductionEnabled=false'),'legacy trainer must be explicitly disabled in production');

for(const field of ['schemaVersion:1','learnerHand','knownVoids','heartsBroken','duplicateObservations','scoreIncentives','selectedStrategy','originalStrategy','pivotHistory','opponentEvidence']){
  assert(adapter.includes(field),`learner-visible adapter missing ${field}`);
}
for(const forbidden of ['hiddenOpponentCards','actualPersona','cpuTruth','evaluatorTruth']){
  assert(!adapter.includes(forbidden),`learner-visible adapter contains forbidden field ${forbidden}`);
}
assert(adapter.includes('copyId:card.copy'),'physical duplicate identity must survive adaptation');
assert(adapter.includes('const isActingCpu=actorSeat!==0&&seatIndex===actorSeat'),'only the acting CPU may receive its private persona in its own policy view');
assert(adapter.includes('const explicitlyPublic=state.showPersonas&&seatIndex!==0'),'learner state may include opponent persona only when the UI makes it public');

assert(app.includes('const PASS_CYCLE = [1,-1,2,-2,3,-3,4,0]'),'canonical passing cycle changed');
assert(app.includes('for(let i=0;i<104;i++) state.players[i%8].hand.push(deck[i])'),'two-deck, eight-player deal changed');
assert(app.includes('scorers.length===1 && scorers[0].pts===52'),'solo moon detection changed');
assert(app.includes('p.score+=104'),'solo moon scoring changed');
assert(app.includes('scorers.length===2 && scorers.reduce((s,x)=>s+x.pts,0)===52'),'two-player moon detection changed');
assert(app.includes('p.score+=26'),'two-player moon scoring changed');
assert(app.includes('openingAutoPlayers'),'special opening 2C execution changed');
assert(app.includes('carryoverPoints'),'carryover semantics missing');
assert(app.includes('if(!eligible.length)'),'no-winner cancellation path missing');

assert(integration.includes('const before=adapter.adapt(0)'),'learner decision must capture pre-action state');
assert(integration.includes('client.evaluateDecision'),'learner decisions must be evaluated by Domain Pack');
assert(integration.includes('client.recommendPass(adapter.adapt(seat))'),'CPU passing must consume Domain Pack reasoning');
assert(integration.includes('client.recommendPlay(adapter.adapt(seat))'),'CPU play must consume Domain Pack reasoning');
assert(integration.includes("integration.status='unavailable'"),'trainer must fail closed when Domain Pack is unavailable');
assert(integration.includes('saveLearningProfile=()=>{}'),'retired browser-local learning persistence must not remain canonical');
assert(integration.includes('client.generateActivity'),'adaptive activity must come from Domain Pack');
assert(integration.includes("cardHtml(card,'')"),'generated activity must reuse the game card primitive');

for(const token of ['aria-label','aria-disabled','aria-pressed','onkeydown','role=\"alert\"']) assert(integration.includes(token),`accessibility integration missing ${token}`);
assert(css.includes('.card.recommended::after'),'recommendation state must have non-color text affordance');
assert(css.includes("content:'CANCELLED'"),'cancellation must have non-color text affordance');
assert(css.includes('@media(max-width:760px)'),'narrow responsive integration rule missing');

assert(app.includes("practiceType==='two'")||app.includes("practiceType = type"),'two-player moon practice must remain present');
assert(app.includes("mode==='practice'")||app.includes("mode = 'practice'"),'solo moon practice must remain present');

console.log('Cancellation Hearts production Domain Pack integration static gate passed.');
