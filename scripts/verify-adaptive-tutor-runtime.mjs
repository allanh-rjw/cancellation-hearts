import assert from 'node:assert/strict';

globalThis.window=globalThis;
globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};

await import('../hearts-tutor-adapter.js');
await import('../hearts-feedback-diagnosis.js');
await import('../hearts-response-completeness.js');
await import('../hearts-reasoning-evidence.js');
await import('../hearts-advanced-reasoning.js');
const {cancellationHeartsDomainAdapter}=await import('../adaptive-trainer/hearts-domain-adapter.js');
const {createAdaptiveExecutionPipeline}=await import('../adaptive-trainer/runtime/execution-pipeline.js');
const {createInMemoryRuntimeEventStore}=await import('../adaptive-trainer/runtime/event-store.js');
const {buildSkillRubricSummary,scoreLabel}=await import('../adaptive-trainer/student-profile-rubric.js');

assert.equal(cancellationHeartsDomainAdapter.capabilities.trainingRuntime,true);
assert.equal(cancellationHeartsDomainAdapter.version,2);

const levelLabels={low:'Beginner',middle:'Developing',high:'Advanced',top:'Expert'};
assert.equal(scoreLabel(7,levelLabels),'Beginner');
assert.equal(scoreLabel(8,levelLabels),'Developing');
assert.equal(scoreLabel(12,levelLabels),'Advanced');
assert.equal(scoreLabel(15,levelLabels),'Expert');
const rubricEvent=(kind,problemVersionId)=>({type:'learner-evidence-created',payload:{constructId:'hearts.objective_reasoning',kind,strength:1,problemVersionId}});
const expertRubric=buildSkillRubricSummary({constructId:'hearts.objective_reasoning',labels:levelLabels,events:[
  rubricEvent('independent-correct','p1'),rubricEvent('independent-correct','p2'),rubricEvent('independent-correct','p3'),
  rubricEvent('transfer-success','t1'),rubricEvent('transfer-success','t2')
]});
assert.deepEqual(expertRubric.ratings,{understanding:4,consistency:4,independence:4,transfer:4});
assert.equal(expertRubric.score,16);
assert.equal(expertRubric.performanceLabel,'Expert');

const problem=cancellationHeartsDomainAdapter.problemForId('guided-useful-void');
assert.ok(problem);
assert.ok(problem.prompts.threat);
assert.ok(problem.prompts.pivot);
assert.ok(problem.prompts.observe);
assert.ok(problem.prompts.target);
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

const transferProblem={...problem,id:'smoke-transfer-hand',source:'random',title:'Transfer smoke hand'};
const transferStore=createInMemoryRuntimeEventStore();
const transferPipeline=createAdaptiveExecutionPipeline({domainAdapter:cancellationHeartsDomainAdapter,eventStore:transferStore});
const transfer=await transferPipeline.submitAttempt({
  attemptId:'smoke-transfer',sessionId:'smoke-transfer-session',learnerKey:'smoke-transfer-learner',problem:transferProblem,
  response:{text:'I want to create a club void so that I can unload A♠ safely.',reasoning:'I want to create a club void so that I can unload A♠ safely.'},idempotencyKey:'smoke-transfer-submit',
  administration:{supportDose:0,independent:true,supportBeforeResponse:'none'},
  context:{step,stepId:'objective',profile:{selfLevel:'beginner'},attemptNumber:1}
});
assert.ok(transfer.learnerEvidence.some(e=>e.kind==='transfer-success'||e.kind==='transfer-failure'));
assert.ok(transfer.learnerState.skillStates.some(s=>s.transfer.observations>0));

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

const threatText='If one player keeps taking hearts and still controls the lead, I would start treating a moon attempt as a real threat.';
const threatStore=createInMemoryRuntimeEventStore();
const threatPipeline=createAdaptiveExecutionPipeline({domainAdapter:cancellationHeartsDomainAdapter,eventStore:threatStore});
const threat=await threatPipeline.submitAttempt({
  attemptId:'smoke-threat',sessionId:'smoke-session-4',learnerKey:'smoke-learner-4',problem,
  response:{text:threatText,reasoning:threatText},idempotencyKey:'smoke-threat-submit',
  administration:{supportDose:0,independent:true,supportBeforeResponse:'none'},
  context:{step:{id:'threat'},stepId:'threat',profile:{selfLevel:'developing'},attemptNumber:1}
});
assert.equal(threat.fastPath,true);
assert.ok(threat.diagnosticEvidence.targetConstructIds.includes('hearts.threat_detection'));
assert.ok(threat.deterministicEvaluation.score.value>=0.85);

const pivotText='I would make the minimum play needed to break the moon and then return to my original avoidance plan.';
const pivotStore=createInMemoryRuntimeEventStore();
const pivotPipeline=createAdaptiveExecutionPipeline({domainAdapter:cancellationHeartsDomainAdapter,eventStore:pivotStore});
const pivot=await pivotPipeline.submitAttempt({
  attemptId:'smoke-pivot',sessionId:'smoke-session-5',learnerKey:'smoke-learner-5',problem,
  response:{text:pivotText,reasoning:pivotText},idempotencyKey:'smoke-pivot-submit',
  administration:{supportDose:0,independent:true,supportBeforeResponse:'none'},
  context:{step:{id:'pivot'},stepId:'pivot',profile:{selfLevel:'developing'},attemptNumber:1}
});
assert.ok(pivot.diagnosticEvidence.targetConstructIds.includes('hearts.minimum_intervention'));
assert.ok(pivot.deterministicEvaluation.score.value>=0.85);

const targetText='I would target a player only if they had shown a void or exposed high cards and the score made the risk worthwhile; otherwise I would keep my own pathway.';
const targetStore=createInMemoryRuntimeEventStore();
const targetPipeline=createAdaptiveExecutionPipeline({domainAdapter:cancellationHeartsDomainAdapter,eventStore:targetStore});
const target=await targetPipeline.submitAttempt({
  attemptId:'smoke-target',sessionId:'smoke-session-6',learnerKey:'smoke-learner-6',problem,
  response:{text:targetText,reasoning:targetText},idempotencyKey:'smoke-target-submit',
  administration:{supportDose:0,independent:true,supportBeforeResponse:'none'},
  context:{step:{id:'target'},stepId:'target',profile:{selfLevel:'advanced'},attemptNumber:1}
});
assert.ok(target.diagnosticEvidence.targetConstructIds.includes('hearts.smart_targeting'));
assert.ok(target.deterministicEvaluation.score.value>=0.85);

const badGround=cancellationHeartsDomainAdapter.groundCoachOutput({problem,text:'Preserve Q♠.'});
assert.equal(badGround.grounded,false);
const goodGround=cancellationHeartsDomainAdapter.groundCoachOutput({problem,text:'Create a route to unload A♠.'});
assert.equal(goodGround.grounded,true);

console.log('Adaptive Trainer Hearts runtime smoke test passed.');
