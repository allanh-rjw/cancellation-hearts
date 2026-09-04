import { DOMAIN_ADAPTER_SCHEMA_VERSION, defineDomainAdapter } from "./domain-adapter.js";

const legacy = window.CancellationHeartsTutorAdapter;
if (!legacy) throw new Error("Cancellation Hearts domain adapter requires hearts-tutor-adapter.js");

export const CANCELLATION_HEARTS_DOMAIN_ID = "cancellation-hearts";
export const CANCELLATION_HEARTS_DOMAIN_ADAPTER_VERSION = 1;

function curatedProblems() {
  const candidates = [0, 1].map((totalInteractions) => legacy.selectExercise({ selfLevel: "beginner", totalInteractions }));
  const seen = new Set();
  return candidates.filter((p) => p && p.id && !seen.has(p.id) && seen.add(p.id));
}

function validCardCode(code) {
  return /^(?:[2-9]|10|[JQKA])[CDSH]$/.test(String(code || ""));
}

function problemIdFor(problem, step) {
  return `${problem.id}:${step?.id || "attempt"}`;
}

function canonicalDiagnosis(problem, step, legacyResult = {}) {
  const d = legacyResult.diagnosis || {};
  const score = Math.max(0, Math.min(1, Number.isFinite(legacyResult.score) ? legacyResult.score : 0.5));
  const gradeable = legacyResult.gradeable !== false;
  const structureStatus = !gradeable ? "not-demonstrated" : score >= 0.58 ? "sound" : "divergent";
  const answerStatus = !gradeable ? "unresolved" : score >= 0.78 ? "correct" : score >= 0.5 ? "partially-correct" : "incorrect";
  const reasoningStatus = !gradeable ? "insufficient-evidence" : score >= 0.82 ? "expert-like" : score >= 0.58 ? "mostly-sound-with-answer-error" : "faulty";
  return Object.freeze({
    problemId: problem.id,
    stepId: step?.id || null,
    score,
    skills: Object.freeze([...(legacyResult.skills || [])]),
    flags: Object.freeze([...(legacyResult.flags || [])]),
    gradeable,
    answerAssessment: Object.freeze({ status: answerStatus }),
    reasoningAssessment: Object.freeze({ status: reasoningStatus }),
    reasoningStructureAssessment: Object.freeze({
      requestScope: "targeted",
      stages: Object.freeze([{ id: step?.id || "attempt", status: structureStatus }])
    }),
    evidence: Object.freeze({
      correct: d.correct || null,
      incorrect: d.incorrect || d.correction || null,
      observed: d.recognized || null,
      missing: d.missing || null,
      ambiguous: d.ambiguous || null,
      nextQuestion: d.nextQuestion || null
    })
  });
}

function learnerCoaching(problem, diagnosis) {
  const e = diagnosis.evidence || {};
  const acknowledgement = e.correct || e.observed || (diagnosis.answerAssessment.status === "correct" ? "That conclusion is supported by this hand." : "I can evaluate the part of the answer you stated.");
  const correction = e.incorrect || "";
  const missing = e.missing || "";
  const ambiguity = e.ambiguous || "";
  const prompt = e.nextQuestion || "Explain what in this hand supports your answer.";
  return Object.freeze({
    problemId: problem.id,
    move: diagnosis.gradeable ? "evidence-feedback" : "diagnostic-probe",
    scaffoldLevel: "minimal",
    retryRequired: !diagnosis.gradeable,
    acknowledgement,
    correction,
    improvementNote: [correction, missing, ambiguity].filter(Boolean).join(" "),
    prompt,
    focus: diagnosis.stepId ? Object.freeze({ componentId: diagnosis.stepId, category: "reasoning", importance: "major", prompt }) : null,
    strategyAdjustment: null
  });
}

