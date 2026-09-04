import assert from 'node:assert/strict';

globalThis.window=globalThis;
globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};

await import('../hearts-tutor-adapter.js');
await import('../hearts-feedback-diagnosis.js');
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

const badGround=cancellationHeartsDomainAdapter.groundCoachOutput({problem,text:'Preserve Q♠.'});
assert.equal(badGround.grounded,false);
const goodGround=cancellationHeartsDomainAdapter.groundCoachOutput({problem,text:'Create a route to unload A♠.'});
assert.equal(goodGround.grounded,true);

console.log('Adaptive Trainer Hearts runtime smoke test passed.');
