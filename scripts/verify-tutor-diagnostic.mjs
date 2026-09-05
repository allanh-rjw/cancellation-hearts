import assert from 'node:assert/strict';
globalThis.window=globalThis;
globalThis.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
await import('../hearts-tutor-adapter.js');
await import('../hearts-feedback-diagnosis.js');
await import('../hearts-response-completeness.js');
await import('../hearts-reasoning-evidence.js');
await import('../hearts-advanced-reasoning.js');
await import('../hearts-passing-reasoning.js');
const {cancellationHeartsDomainAdapter}=await import('../adaptive-trainer/hearts-domain-adapter.js');
const {createAssessmentCore}=await import('../adaptive-trainer/assessment-core.js');
const {createCalibrationCore}=await import('../adaptive-trainer/calibration-core.js');
await import('../tutor-diagnostic.js');
const diagnostic=globalThis.CancellationHeartsDiagnostic;
assert.ok(diagnostic);
assert.equal(diagnostic.HANDS.length,5);
assert.ok(diagnostic.HANDS.filter(h=>h.phases.some(p=>p.pass)).length>=2);
assert.ok(diagnostic.HANDS.some(h=>h.phases.some(p=>p.postpass)));
assert.ok(new Set(diagnostic.HANDS.map(h=>h.strategy)).size>=4);
assert.equal(cancellationHeartsDomainAdapter.capabilities.assessment,true);
assert.equal(cancellationHeartsDomainAdapter.capabilities.calibration,true);
assert.equal(cancellationHeartsDomainAdapter.bindings.assessmentProvider,'adaptive-trainer assessment-core-v1');
assert.match(cancellationHeartsDomainAdapter.bindings.psychometricMetadataProvider,/calibration-core-v1/);
const assessment=createAssessmentCore(cancellationHeartsDomainAdapter);
const calibration=createCalibrationCore(cancellationHeartsDomainAdapter);
const built=assessment.buildSession({items:diagnostic.HANDS,blueprintId:diagnostic.blueprintId,itemCount:5,learnerKey:'diagnostic-smoke'});
assert.equal(built.selection.status,'ready');
assert.equal(built.selection.selected.length,5);
assert.equal(built.session.itemVersionIds.length,5);
assert.equal(built.session.administration.coaching,false);
assert.equal(built.session.administration.hints,false);
assert.equal(built.session.administration.retries,false);
assert.equal(built.session.administration.firstResponseOnly,true);
assert.equal(built.session.administration.feedbackTiming,'after-assessment');
const selected=built.selection.selected.map(x=>x.item);
let session=built.session;const responses=[],evidence=[],scored=[],calibrationRecords=[];
const answers={
 'diag-1':[{step:'objective',text:'I want to protect Qs and shed Qh and 10h before they become forced winners because those liabilities get worse later.'}],
 'diag-2':[{step:'control',text:'I want to stay off lead now because As and the medium high cards are easier to shed; I would only take control when the lead creates a specific disposal route.'}],
 'diag-3':[{step:'prepass_pathway',text:'I want to reduce liabilities so that I can preserve low exits and then create a safer disposal route.',passCards:['AC','QD','KH']}],
 'diag-4':[{step:'prepass_pathway',text:'I want to reduce high cards so that I preserve low exits for later.',passCards:['KC','AD','QH']},{step:'postpass_pathway',text:'The received cards change the hand, so my first objective is to stay off lead while I shed the new liabilities; I will preserve my low exits because I need them later.',receivedCards:['QC','3S','10H'],postPassHand:['2C','6C','10C','5D','9D','4S','8S','JS','4H','7H','QC','3S','10H']}],
 'diag-5':[{step:'threat',text:'If one player keeps taking hearts and still controls the lead, I treat a moon attempt as real and make the minimum intervention needed to break it while preserving my plan.'},{step:'target',text:'I target only if a demonstrated void or exposed high cards makes the play likely and the score justifies it; otherwise I do not target.'}]
};
for(const item of selected){
  session=assessment.markItemPresented({session,item});
  const recorded=assessment.recordResponse({session,item,rawResponse:{phaseResponses:answers[item.id],reasoning:answers[item.id].map(x=>x.text).join('\n')},priorResponses:responses,supportBeforeResponse:'none',assistanceKinds:[],firstEncounter:true,context:'opening-diagnostic'});
  session=recorded.session;responses.push(recorded.response);evidence.push(recorded.evidence);scored.push(recorded.scored);
  assert.equal(recorded.evidence.administration.independent,true);
  assert.equal(recorded.evidence.eligibility.learnerModel,true);
  assert.equal(recorded.evidence.eligibility.calibration,true);
  assert.equal(recorded.evidence.score.scale,'dichotomous');
  const prepared=calibration.prepareObservation(recorded.evidence,{cohort:{assessment:'opening-diagnostic-v1'}});
  assert.equal(prepared.status,'eligible');
  calibrationRecords.push(prepared);
}
const result=assessment.result({session,evidence});
assert.equal(result.completed,true);
assert.equal(result.itemCount,5);
assert.equal(evidence.length,5);
assert.ok(evidence.every(e=>e.source==='assessment'));
assert.throws(()=>assessment.recordResponse({session,item:selected[4],rawResponse:{phaseResponses:answers[selected[4].id]},priorResponses:responses}),/not active/);
const snapshot=calibration.buildDescriptiveSnapshot(calibrationRecords);
assert.equal(snapshot.observationCount,5);
assert.equal(snapshot.excludedCount,0);
assert.equal(snapshot.uniqueLearners,1);
assert.equal(snapshot.status,'insufficient-data');
assert.equal(snapshot.safeguards.firstResponseOnly,true);
assert.equal(snapshot.safeguards.firstEncounterOnly,true);
assert.equal(snapshot.safeguards.independentOnly,true);
assert.equal(snapshot.safeguards.noLiveSelectionOverrideFromSnapshot,true);
assert.equal(calibration.difficultyForItem(selected[0]).value,.2);
assert.equal(calibration.difficultyForItem(selected[4]).value,.85);
const placement=diagnostic.scorePlacement(evidence,result,scored,snapshot);
assert.equal(placement.source,'adaptive-trainer-assessment-core+calibration-core');
assert.equal(placement.responses,5);
assert.equal(placement.calibration.observationCount,5);
assert.ok(['beginner','developing','advanced','expert'].includes(placement.level));
console.log('Tutor diagnostic uses shared Assessment Core and routes eligible evidence through Calibration Core.');
