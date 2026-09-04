export const DIAGNOSTIC_INQUIRY_SCHEMA_VERSION = 1;
export const DIAGNOSTIC_INQUIRY_POLICY = "probe-before-unverified-causal-remediation";
export const DIAGNOSTIC_INQUIRY_STATUSES = Object.freeze([
  "probe-required",
  "resolved",
  "bounded-safe-instruction"
]);
export const DIAGNOSTIC_INQUIRY_PROBE_MODES = Object.freeze([
  "open-motivation",
  "targeted-clarification",
  "contrast-clarification",
  "alternate-representation",
  "none"
]);

export class DiagnosticInquiryValidationError extends Error {
  constructor(message) {
    super(`Invalid diagnostic inquiry: ${message}`);
    this.name = "DiagnosticInquiryValidationError";
  }
}

function nonEmptyString(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function validTarget(target) {
  if (target == null) return true;
  if (!target || typeof target !== "object" || Array.isArray(target)) return false;
  return ["componentId", "category", "importance"].every((key) => target[key] == null || nonEmptyString(target[key]));
}

export function validateDiagnosticInquiry(inquiry) {
  if (!inquiry || typeof inquiry !== "object" || Array.isArray(inquiry)) throw new DiagnosticInquiryValidationError("inquiry must be an object");
  if (inquiry.schemaVersion !== DIAGNOSTIC_INQUIRY_SCHEMA_VERSION) throw new DiagnosticInquiryValidationError(`inquiry must use schema v${DIAGNOSTIC_INQUIRY_SCHEMA_VERSION}`);
  if (inquiry.policy !== DIAGNOSTIC_INQUIRY_POLICY) throw new DiagnosticInquiryValidationError("inquiry policy is invalid");
  if (!nonEmptyString(inquiry.inquiryId) || !nonEmptyString(inquiry.problemId)) throw new DiagnosticInquiryValidationError("inquiryId and problemId are required");
  if (!DIAGNOSTIC_INQUIRY_STATUSES.includes(inquiry.status)) throw new DiagnosticInquiryValidationError(`unsupported inquiry status ${inquiry.status}`);
  if (!DIAGNOSTIC_INQUIRY_PROBE_MODES.includes(inquiry.probeMode)) throw new DiagnosticInquiryValidationError(`unsupported probe mode ${inquiry.probeMode}`);
  if (!Number.isInteger(inquiry.probeDepth) || inquiry.probeDepth < 0) throw new DiagnosticInquiryValidationError("probeDepth must be a non-negative integer");
  if (!Number.isInteger(inquiry.maxProbeDepth) || inquiry.maxProbeDepth < 1) throw new DiagnosticInquiryValidationError("maxProbeDepth must be a positive integer");
  if (inquiry.probeDepth > inquiry.maxProbeDepth) throw new DiagnosticInquiryValidationError("probeDepth cannot exceed maxProbeDepth");
  if (!validTarget(inquiry.target)) throw new DiagnosticInquiryValidationError("target is invalid");
  if (!Array.isArray(inquiry.evidenceBasis)) throw new DiagnosticInquiryValidationError("evidenceBasis must be an array");
  if (!Array.isArray(inquiry.candidateHypotheses)) throw new DiagnosticInquiryValidationError("candidateHypotheses must be an array");
  if (!inquiry.learnerFacing || typeof inquiry.learnerFacing !== "object") throw new DiagnosticInquiryValidationError("learnerFacing is required");
  if (!nonEmptyString(inquiry.learnerFacing.acknowledgement) || !nonEmptyString(inquiry.learnerFacing.prompt)) throw new DiagnosticInquiryValidationError("learner-facing acknowledgement and prompt are required");
  if (!nonEmptyString(inquiry.learnerFacing.actionLabel)) throw new DiagnosticInquiryValidationError("learner-facing actionLabel is required");
  if (inquiry.status === "probe-required" && inquiry.candidateHypotheses.length < 2) throw new DiagnosticInquiryValidationError("a probe must distinguish at least two plausible hypotheses");
  if (inquiry.status === "probe-required" && inquiry.probeMode === "none") throw new DiagnosticInquiryValidationError("a required probe needs a probe mode");
  if (inquiry.status === "resolved") {
    if (!inquiry.resolution || !nonEmptyString(inquiry.resolution.hypothesisId) || !nonEmptyString(inquiry.resolution.learnerEvidence)) {
      throw new DiagnosticInquiryValidationError("resolved inquiry requires the learner evidence that resolved it");
    }
  }
  return inquiry;
}

export function gateCoachingForDiagnosticInquiry({ diagnosis, coaching, inquiry = null } = {}) {
  if (!inquiry) return coaching;
  const validated = validateDiagnosticInquiry(inquiry);
  if (validated.problemId !== diagnosis?.problemId || validated.problemId !== coaching?.problemId) {
    throw new DiagnosticInquiryValidationError("inquiry, diagnosis, and coaching must refer to the same problem");
  }
  if (validated.status !== "probe-required") {
    return Object.freeze({ ...coaching, diagnosticInquiry: validated });
  }
  const target = validated.target ? {
    componentId: validated.target.componentId ?? null,
    category: validated.target.category ?? null,
    importance: validated.target.importance ?? "major",
    prompt: validated.learnerFacing.prompt
  } : null;
  return Object.freeze({
    ...coaching,
    move: "diagnostic-probe",
    scaffoldLevel: "minimal",
    retryRequired: true,
    acknowledgement: validated.learnerFacing.acknowledgement,
    prompt: validated.learnerFacing.prompt,
    improvementNote: "",
    focus: target,
    strategyAdjustment: null,
    diagnosticInquiry: validated
  });
}
