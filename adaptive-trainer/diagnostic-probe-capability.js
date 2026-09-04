import { validateDiagnosticInquiry } from "./diagnostic-inquiry-policy.js";

export const DIAGNOSTIC_PROBE_CAPABILITY_SCHEMA_VERSION = 1;
export const DIAGNOSTIC_PROBE_CAPABILITY_POLICY = "externalize-unverified-auxiliary-operations";
export const DIAGNOSTIC_PROBE_CAPABILITY_STATES = Object.freeze([
  "unknown",
  "observed",
  "supported",
  "established"
]);
export const DIAGNOSTIC_PROBE_CAPABILITY_DECISIONS = Object.freeze([
  "mental-authorized",
  "externalized"
]);

export class DiagnosticProbeCapabilityError extends Error {
  constructor(message) {
    super(`Diagnostic probe capability gate failed: ${message}`);
    this.name = "DiagnosticProbeCapabilityError";
  }
}

function nonEmptyString(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(nonEmptyString).map((value) => value.trim()))];
}

function validateVariant(variant, label) {
  if (!variant || typeof variant !== "object" || Array.isArray(variant)) throw new DiagnosticProbeCapabilityError(`${label} variant must be an object`);
  if (!nonEmptyString(variant.probeMode)) throw new DiagnosticProbeCapabilityError(`${label} variant probeMode is required`);
  if (!nonEmptyString(variant.prompt)) throw new DiagnosticProbeCapabilityError(`${label} variant prompt is required`);
  if (variant.externalizedOperationIds != null && !Array.isArray(variant.externalizedOperationIds)) {
    throw new DiagnosticProbeCapabilityError(`${label} externalizedOperationIds must be an array when supplied`);
  }
  return variant;
}

export function validateDiagnosticProbePlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) throw new DiagnosticProbeCapabilityError("probePlan must be an object");
  if (plan.schemaVersion !== DIAGNOSTIC_PROBE_CAPABILITY_SCHEMA_VERSION) throw new DiagnosticProbeCapabilityError(`probePlan must use schema v${DIAGNOSTIC_PROBE_CAPABILITY_SCHEMA_VERSION}`);
  if (!nonEmptyString(plan.targetOperationId)) throw new DiagnosticProbeCapabilityError("targetOperationId is required");
  if (!Array.isArray(plan.auxiliaryOperations) || !plan.auxiliaryOperations.length) throw new DiagnosticProbeCapabilityError("auxiliaryOperations must contain at least one operation");

  const operationIds = new Set();
  for (const operation of plan.auxiliaryOperations) {
    if (!operation || typeof operation !== "object" || Array.isArray(operation)) throw new DiagnosticProbeCapabilityError("each auxiliary operation must be an object");
    if (!nonEmptyString(operation.operationId) || !nonEmptyString(operation.capabilityId)) throw new DiagnosticProbeCapabilityError("auxiliary operationId and capabilityId are required");
    if (operationIds.has(operation.operationId)) throw new DiagnosticProbeCapabilityError(`duplicate auxiliary operation ${operation.operationId}`);
    operationIds.add(operation.operationId);
    if (operation.requiredState !== "established") throw new DiagnosticProbeCapabilityError("AT1.1 currently permits mental execution only after established capability evidence");
    if (typeof operation.externalizable !== "boolean") throw new DiagnosticProbeCapabilityError("auxiliary operation externalizable must be boolean");
  }

  if (!plan.variants || typeof plan.variants !== "object" || Array.isArray(plan.variants)) throw new DiagnosticProbeCapabilityError("variants are required");
  if (plan.variants.mental) validateVariant(plan.variants.mental, "mental");
  if (plan.variants.externalized) validateVariant(plan.variants.externalized, "externalized");
  if (!plan.variants.mental && !plan.variants.externalized) throw new DiagnosticProbeCapabilityError("at least one probe variant is required");
  return plan;
}

