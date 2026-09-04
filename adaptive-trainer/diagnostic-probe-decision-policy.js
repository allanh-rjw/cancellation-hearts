export const DIAGNOSTIC_PROBE_DECISION_SCHEMA_VERSION = 1;
export const DIAGNOSTIC_PROBE_DECISION_POLICY = "probe-only-when-causal-uncertainty-is-action-relevant";
export const DIAGNOSTIC_PROBE_DECISION_STATUSES = Object.freeze([
  "no-inquiry",
  "probe-required",
  "probe-not-justified",
  "diagnosis-sufficient",
  "teach-now"
]);
export const DIAGNOSTIC_PROBE_DECISION_REASONS = Object.freeze([
  "no-inquiry",
  "inquiry-already-resolved",
  "current-evidence-sufficient",
  "general-omission-only",
  "targeted-not-demonstrated-low-value",
  "same-action-regardless-of-cause",
  "low-information-value",
  "probe-burden-outweighs-value",
  "probe-budget-exhausted",
  "causal-interpretation-resolved",
  "competing-action-relevant-hypotheses"
]);

export class DiagnosticProbeDecisionError extends Error {
  constructor(message) {
    super(`Invalid diagnostic probe decision: ${message}`);
    this.name = "DiagnosticProbeDecisionError";
  }
}

const RANK = Object.freeze({ low: 1, medium: 2, high: 3 });

function enumValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function requestScopeFor(diagnosis) {
  const value = diagnosis?.reasoningStructureAssessment?.requestScope;
  if (typeof value === "string") return value;
  return value?.scope ?? value?.kind ?? value?.requestScope ?? null;
}

function stagesFor(diagnosis) {
  const stages = diagnosis?.reasoningStructureAssessment?.stages;
  return Array.isArray(stages) ? stages : [];
}

function currentEvidenceSummary(diagnosis) {
  const statuses = stagesFor(diagnosis).map((stage) => stage?.status).filter(Boolean);
  const divergent = statuses.includes("divergent");
  const contaminated = statuses.includes("downstream-contaminated");
  const notDemonstrated = statuses.includes("not-demonstrated");
  const sound = statuses.includes("sound");
  const answerCorrect = diagnosis?.answerAssessment?.status === "correct";
  const reasoningStatus = diagnosis?.reasoningAssessment?.status ?? null;
  const requestScope = requestScopeFor(diagnosis);
  const targetedNotDemonstrated = Boolean(
    diagnosis?.reasoningStructureAssessment?.longitudinalContext?.targetedNotDemonstrated
    || (requestScope === "targeted" && notDemonstrated && !divergent)
  );
  const generalOmissionOnly = Boolean(
    answerCorrect
    && requestScope !== "targeted"
    && notDemonstrated
    && !divergent
    && !contaminated
  );
  return Object.freeze({
    answerCorrect,
    reasoningStatus,
    requestScope,
    sound,
    divergent,
    contaminated,
    notDemonstrated,
    targetedNotDemonstrated,
    generalOmissionOnly
  });
}

function hintsFor(inquiry, context) {
  const supplied = context?.diagnosticProbeDecision ?? inquiry?.probeDecisionContext ?? {};
  return Object.freeze({
    actionRelevance: enumValue(supplied.actionRelevance, ["different-actions", "same-action", "unknown"], "unknown"),
    informationValue: enumValue(supplied.informationValue, ["low", "medium", "high"], "medium"),
    cognitiveBurden: enumValue(supplied.cognitiveBurden, ["low", "medium", "high"], "medium"),
    causalStatus: enumValue(supplied.causalStatus, ["resolved", "unresolved", "unknown"], "unknown"),
    freshEvidenceRequired: supplied.freshEvidenceRequired === true,
    probeBudgetExhausted: supplied.probeBudgetExhausted === true
  });
}

function buildDecision({ inquiry, status, reason, evidence, hints }) {
  return validateDiagnosticProbeDecision({
    schemaVersion: DIAGNOSTIC_PROBE_DECISION_SCHEMA_VERSION,
    policy: DIAGNOSTIC_PROBE_DECISION_POLICY,
    status,
    reason,
    inquiryId: inquiry?.inquiryId ?? null,
    probeDepth: Number.isInteger(inquiry?.probeDepth) ? inquiry.probeDepth : null,
    maxProbeDepth: Number.isInteger(inquiry?.maxProbeDepth) ? inquiry.maxProbeDepth : null,
    candidateHypothesisCount: Array.isArray(inquiry?.candidateHypotheses) ? inquiry.candidateHypotheses.length : 0,
    currentEvidence: evidence,
    actionRelevance: hints.actionRelevance,
    informationValue: hints.informationValue,
    cognitiveBurden: hints.cognitiveBurden,
    freshEvidenceRequired: hints.freshEvidenceRequired,
    probeBudgetExhausted: hints.probeBudgetExhausted,
    inquiryPassThrough: Boolean(inquiry && (inquiry.status !== "probe-required" || status === "probe-required"))
  });
}

