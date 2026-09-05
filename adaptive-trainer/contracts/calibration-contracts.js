import {
  assertInteger,
  assertNonEmptyString,
  assertPlainObject,
  assertTimestamp,
  deepFreeze,
  jsonClone
} from "./contract-utils.js";
import { defineItemDescriptor } from "./item-contracts.js";
import {
  validateAdministrationTrace,
  validateConfidenceRecord,
  validateEvidenceEligibility,
  validateScoreRecord
} from "./evidence-contracts.js";

export const CALIBRATION_CONTRACT_SCHEMA_VERSION = 1;
export const CALIBRATION_ARTIFACT_STATUSES = Object.freeze(["shadow-only", "selection-ready", "rejected"]);
export const ITEM_CALIBRATION_LIFECYCLE_STATES = Object.freeze([
  "generated",
  "content-validated",
  "experimental",
  "calibrating",
  "calibrated",
  "operational",
  "retired"
]);

export function defineCalibrationObservation({
  observationId,
  domainId,
  learnerKey,
  item,
  submittedAtUtc,
  score,
  administration,
  eligibility,
  confidence = null,
  responseTimeMs = null,
  cohort = {},
  metadata = {}
} = {}) {
  assertNonEmptyString(observationId, "calibration observationId");
  assertNonEmptyString(domainId, "calibration observation domainId");
  assertNonEmptyString(learnerKey, "calibration learnerKey");
  assertTimestamp(submittedAtUtc, "calibration submittedAtUtc");
  const descriptor = defineItemDescriptor(item);
  if (descriptor.domainId !== domainId.trim()) throw new TypeError("calibration observation item domainId must match observation domainId");
  const normalizedScore = validateScoreRecord(score);
  const normalizedAdministration = validateAdministrationTrace(administration);
  const normalizedEligibility = validateEvidenceEligibility(eligibility);
  const normalizedConfidence = confidence === null ? null : validateConfidenceRecord(confidence);
  const normalizedResponseTime = responseTimeMs === null ? null : Number(responseTimeMs);
  if (normalizedResponseTime !== null && (!Number.isFinite(normalizedResponseTime) || normalizedResponseTime < 0)) throw new TypeError("calibration responseTimeMs must be nonnegative or null");
  assertPlainObject(cohort, "calibration cohort");
  assertPlainObject(metadata, "calibration observation metadata");
  return deepFreeze({
    schemaVersion: CALIBRATION_CONTRACT_SCHEMA_VERSION,
    observationId: observationId.trim(),
    domainId: domainId.trim(),
    learnerKey: learnerKey.trim(),
    item: descriptor,
    itemId: descriptor.itemId,
    itemVersionId: descriptor.itemVersionId,
    itemFingerprint: descriptor.fingerprint,
    constructIds: descriptor.constructIds,
    submittedAtUtc,
    score: normalizedScore,
    administration: normalizedAdministration,
    eligibility: normalizedEligibility,
    confidence: normalizedConfidence,
    responseTimeMs: normalizedResponseTime,
    cohort: jsonClone(cohort, "calibration cohort"),
    metadata: jsonClone(metadata, "calibration observation metadata")
  });
}

export function validateCalibrationObservation(observation) {
  if (observation?.schemaVersion !== CALIBRATION_CONTRACT_SCHEMA_VERSION) throw new TypeError("calibration observation schemaVersion is invalid");
  return defineCalibrationObservation(observation);
}

export function defineItemParameterSet({
  domainId,
  item,
  modelKind,
  parameters,
  standardErrors = {},
  effectiveSampleSize,
  fittedAtUtc,
  metadata = {}
} = {}) {
  assertNonEmptyString(domainId, "item parameter domainId");
  assertNonEmptyString(modelKind, "item parameter modelKind");
  const descriptor = defineItemDescriptor(item);
  if (descriptor.domainId !== domainId.trim()) throw new TypeError("item parameter item domainId must match parameter domainId");
  assertPlainObject(parameters, "item parameters");
  assertPlainObject(standardErrors, "item parameter standardErrors");
  assertInteger(effectiveSampleSize, "item parameter effectiveSampleSize", { min: 0 });
  assertTimestamp(fittedAtUtc, "item parameter fittedAtUtc");
  assertPlainObject(metadata, "item parameter metadata");
  return deepFreeze({
    schemaVersion: CALIBRATION_CONTRACT_SCHEMA_VERSION,
    domainId: domainId.trim(),
    item: descriptor,
    itemId: descriptor.itemId,
    itemVersionId: descriptor.itemVersionId,
    itemFingerprint: descriptor.fingerprint,
    modelKind: modelKind.trim(),
    parameters: jsonClone(parameters, "item parameters"),
    standardErrors: jsonClone(standardErrors, "item parameter standardErrors"),
    effectiveSampleSize,
    fittedAtUtc,
    metadata: jsonClone(metadata, "item parameter metadata")
  });
}

