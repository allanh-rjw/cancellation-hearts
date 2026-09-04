export const DIAGNOSTIC_INTERACTION_BURDEN_SCHEMA_VERSION = 1;
export const DIAGNOSTIC_INTERACTION_BURDEN_POLICY = "probe-until-information-value-no-longer-justifies-interaction-burden";
export const DIAGNOSTIC_INTERACTION_STATUSES = Object.freeze([
  "continue",
  "probe",
  "teach-model",
  "return-control"
]);
export const DIAGNOSTIC_INTERACTION_REASONS = Object.freeze([
  "no-unresolved-work",
  "no-inquiry",
  "inquiry-already-resolved",
  "at12-teach-now",
  "at12-no-probe",
  "high-value-probe",
  "learner-requested-explanation",
  "same-target-probe-limit",
  "evidence-already-supplied",
  "high-cognitive-load",
  "question-burden-outweighs-value",
  "low-diagnostic-uncertainty",
  "non-diagnostic-purpose-bounded",
  "answer-supply-risk",
  "self-explanation-purpose",
  "strategy-reflection-purpose"
]);

export class DiagnosticInteractionBurdenError extends Error {
  constructor(message) {
    super(`Invalid diagnostic interaction burden decision: ${message}`);
    this.name = "DiagnosticInteractionBurdenError";
  }
}

function boundedCount(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : fallback;
}

function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function reasoningPurposeFor(context = {}) {
  return context?.reasoningRequest?.reasoningPurpose
    ?? context?.reasoningPurpose
    ?? context?.interactionBurden?.reasoningPurpose
    ?? "diagnostic";
}

function unresolvedWork(diagnosis = null) {
  if (!diagnosis) return false;
  const reasoning = diagnosis?.reasoningAssessment?.status ?? null;
  const answer = diagnosis?.answerAssessment?.status ?? null;
  const divergence = Boolean(
    diagnosis?.reasoningAssessment?.earliestMeaningfulDivergence
    ?? diagnosis?.componentEvidence?.earliestMeaningfulDivergence
  );
  if (divergence) return true;
  if (answer && answer !== "correct") return true;
  return ["faulty", "apparent-guess", "insufficient-evidence", "mostly-sound-with-answer-error"].includes(reasoning);
}

function burdenInputs({ inquiry = null, probeDecision = null, context = {} } = {}) {
  const supplied = context?.interactionBurden ?? {};
  const responses = Array.isArray(context?.diagnosticInquiryResponses)
    ? context.diagnosticInquiryResponses
    : [];
  const sameTargetProbeCount = boundedCount(
    supplied.sameTargetProbeCount,
    responses.length
  );
  const consecutiveTrainerQuestions = boundedCount(
    supplied.consecutiveTrainerQuestions,
    sameTargetProbeCount
  );
  const scaffoldHistory = Array.isArray(supplied.recentScaffoldHistory)
    ? supplied.recentScaffoldHistory
    : [];
  const inferredDirect = scaffoldHistory.filter((entry) =>
    entry?.scaffoldLevel === "direct" || entry?.level === "direct"
  ).length;
  const inferredSupply = scaffoldHistory.filter((entry) =>
    entry?.answerSupplied === true
    || entry?.modeledSolution === true
    || entry?.move === "model-reasoning"
  ).length;

  return Object.freeze({
    sameTargetProbeCount,
    consecutiveTrainerQuestions,
    evidenceAlreadySupplied: supplied.evidenceAlreadySupplied === true,
    learnerRequestedExplanation: supplied.learnerRequestedExplanation === true,
    cognitiveLoad: enumValue(
      supplied.cognitiveLoad ?? (context?.frustration === "high" ? "high" : null),
      ["low", "medium", "high"],
      "low"
    ),
    diagnosticUncertainty: enumValue(
      supplied.diagnosticUncertainty,
      ["low", "medium", "high", "unknown"],
      "unknown"
    ),
    recentDirectSupportCount: boundedCount(supplied.recentDirectSupportCount, inferredDirect),
    recentAnswerSupplyCount: boundedCount(supplied.recentAnswerSupplyCount, inferredSupply),
    reasoningPurpose: reasoningPurposeFor(context),
    informationValue: enumValue(probeDecision?.informationValue, ["low", "medium", "high"], "medium"),
    actionRelevance: enumValue(probeDecision?.actionRelevance, ["different-actions", "same-action", "unknown"], "unknown")
  });
}

