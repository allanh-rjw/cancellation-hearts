import { validateDomainAdapter } from "./domain-adapter.js";
import { gateCoachingForDiagnosticInquiry } from "./diagnostic-inquiry-policy.js";
import { gateDiagnosticProbeCapability } from "./diagnostic-probe-capability.js";
import { applyDiagnosticProbeDecision, decideDiagnosticProbe } from "./diagnostic-probe-decision-policy.js";
import { applyDiagnosticInteractionDecision, decideDiagnosticInteractionBurden } from "./diagnostic-interaction-burden-policy.js";
import { reconcileCourseGoalState } from "./course-goal-state.js";

export const ADAPTIVE_TRAINER_CORE_SCHEMA_VERSION = 3;
export const ADAPTIVE_TRAINER_CORE_STATUS = "domain-neutral-orchestration-boundary";

export class AdaptiveTrainerCoreError extends Error {
  constructor(message) {
    super(`Adaptive trainer core failed: ${message}`);
    this.name = "AdaptiveTrainerCoreError";
  }
}

function resolvedProblem(adapter, problemOrId) {
  const problem = typeof problemOrId === "string" ? adapter.problemForId(problemOrId) : problemOrId;
  if (!problem || typeof problem !== "object" || !problem.id) throw new AdaptiveTrainerCoreError("a domain problem with a stable id is required");
  return problem;
}

function validateAssessment(problem, assessment) {
  if (!assessment || typeof assessment !== "object") throw new AdaptiveTrainerCoreError("domain assessment must be an object");
  if (!assessment.diagnosis || !assessment.coaching) throw new AdaptiveTrainerCoreError("domain assessment must include diagnosis and coaching");
  if (assessment.diagnosis.problemId !== problem.id) throw new AdaptiveTrainerCoreError("diagnosis must refer to the active problem");
  if (assessment.coaching.problemId !== problem.id) throw new AdaptiveTrainerCoreError("coaching must refer to the active problem");
  return assessment;
}

export function createAdaptiveTrainerCore(domainAdapter) {
  const adapter = validateDomainAdapter(domainAdapter);
  const verifyProblem = (problemOrId) => {
    const problem = resolvedProblem(adapter, problemOrId);
    const verification = adapter.verifyProblem(problem);
    if (!verification || typeof verification !== "object") throw new AdaptiveTrainerCoreError("domain verifier must return a verification record");
    if (verification.status !== "verified") throw new AdaptiveTrainerCoreError(`${problem.id} was not verified by the active domain adapter`);
    return verification;
  };
  return Object.freeze({
    schemaVersion: ADAPTIVE_TRAINER_CORE_SCHEMA_VERSION,
    status: ADAPTIVE_TRAINER_CORE_STATUS,
    domainId: adapter.domainId,
    adapterVersion: adapter.version,

    listProblems() {
      const problems = adapter.listProblems();
      if (!Array.isArray(problems)) throw new AdaptiveTrainerCoreError("domain adapter listProblems() must return an array");
      return problems;
    },

    problemForId(problemId) {
      return resolvedProblem(adapter, problemId);
    },

    verifyProblem,

    assessAttempt({ problem: problemOrId, response, events = [], now = new Date().toISOString(), context = {} }) {
      const problem = resolvedProblem(adapter, problemOrId);
      const verification = verifyProblem(problem);
      const provisionalAssessment = validateAssessment(problem, adapter.assessAttempt({ problem, response, context, events, now }));
      const rawDiagnosticInquiry = provisionalAssessment.diagnosticInquiry ?? adapter.buildDiagnosticInquiry({
        problem,
        response,
        diagnosis: provisionalAssessment.diagnosis,
        coaching: provisionalAssessment.coaching,
        context,
        events,
        now
      });
      const probeDecision = provisionalAssessment.diagnosticProbeDecision ?? decideDiagnosticProbe({
        inquiry: rawDiagnosticInquiry,
        diagnosis: provisionalAssessment.diagnosis,
        context
      });
      const diagnosticInteractionDecision = decideDiagnosticInteractionBurden({
        inquiry: rawDiagnosticInquiry,
        diagnosis: provisionalAssessment.diagnosis,
        probeDecision,
        context
      });
      const interactionInquiry = applyDiagnosticInteractionDecision({
        inquiry: rawDiagnosticInquiry,
        interactionDecision: diagnosticInteractionDecision
      });
      const decisionInquiry = applyDiagnosticProbeDecision({ inquiry: interactionInquiry, probeDecision });
      const diagnosticInquiry = gateDiagnosticProbeCapability({ inquiry: decisionInquiry, context });
      const coaching = gateCoachingForDiagnosticInquiry({
        diagnosis: provisionalAssessment.diagnosis,
        coaching: provisionalAssessment.coaching,
        inquiry: diagnosticInquiry
      });
      const assessment = validateAssessment(problem, { ...provisionalAssessment, coaching });
      const learnerModel = adapter.buildLearnerModel({ events, now });
      const nextExperience = adapter.selectNextExperience({
        problem,
        diagnosis: assessment.diagnosis,
        coaching: assessment.coaching,
        learnerModel,
        now,
        context,
        events
      });
      const goalState = reconcileCourseGoalState({
        state: context.goalState ?? null,
        transition: context.goalTransition ?? null,
        now
      });
      return Object.freeze({
        schemaVersion: ADAPTIVE_TRAINER_CORE_SCHEMA_VERSION,
        domainId: adapter.domainId,
        adapterVersion: adapter.version,
        problem,
        verification,
        diagnosis: assessment.diagnosis,
        diagnosticInquiry: diagnosticInquiry ?? null,
        diagnosticProbeDecision: probeDecision,
        diagnosticInteractionDecision,
        coaching: assessment.coaching,
        learnerModel,
        goalState,
        nextExperience
      });
    }
  });
}
