export const DOMAIN_ADAPTER_SCHEMA_VERSION = 5;
export const DOMAIN_ADAPTER_STATUS = "portable-domain-boundary";

export const DOMAIN_ADAPTER_REQUIRED_BINDINGS = Object.freeze([
  "knowledgeGraph",
  "problemFamilyRegistry",
  "expertModelProvider",
  "truthVerifier",
  "responseInterpreter",
  "representationProvider",
  "languageProvider",
  "diagnosticInquiryProvider"
]);

export const DOMAIN_ADAPTER_REQUIRED_METHODS = Object.freeze([
  "listProblems",
  "problemForId",
  "verifyProblem",
  "assessAttempt",
  "buildLearnerModel",
  "selectNextExperience",
  "buildDiagnosticInquiry"
]);

export const DOMAIN_ADAPTER_CAPABILITIES = Object.freeze([
  "assessment",
  "calibration",
  "trainingRuntime"
]);

export const DOMAIN_ADAPTER_CAPABILITY_REQUIREMENTS = Object.freeze({
  assessment: Object.freeze({
    bindings: Object.freeze(["assessmentProvider"]),
    methods: Object.freeze([
      "assessmentBlueprints",
      "constructsForItem",
      "scoreAssessmentResponse",
      "assessmentToolPolicy",
      "assessmentItemEligibility",
      "itemDescriptor"
    ])
  }),
  calibration: Object.freeze({
    bindings: Object.freeze(["psychometricMetadataProvider"]),
    methods: Object.freeze(["itemDescriptor", "difficultyPrior"])
  }),
  trainingRuntime: Object.freeze({
    bindings: Object.freeze([
      "runtimeTruthEvaluator",
      "runtimeReasoningGraphProvider",
      "runtimeCoachingResourceProvider"
    ]),
    methods: Object.freeze([
      "runtimeProblemState",
      "evaluateResponseDeterministically",
      "reasoningInterpretationContext",
      "diagnosticEvidenceFromInterpretation",
      "coachingResources",
      "groundCoachOutput"
    ])
  })
});

export class DomainAdapterValidationError extends Error {
  constructor(message) {
    super(`Domain adapter validation failed: ${message}`);
    this.name = "DomainAdapterValidationError";
  }
}

function nonEmptyString(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function validateCapabilities(adapter) {
  const capabilities = adapter.capabilities ?? {};
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
    throw new DomainAdapterValidationError("capabilities must be an object when provided");
  }
  for (const key of Object.keys(capabilities)) {
    if (!DOMAIN_ADAPTER_CAPABILITIES.includes(key)) throw new DomainAdapterValidationError(`unknown capability ${key}`);
    if (typeof capabilities[key] !== "boolean") throw new DomainAdapterValidationError(`capability ${key} must be boolean`);
  }
  for (const capability of DOMAIN_ADAPTER_CAPABILITIES) {
    if (capabilities[capability] !== true) continue;
    const requirements = DOMAIN_ADAPTER_CAPABILITY_REQUIREMENTS[capability];
    for (const binding of requirements.bindings) {
      if (!nonEmptyString(adapter.bindings[binding])) {
        throw new DomainAdapterValidationError(`capability ${capability} requires binding ${binding}`);
      }
    }
    for (const method of requirements.methods) {
      if (typeof adapter[method] !== "function") {
        throw new DomainAdapterValidationError(`capability ${capability} requires method ${method}`);
      }
    }
  }
}

export function validateDomainAdapter(adapter) {
  if (!adapter || typeof adapter !== "object" || Array.isArray(adapter)) throw new DomainAdapterValidationError("adapter must be an object");
  if (adapter.schemaVersion !== DOMAIN_ADAPTER_SCHEMA_VERSION) throw new DomainAdapterValidationError(`adapter must use schema v${DOMAIN_ADAPTER_SCHEMA_VERSION}`);
  if (!nonEmptyString(adapter.domainId)) throw new DomainAdapterValidationError("domainId is required");
  if (!Number.isInteger(adapter.version) || adapter.version < 1) throw new DomainAdapterValidationError("version must be a positive integer");
  if (!nonEmptyString(adapter.label)) throw new DomainAdapterValidationError("label is required");
  if (!adapter.bindings || typeof adapter.bindings !== "object" || Array.isArray(adapter.bindings)) throw new DomainAdapterValidationError("bindings must be an object");
  for (const binding of DOMAIN_ADAPTER_REQUIRED_BINDINGS) {
    if (!nonEmptyString(adapter.bindings[binding])) throw new DomainAdapterValidationError(`binding ${binding} is required`);
  }
  for (const method of DOMAIN_ADAPTER_REQUIRED_METHODS) {
    if (typeof adapter[method] !== "function") throw new DomainAdapterValidationError(`method ${method} is required`);
  }
  validateCapabilities(adapter);
  return adapter;
}

export function domainAdapterSupports(adapter, capability) {
  if (!DOMAIN_ADAPTER_CAPABILITIES.includes(capability)) throw new DomainAdapterValidationError(`unknown capability ${capability}`);
  validateDomainAdapter(adapter);
  return adapter.capabilities?.[capability] === true;
}

export function defineDomainAdapter(adapter) {
  validateDomainAdapter(adapter);
  const capabilities = Object.fromEntries(
    DOMAIN_ADAPTER_CAPABILITIES.map((capability) => [capability, adapter.capabilities?.[capability] === true])
  );
  return Object.freeze({
    ...adapter,
    bindings: Object.freeze({ ...adapter.bindings }),
    capabilities: Object.freeze(capabilities)
  });
}