export function decideDiagnosticProbe({ inquiry = null, diagnosis = null, context = {} } = {}) {
  const evidence = currentEvidenceSummary(diagnosis);
  const hints = hintsFor(inquiry, context);

  if (!inquiry) return buildDecision({ inquiry, status: "no-inquiry", reason: "no-inquiry", evidence, hints });

  if (inquiry.status !== "probe-required") {
    return buildDecision({ inquiry, status: "diagnosis-sufficient", reason: "inquiry-already-resolved", evidence, hints });
  }

  // The domain inquiry owns probe numbering. A candidate at depth N of N is
  // still the Nth allowed probe. AT1.2 stops only when the surrounding runtime
  // explicitly reports that the available probe budget has already been spent.
  if (hints.probeBudgetExhausted) {
    return buildDecision({ inquiry, status: "teach-now", reason: "probe-budget-exhausted", evidence, hints });
  }

  if (hints.causalStatus === "resolved") {
    return buildDecision({ inquiry, status: "diagnosis-sufficient", reason: "causal-interpretation-resolved", evidence, hints });
  }

  if (evidence.answerCorrect && evidence.reasoningStatus === "expert-like" && !evidence.divergent) {
    return buildDecision({ inquiry, status: "diagnosis-sufficient", reason: "current-evidence-sufficient", evidence, hints });
  }

  if (evidence.generalOmissionOnly) {
    return buildDecision({ inquiry, status: "probe-not-justified", reason: "general-omission-only", evidence, hints });
  }

  if (evidence.targetedNotDemonstrated && !hints.freshEvidenceRequired) {
    return buildDecision({ inquiry, status: "probe-not-justified", reason: "targeted-not-demonstrated-low-value", evidence, hints });
  }

  if (hints.actionRelevance === "same-action") {
    return buildDecision({ inquiry, status: "probe-not-justified", reason: "same-action-regardless-of-cause", evidence, hints });
  }

  if (hints.informationValue === "low") {
    return buildDecision({ inquiry, status: "probe-not-justified", reason: "low-information-value", evidence, hints });
  }

  if ((RANK[hints.cognitiveBurden] ?? 2) > (RANK[hints.informationValue] ?? 2)
      && hints.cognitiveBurden === "high"
      && hints.informationValue !== "high") {
    return buildDecision({ inquiry, status: "teach-now", reason: "probe-burden-outweighs-value", evidence, hints });
  }

  return buildDecision({
    inquiry,
    status: "probe-required",
    reason: "competing-action-relevant-hypotheses",
    evidence,
    hints
  });
}

export function applyDiagnosticProbeDecision({ inquiry = null, probeDecision } = {}) {
  const decision = validateDiagnosticProbeDecision(probeDecision);
  if (!inquiry) return null;
  if (inquiry.status !== "probe-required") return inquiry;
  return decision.status === "probe-required" ? inquiry : null;
}

export function validateDiagnosticProbeDecision(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DiagnosticProbeDecisionError("decision must be an object");
  if (value.schemaVersion !== DIAGNOSTIC_PROBE_DECISION_SCHEMA_VERSION) throw new DiagnosticProbeDecisionError(`decision must use schema v${DIAGNOSTIC_PROBE_DECISION_SCHEMA_VERSION}`);
  if (value.policy !== DIAGNOSTIC_PROBE_DECISION_POLICY) throw new DiagnosticProbeDecisionError("policy is invalid");
  if (!DIAGNOSTIC_PROBE_DECISION_STATUSES.includes(value.status)) throw new DiagnosticProbeDecisionError(`unsupported status ${value.status}`);
  if (!DIAGNOSTIC_PROBE_DECISION_REASONS.includes(value.reason)) throw new DiagnosticProbeDecisionError(`unsupported reason ${value.reason}`);
  if (!["different-actions", "same-action", "unknown"].includes(value.actionRelevance)) throw new DiagnosticProbeDecisionError("actionRelevance is invalid");
  if (!["low", "medium", "high"].includes(value.informationValue)) throw new DiagnosticProbeDecisionError("informationValue is invalid");
  if (!["low", "medium", "high"].includes(value.cognitiveBurden)) throw new DiagnosticProbeDecisionError("cognitiveBurden is invalid");
  if (typeof value.freshEvidenceRequired !== "boolean") throw new DiagnosticProbeDecisionError("freshEvidenceRequired must be boolean");
  if (typeof value.probeBudgetExhausted !== "boolean") throw new DiagnosticProbeDecisionError("probeBudgetExhausted must be boolean");
  if (typeof value.inquiryPassThrough !== "boolean") throw new DiagnosticProbeDecisionError("inquiryPassThrough must be boolean");
  if (!value.currentEvidence || typeof value.currentEvidence !== "object") throw new DiagnosticProbeDecisionError("currentEvidence is required");
  if (value.status === "probe-required" && value.candidateHypothesisCount < 2) throw new DiagnosticProbeDecisionError("a required probe must still distinguish at least two hypotheses");
  return Object.freeze(value);
}
