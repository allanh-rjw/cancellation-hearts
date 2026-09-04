import assert from 'node:assert/strict';

globalThis.window=globalThis;
globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};

await import('../hearts-tutor-adapter.js');
await import('../hearts-feedback-diagnosis.js');
await import('../hearts-response-completeness.js');
await import('../hearts-reasoning-evidence.js');
const {cancellationHeartsDomainAdapter}=await import('../adaptive-trainer/hearts-domain-adapter.js');
const {createAdaptiveExecutionPipeline}=await import('../adaptive-trainer/runtime/execution-pipeline.js');
const {createInMemoryRuntimeEventStore}=await import('../adaptive-trainer/runtime/event-store.js');

assert.equal(cancellationHeartsDomainAdapter.capabilities.trainingRuntime,true);
assert.equal(cancellationHeartsDomainAdapter.version,2);

const problem=cancellationHeartsDomainAdapter.problemForId('guided-useful-void');
assert.ok(problem);
const step={id:'objective'};

const terseStore=createInMemoryRuntimeEventStore();
const tersePipeline=createAdaptiveExecutionPipeline({domainAdapter:cancellationHeartsDomainAdapter,eventStore:terseStore});
const terse=await tersePipeline.submitAttempt({
  attemptId:'smoke-terse',sessionId:'smoke-session',learnerKey:'smoke-learner',problem,
  response:{text:'clubs',reasoning:'clubs'},idempotencyKey:'smoke-terse-submit',
  administration:{supportDose:0,independent:true,supportBeforeResponse:'none'},
  context:{step,stepId:'objective',profile:{selfLevel:'developing'},attemptNumber:1}
});
assert.equal(terse.reasoningInterpretation.status,'uninterpreted');
assert.equal(terse.diagnosticEvidence.inferenceEligible,false);
assert.equal(terse.pedagogicalDecision.move,'clarify-reasoning');
assert.ok(terse.learnerEvidence.some((e)=>e.kind==='reasoning-excluded'));
assert.ok(!terse.learnerEvidence.some((e)=>e.kind==='misconception-support'));
assert.match(terse.coachOutput.text,/reason|why|what/i);

const fullStore=createInMemoryRuntimeEventStore();
const fullPipeline=createAdaptiveExecutionPipeline({domainAdapter:cancellationHeartsDomainAdapter,eventStore:fullStore});
const full=await fullPipeline.submitAttempt({
  attemptId:'smoke-full',sessionId:'smoke-session-2',learnerKey:'smoke-learner-2',problem,
  response:{text:'I want to create a club void so that I can unload A♠ safely.',reasoning:'I want to create a club void so that I can unload A♠ safely.'},idempotencyKey:'smoke-full-submit',
  administration:{supportDose:0,independent:true,supportBeforeResponse:'none'},
  context:{step,stepId:'objective',profile:{selfLevel:'developing'},attemptNumber:1}
});
assert.equal(full.reasoningInterpretation,null);
assert.equal(full.fastPath,true);
assert.ok(!full.learnerEvidence.some((e)=>e.kind==='reasoning-excluded'));

// Regression: a response that answers both parts of the objective prompt must not
// be acknowledged for part one and then asked to provide part two again.
const queenProblem=cancellationHeartsDomainAdapter.problemForId('guided-queen-protection');
assert.ok(queenProblem);
const completeText='I want to avoid allowing the 10h, Qh and Qs from becoming forced winners.';
const completeStore=createInMemoryRuntimeEventStore();
const completePipeline=createAdaptiveExecutionPipeline({domainAdapter:cancellationHeartsDomainAdapter,eventStore:completeStore});
const complete=await completePipeline.submitAttempt({
  attemptId:'smoke-complete-two-part',sessionId:'smoke-session-3',learnerKey:'smoke-learner-3',problem:queenProblem,
  response:{text:completeText,reasoning:completeText},idempotencyKey:'smoke-complete-two-part-submit',
  administration:{supportDose:0,independent:true,supportBeforeResponse:'none'},
  context:{step,stepId:'objective',profile:{selfLevel:'developing'},attemptNumber:1}
});
assert.equal(complete.reasoningInterpretation,null);
assert.equal(complete.fastPath,true);
assert.equal(complete.deterministicEvaluation.status,'correct');
assert.ok(complete.deterministicEvaluation.score.value>=0.85);
assert.match(complete.coachOutput.text,/answered both parts|identified.*future liabilities/i);
assert.doesNotMatch(complete.coachOutput.text,/next thing to decide|how you want those cards to leave|what do you want to prevent/i);

const badGround=cancellationHeartsDomainAdapter.groundCoachOutput({problem,text:'Preserve Q♠.'});
assert.equal(badGround.grounded,false);
const goodGround=cancellationHeartsDomainAdapter.groundCoachOutput({problem,text:'Create a route to unload A♠.'});
assert.equal(goodGround.grounded,true);

console.log('Adaptive Trainer Hearts runtime smoke test passed.');