function buildDecision({ status, reason, inquiry, probeDecision, diagnosis, inputs }) {
  return validateDiagnosticInteractionBurdenDecision({
    schemaVersion: DIAGNOSTIC_INTERACTION_BURDEN_SCHEMA_VERSION,
    policy: DIAGNOSTIC_INTERACTION_BURDEN_POLICY,
    status,
    reason,
    inquiryId: inquiry?.inquiryId ?? null,
    probeDepth: Number.isInteger(inquiry?.probeDepth) ? inquiry.probeDepth : null,
    baseProbeStatus: probeDecision?.status ?? null,
    unresolvedWork: unresolvedWork(diagnosis),
    sameTargetProbeCount: inputs.sameTargetProbeCount,
    consecutiveTrainerQuestions: inputs.consecutiveTrainerQuestions,
    evidenceAlreadySupplied: inputs.evidenceAlreadySupplied,
    learnerRequestedExplanation: inputs.learnerRequestedExplanation,
    cognitiveLoad: inputs.cognitiveLoad,
    diagnosticUncertainty: inputs.diagnosticUncertainty,
    recentDirectSupportCount: inputs.recentDirectSupportCount,
    recentAnswerSupplyCount: inputs.recentAnswerSupplyCount,
    reasoningPurpose: inputs.reasoningPurpose,
    informationValue: inputs.informationValue,
    actionRelevance: inputs.actionRelevance
  });
}

export function decideDiagnosticInteractionBurden({
  inquiry = null,
  diagnosis = null,
  probeDecision = null,
  context = {}
} = {}) {
  const inputs = burdenInputs({ inquiry, probeDecision, context });
  const unresolved = unresolvedWork(diagnosis);

  if (!unresolved) {
    return buildDecision({ status: "continue", reason: "no-unresolved-work", inquiry, probeDecision, diagnosis, inputs });
  }

  const answerSupplyRisk = inputs.recentAnswerSupplyCount >= 2 || inputs.recentDirectSupportCount >= 2;

  if (!inquiry) {
    if (answerSupplyRisk && !inputs.learnerRequestedExplanation && inputs.cognitiveLoad !== "high") {
      return buildDecision({ status: "return-control", reason: "answer-supply-risk", inquiry, probeDecision, diagnosis, inputs });
    }
    return buildDecision({ status: "continue", reason: "no-inquiry", inquiry, probeDecision, diagnosis, inputs });
  }

  if (inquiry.status !== "probe-required") {
    return buildDecision({ status: "continue", reason: "inquiry-already-resolved", inquiry, probeDecision, diagnosis, inputs });
  }

  if (probeDecision?.status === "teach-now") {
    return buildDecision({ status: "teach-model", reason: "at12-teach-now", inquiry, probeDecision, diagnosis, inputs });
  }

  if (probeDecision?.status && probeDecision.status !== "probe-required") {
    return buildDecision({ status: "continue", reason: "at12-no-probe", inquiry, probeDecision, diagnosis, inputs });
  }

  if (inputs.learnerRequestedExplanation) {
    return buildDecision({ status: "teach-model", reason: "learner-requested-explanation", inquiry, probeDecision, diagnosis, inputs });
  }

  if (inputs.reasoningPurpose === "self-explanation") {
    return buildDecision({ status: "return-control", reason: "self-explanation-purpose", inquiry, probeDecision, diagnosis, inputs });
  }

  if (inputs.reasoningPurpose === "strategy-reflection") {
    return buildDecision({ status: "return-control", reason: "strategy-reflection-purpose", inquiry, probeDecision, diagnosis, inputs });
  }

  if (answerSupplyRisk) {
    return buildDecision({ status: "return-control", reason: "answer-supply-risk", inquiry, probeDecision, diagnosis, inputs });
  }

  if (inputs.sameTargetProbeCount >= 2) {
    return buildDecision({ status: "teach-model", reason: "same-target-probe-limit", inquiry, probeDecision, diagnosis, inputs });
  }

  if (inputs.sameTargetProbeCount >= 1 && inputs.evidenceAlreadySupplied) {
    return buildDecision({ status: "teach-model", reason: "evidence-already-supplied", inquiry, probeDecision, diagnosis, inputs });
  }

  if (inputs.sameTargetProbeCount >= 1 && inputs.cognitiveLoad === "high") {
    return buildDecision({ status: "teach-model", reason: "high-cognitive-load", inquiry, probeDecision, diagnosis, inputs });
  }

  if (inputs.sameTargetProbeCount >= 1 && inputs.reasoningPurpose !== "diagnostic") {
    return buildDecision({ status: "teach-model", reason: "non-diagnostic-purpose-bounded", inquiry, probeDecision, diagnosis, inputs });
  }

  if (inputs.consecutiveTrainerQuestions >= 2 && inputs.informationValue !== "high") {
    return buildDecision({ status: "teach-model", reason: "question-burden-outweighs-value", inquiry, probeDecision, diagnosis, inputs });
  }

  if (inputs.sameTargetProbeCount >= 1 && inputs.diagnosticUncertainty === "low") {
    return buildDecision({ status: "teach-model", reason: "low-diagnostic-uncertainty", inquiry, probeDecision, diagnosis, inputs });
  }

  return buildDecision({ status: "probe", reason: "high-value-probe", inquiry, probeDecision, diagnosis, inputs });
}