function diagnosticInquiry(problem, diagnosis) {
  if (diagnosis.gradeable && !diagnosis.evidence?.ambiguous) return null;
  const prompt = diagnosis.evidence?.nextQuestion || "What in this hand made you choose that answer?";
  return Object.freeze({
    schemaVersion: 1,
    policy: "probe-before-unverified-causal-remediation",
    inquiryId: `hearts:${problem.id}:${diagnosis.stepId || "attempt"}:clarify`,
    problemId: problem.id,
    status: "probe-required",
    probeMode: "targeted-clarification",
    probeDepth: 0,
    maxProbeDepth: 2,
    target: Object.freeze({ componentId: diagnosis.stepId || "attempt", category: "reasoning", importance: "major" }),
    evidenceBasis: Object.freeze(["learner-response-insufficient-to-establish-reasoning"]),
    candidateHypotheses: Object.freeze([
      Object.freeze({ hypothesisId: "sound-reasoning", label: "The conclusion is supported by a sound hand-specific reason." }),
      Object.freeze({ hypothesisId: "guess-or-different-reason", label: "The conclusion was guessed or follows from a different, potentially faulty reason." })
    ]),
    learnerFacing: Object.freeze({
      acknowledgement: diagnosis.evidence?.correct || diagnosis.evidence?.observed || "I can evaluate the conclusion you gave, but not yet the reason behind it.",
      prompt,
      actionLabel: "Explain your reasoning"
    })
  });
}

function learnerModelFromEvents(events = []) {
  const attempts = events.filter((e) => e && e.type === "attempt-assessed");
  const bySkill = {};
  for (const event of attempts) {
    if (event.gradeable === false) continue;
    for (const skill of event.skills || []) {
      const row = bySkill[skill] || { total: 0, count: 0 };
      row.total += event.score;
      row.count += 1;
      bySkill[skill] = row;
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    attempts: attempts.length,
    skills: Object.freeze(Object.fromEntries(Object.entries(bySkill).map(([skill, row]) => [skill, Object.freeze({ mastery: row.count ? row.total / row.count : 0.5, evidence: row.count })])))
  });
}

export const cancellationHeartsDomainAdapter = defineDomainAdapter({
  schemaVersion: DOMAIN_ADAPTER_SCHEMA_VERSION,
  domainId: CANCELLATION_HEARTS_DOMAIN_ID,
  version: CANCELLATION_HEARTS_DOMAIN_ADAPTER_VERSION,
  label: "Cancellation Hearts",
  capabilities: { assessment: false, calibration: false, trainingRuntime: false },
  bindings: {
    knowledgeGraph: "hearts-strategy-concepts",
    problemFamilyRegistry: "hearts-curated-and-transfer-hands",
    expertModelProvider: "hearts-expert-hand-model",
    truthVerifier: "hearts-hand-and-rule-verifier",
    responseInterpreter: "hearts-structured-response-diagnosis",
    representationProvider: "hearts-card-hand-ui",
    languageProvider: "hearts-domain-coaching-language",
    diagnosticInquiryProvider: "hearts-reasoning-clarification"
  },

  listProblems() { return curatedProblems(); },

  problemForId(problemId) { return curatedProblems().find((p) => p.id === problemId) || null; },

  verifyProblem(problem) {
    const valid = Boolean(problem && problem.id && Array.isArray(problem.hand) && problem.hand.length === 13 && problem.hand.every(validCardCode));
    return Object.freeze({ status: valid ? "verified" : "rejected", problemId: problem?.id || null, verifier: "cancellation-hearts-domain-adapter-v1" });
  },

  assessAttempt({ problem, response, context = {} }) {
    const step = context.step;
    if (!step) throw new Error("Cancellation Hearts assessment requires the active tutor step in context.step");
    const legacyResult = legacy.evaluate(step, response, { ...context, exercise: problem }, context.profile || {});
    const diagnosis = canonicalDiagnosis(problem, step, legacyResult);
    const coaching = learnerCoaching(problem, diagnosis);
    return Object.freeze({ diagnosis, coaching, legacyResult });
  },

  buildDiagnosticInquiry({ problem, diagnosis }) { return diagnosticInquiry(problem, diagnosis); },

  buildLearnerModel({ events = [] } = {}) { return learnerModelFromEvents(events); },

  selectNextExperience({ problem, diagnosis, learnerModel, context = {} }) {
    const needClarification = diagnosis.gradeable === false;
    return Object.freeze({
      type: needClarification ? "diagnostic-clarification" : diagnosis.score >= 0.82 ? "scaffold-fade" : diagnosis.score < 0.5 ? "guided-repair" : "continue-pathway",
      problemId: problem.id,
      stepId: diagnosis.stepId,
      learnerLevel: context.profile?.selfLevel || null,
      learnerModel
    });
  }
});