export function validateItemParameterSet(parameterSet) {
  if (parameterSet?.schemaVersion !== CALIBRATION_CONTRACT_SCHEMA_VERSION) throw new TypeError("item parameter schemaVersion is invalid");
  return defineItemParameterSet(parameterSet);
}

export function defineCalibrationArtifact({
  artifactId,
  domainId,
  status,
  model,
  sample,
  validation,
  itemParameters,
  metadata = {}
} = {}) {
  assertNonEmptyString(artifactId, "calibration artifactId");
  assertNonEmptyString(domainId, "calibration artifact domainId");
  if (!CALIBRATION_ARTIFACT_STATUSES.includes(status)) throw new TypeError(`invalid calibration artifact status ${status}`);
  assertPlainObject(model, "calibration model");
  assertNonEmptyString(model.kind, "calibration model kind");
  assertNonEmptyString(model.version, "calibration model version");
  assertNonEmptyString(model.cohortId, "calibration model cohortId");
  assertTimestamp(model.fittedAtUtc, "calibration model fittedAtUtc");
  assertPlainObject(sample, "calibration sample");
  assertInteger(sample.uniqueLearners, "calibration sample uniqueLearners", { min: 0 });
  assertInteger(sample.observations, "calibration sample observations", { min: 0 });
  assertPlainObject(validation, "calibration validation");
  if (!Array.isArray(itemParameters)) throw new TypeError("calibration itemParameters must be an array");
  const normalizedItems = itemParameters.map(validateItemParameterSet);
  if (new Set(normalizedItems.map((entry) => entry.itemVersionId)).size !== normalizedItems.length) throw new TypeError("calibration artifact itemParameters must not duplicate itemVersionId");
  for (const entry of normalizedItems) {
    if (entry.domainId !== domainId.trim()) throw new TypeError("calibration artifact item domainId must match artifact domainId");
    if (entry.modelKind !== model.kind.trim()) throw new TypeError("calibration artifact item modelKind must match artifact model kind");
  }
  assertPlainObject(metadata, "calibration artifact metadata");
  return deepFreeze({
    schemaVersion: CALIBRATION_CONTRACT_SCHEMA_VERSION,
    artifactId: artifactId.trim(),
    domainId: domainId.trim(),
    status,
    model: {
      kind: model.kind.trim(),
      version: model.version.trim(),
      cohortId: model.cohortId.trim(),
      fittedAtUtc: model.fittedAtUtc
    },
    sample: { uniqueLearners: sample.uniqueLearners, observations: sample.observations },
    validation: jsonClone(validation, "calibration validation"),
    itemParameters: normalizedItems,
    metadata: jsonClone(metadata, "calibration artifact metadata")
  });
}

export function validateCalibrationArtifact(artifact) {
  if (artifact?.schemaVersion !== CALIBRATION_CONTRACT_SCHEMA_VERSION) throw new TypeError("calibration artifact schemaVersion is invalid");
  return defineCalibrationArtifact(artifact);
}

export function defineItemCalibrationLifecycleRecord({
  domainId,
  item,
  state = "generated",
  updatedAtUtc,
  empiricalArtifactId = null,
  metadata = {}
} = {}) {
  assertNonEmptyString(domainId, "calibration lifecycle domainId");
  const descriptor = defineItemDescriptor(item);
  if (descriptor.domainId !== domainId.trim()) throw new TypeError("calibration lifecycle item domainId must match record domainId");
  if (!ITEM_CALIBRATION_LIFECYCLE_STATES.includes(state)) throw new TypeError(`invalid calibration lifecycle state ${state}`);
  assertTimestamp(updatedAtUtc, "calibration lifecycle updatedAtUtc");
  if (empiricalArtifactId !== null) assertNonEmptyString(empiricalArtifactId, "calibration lifecycle empiricalArtifactId");
  assertPlainObject(metadata, "calibration lifecycle metadata");
  return deepFreeze({
    schemaVersion: CALIBRATION_CONTRACT_SCHEMA_VERSION,
    domainId: domainId.trim(),
    item: descriptor,
    itemId: descriptor.itemId,
    itemVersionId: descriptor.itemVersionId,
    itemFingerprint: descriptor.fingerprint,
    state,
    updatedAtUtc,
    empiricalArtifactId,
    metadata: jsonClone(metadata, "calibration lifecycle metadata")
  });
}

export function validateItemCalibrationLifecycleRecord(record) {
  if (record?.schemaVersion !== CALIBRATION_CONTRACT_SCHEMA_VERSION) throw new TypeError("calibration lifecycle schemaVersion is invalid");
  return defineItemCalibrationLifecycleRecord(record);
}