export function applyDiagnosticInteractionDecision({ inquiry = null, interactionDecision } = {}) {
  const decision = validateDiagnosticInteractionBurdenDecision(interactionDecision);
  if (!inquiry) return null;
  if (inquiry.status !== "probe-required") return inquiry;
  return decision.status === "probe" ? inquiry : null;
}

export function validateDiagnosticInteractionBurdenDecision(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DiagnosticInteractionBurdenError("decision must be an object");
  if (value.schemaVersion !== DIAGNOSTIC_INTERACTION_BURDEN_SCHEMA_VERSION) throw new DiagnosticInteractionBurdenError(`decision must use schema v${DIAGNOSTIC_INTERACTION_BURDEN_SCHEMA_VERSION}`);
  if (value.policy !== DIAGNOSTIC_INTERACTION_BURDEN_POLICY) throw new DiagnosticInteractionBurdenError("policy is invalid");
  if (!DIAGNOSTIC_INTERACTION_STATUSES.includes(value.status)) throw new DiagnosticInteractionBurdenError(`unsupported status ${value.status}`);
  if (!DIAGNOSTIC_INTERACTION_REASONS.includes(value.reason)) throw new DiagnosticInteractionBurdenError(`unsupported reason ${value.reason}`);
  for (const key of ["sameTargetProbeCount", "consecutiveTrainerQuestions", "recentDirectSupportCount", "recentAnswerSupplyCount"]) {
    if (!Number.isInteger(value[key]) || value[key] < 0) throw new DiagnosticInteractionBurdenError(`${key} must be a nonnegative integer`);
  }
  for (const key of ["evidenceAlreadySupplied", "learnerRequestedExplanation", "unresolvedWork"]) {
    if (typeof value[key] !== "boolean") throw new DiagnosticInteractionBurdenError(`${key} must be boolean`);
  }
  if (!["low", "medium", "high"].includes(value.cognitiveLoad)) throw new DiagnosticInteractionBurdenError("cognitiveLoad is invalid");
  if (!["low", "medium", "high", "unknown"].includes(value.diagnosticUncertainty)) throw new DiagnosticInteractionBurdenError("diagnosticUncertainty is invalid");
  if (!["diagnostic", "verification", "self-explanation", "strategy-reflection"].includes(value.reasoningPurpose)) throw new DiagnosticInteractionBurdenError("reasoningPurpose is invalid");
  if (!["low", "medium", "high"].includes(value.informationValue)) throw new DiagnosticInteractionBurdenError("informationValue is invalid");
  if (!["different-actions", "same-action", "unknown"].includes(value.actionRelevance)) throw new DiagnosticInteractionBurdenError("actionRelevance is invalid");
  return Object.freeze(value);
}
