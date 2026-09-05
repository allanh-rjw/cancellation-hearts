import {defineLearnerEvidenceRecord} from "./evidence-ledger.js";
export const LEARNER_EVIDENCE_DERIVATION_VERSION="learner-evidence-derivation-v2";
function supportDoseFrom(responseEvent,pedagogicalDecision,context={}){const explicit=Number(context.supportDoseBeforeResponse??responseEvent?.administration?.supportDose??0);if(Number.isInteger(explicit)&&explicit>=0&&explicit<=5)return explicit;const decisionDose=Number(pedagogicalDecision?.supportLevel??0);return Number.isInteger(decisionDose)&&decisionDose>=0&&decisionDose<=5?decisionDose:0;}
function independentFrom(responseEvent,supportDose,context={}){if(typeof context.independent==="boolean")return context.independent;if(typeof responseEvent?.administration?.independent==="boolean")return responseEvent.administration.independent;const supportBefore=responseEvent?.administration?.supportBeforeResponse;return supportDose===0&&(!supportBefore||supportBefore==="none");}
function evidenceId(attemptId,suffix){return`${attemptId}:evidence:${suffix}`;}
function isTransferProblem(responseEvent){return responseEvent?.problem?.metadata?.source==="random"||responseEvent?.problem?.familyId==="hearts-transfer-hand"||responseEvent?.problem?.metadata?.noveltyClass==="cross-problem-transfer";}
export function deriveLearnerEvidenceFromAttempt({responseEvent,deterministicEvaluation,reasoningInterpretation=null,diagnosticEvidence,pedagogicalDecision=null,sourceEventIds=[],createdAtUtc,context={}}={}){
  if(!responseEvent?.attemptId)throw new TypeError("learner evidence derivation requires responseEvent");
  if(!deterministicEvaluation?.status)throw new TypeError("learner evidence derivation requires deterministicEvaluation");
  if(!diagnosticEvidence?.evidenceId)throw new TypeError("learner evidence derivation requires diagnosticEvidence");
  const attemptId=responseEvent.attemptId,learnerKey=responseEvent.learnerKey,domainId=responseEvent.domainId,problemVersionId=responseEvent.problem.problemVersionId;
  const constructs=diagnosticEvidence.targetConstructIds?.length?diagnosticEvidence.targetConstructIds:responseEvent.problem.constructIds??[];
  const supportDose=supportDoseFrom(responseEvent,pedagogicalDecision,context),independent=independentFrom(responseEvent,supportDose,context),correct=deterministicEvaluation.status==="correct";
  const sources=sourceEventIds.length?sourceEventIds:[responseEvent.eventId,deterministicEvaluation.evaluationId,diagnosticEvidence.evidenceId];
  const records=[];
  for(const constructId of constructs){
    const kind=independent?(correct?"independent-correct":"independent-incorrect"):(correct?"assisted-correct":"assisted-incorrect");
    records.push(defineLearnerEvidenceRecord({evidenceId:evidenceId(attemptId,`performance:${constructId}`),learnerKey,domainId,attemptId,problemVersionId,constructId,kind,strength:independent?1:Math.max(.35,1-supportDose*.12),createdAtUtc,sourceEventIds:sources,supportDose,independent,metadata:{derivationVersion:LEARNER_EVIDENCE_DERIVATION_VERSION,answerStatus:deterministicEvaluation.status}}));
    if(independent&&isTransferProblem(responseEvent))records.push(defineLearnerEvidenceRecord({evidenceId:evidenceId(attemptId,`transfer:${constructId}`),learnerKey,domainId,attemptId,problemVersionId,constructId,kind:correct?"transfer-success":"transfer-failure",strength:1,createdAtUtc,sourceEventIds:sources,supportDose,independent:true,metadata:{derivationVersion:LEARNER_EVIDENCE_DERIVATION_VERSION,answerStatus:deterministicEvaluation.status,noveltyClass:"cross-problem-transfer"}}));
  }
  if(reasoningInterpretation?.status==="uninterpreted"||diagnosticEvidence.inferenceEligible===false){
    records.push(defineLearnerEvidenceRecord({evidenceId:evidenceId(attemptId,"reasoning-excluded"),learnerKey,domainId,attemptId,problemVersionId,kind:"reasoning-excluded",strength:1,createdAtUtc,sourceEventIds:sources,supportDose,independent,metadata:{derivationVersion:LEARNER_EVIDENCE_DERIVATION_VERSION,reason:reasoningInterpretation?.exclusionReasons?.[0]??diagnosticEvidence.exclusionReasons?.[0]??"diagnostic-inference-ineligible"}}));
  }else{
    for(const hypothesis of diagnosticEvidence.misconceptionHypotheses??[])records.push(defineLearnerEvidenceRecord({evidenceId:evidenceId(attemptId,`misconception:${hypothesis.id}`),learnerKey,domainId,attemptId,problemVersionId,misconceptionId:hypothesis.id,kind:"misconception-support",strength:hypothesis.probability,createdAtUtc,sourceEventIds:sources,supportDose,independent,metadata:{derivationVersion:LEARNER_EVIDENCE_DERIVATION_VERSION,evidenceCodes:hypothesis.evidenceCodes??[]}}));
  }
  return records;
}