function capabilityEvidence(context, capabilityId) {
  const raw = context?.diagnosticProbeCapabilities?.[capabilityId];
  if (raw == null) return { status: "unknown", evidenceRefs: [] };
  if (typeof raw === "string") {
    if (!DIAGNOSTIC_PROBE_CAPABILITY_STATES.includes(raw)) throw new DiagnosticProbeCapabilityError(`unsupported capability state ${raw} for ${capabilityId}`);
    return { status: raw, evidenceRefs: [] };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new DiagnosticProbeCapabilityError(`capability evidence for ${capabilityId} must be a state string or object`);
  const status = raw.status ?? "unknown";
  if (!DIAGNOSTIC_PROBE_CAPABILITY_STATES.includes(status)) throw new DiagnosticProbeCapabilityError(`unsupported capability state ${status} for ${capabilityId}`);
  return {
    status,
    evidenceRefs: uniqueStrings(raw.evidenceRefs ?? [])
  };
}

function mentalExecutionEstablished(evidence) {
  return evidence.status === "established" && evidence.evidenceRefs.length > 0;
}

function decisionRecord({ status, plan, operationEvidence, unresolvedOperations, externalizedOperationIds = [] }) {
  return Object.freeze({
    schemaVersion: DIAGNOSTIC_PROBE_CAPABILITY_SCHEMA_VERSION,
    policy: DIAGNOSTIC_PROBE_CAPABILITY_POLICY,
    status,
    targetOperationId: plan.targetOperationId,
    operationEvidence: Object.freeze(operationEvidence.map((entry) => Object.freeze({ ...entry, evidenceRefs: Object.freeze([...entry.evidenceRefs]) }))),
    unresolvedCapabilityIds: Object.freeze(uniqueStrings(unresolvedOperations.map((entry) => entry.capabilityId))),
    externalizedOperationIds: Object.freeze(uniqueStrings(externalizedOperationIds)),
    diagnosticAttributionAllowed: true
  });
}

function withVariant(inquiry, variant, decision) {
  const learnerFacing = {
    ...inquiry.learnerFacing,
    prompt: variant.prompt,
    presentation: variant.presentation ?? null
  };
  return validateDiagnosticInquiry({
    ...inquiry,
    probeMode: variant.probeMode,
    evidenceBasis: [...inquiry.evidenceBasis, `probe-capability-decision:${decision.status}`],
    learnerFacing,
    probeCapabilityDecision: decision
  });
}

export function gateDiagnosticProbeCapability({ inquiry = null, context = {} } = {}) {
  if (!inquiry) return null;
  const validatedInquiry = validateDiagnosticInquiry(inquiry);
  if (validatedInquiry.status !== "probe-required" || !validatedInquiry.probePlan) return validatedInquiry;
  if (validatedInquiry.probeCapabilityDecision) return validatedInquiry;

  const plan = validateDiagnosticProbePlan(validatedInquiry.probePlan);
  const operationEvidence = plan.auxiliaryOperations.map((operation) => {
    const evidence = capabilityEvidence(context, operation.capabilityId);
    return {
      operationId: operation.operationId,
      capabilityId: operation.capabilityId,
      requiredState: operation.requiredState,
      externalizable: operation.externalizable,
      status: evidence.status,
      evidenceRefs: evidence.evidenceRefs,
      establishedForMentalProbe: mentalExecutionEstablished(evidence)
    };
  });
  const unresolvedOperations = operationEvidence.filter((entry) => !entry.establishedForMentalProbe);

  if (!unresolvedOperations.length && plan.variants.mental) {
    const decision = decisionRecord({ status: "mental-authorized", plan, operationEvidence, unresolvedOperations: [] });
    return withVariant(validatedInquiry, plan.variants.mental, decision);
  }

  const externalized = plan.variants.externalized;
  if (externalized) {
    const externalizedOperationIds = uniqueStrings(externalized.externalizedOperationIds ?? []);
    const unresolvedIds = unresolvedOperations.map((entry) => entry.operationId);
    const coversEveryUnresolvedOperation = unresolvedOperations.every((entry) => entry.externalizable && externalizedOperationIds.includes(entry.operationId));
    if (coversEveryUnresolvedOperation) {
      const decision = decisionRecord({ status: "externalized", plan, operationEvidence, unresolvedOperations, externalizedOperationIds });
      return withVariant(validatedInquiry, externalized, decision);
    }
    throw new DiagnosticProbeCapabilityError(`externalized variant does not remove every unverified auxiliary operation: ${unresolvedIds.join(", ")}`);
  }

  throw new DiagnosticProbeCapabilityError("probe depends on unverified auxiliary capability and has no safe externalized variant");
}
