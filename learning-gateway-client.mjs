const DOMAIN_ID = "cancellation-hearts";
const MODES = Object.freeze(["legacy", "gateway", "parity"]);
const DISPOSITIONS = new Set(["completed", "unsupported", "abstained"]);
export const LEARNING_OPERATIONS = Object.freeze([
  "assess-hand",
  "recommend-strategy",
  "rejected-strategies",
  "recommend-passing",
  "recommend-play",
  "detect-pivot",
  "moon-defense",
  "analyze-opponents",
  "post-hand",
  "post-game",
  "evaluate-play",
  "next-activity"
]);

export class LearningGatewayError extends Error {
  constructor(code, message, { status = null, retryable = false } = {}) {
    super(message);
    this.name = "LearningGatewayError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function observableCard(card) {
  if (!card || typeof card !== "object") throw new TypeError("card must be an object");
  return Object.freeze({
    ...(card.id ? { id: String(card.id) } : {}),
    code: `${card.rank}${card.suit}`,
    rank: card.rank,
    suit: card.suit
  });
}

export function normalizeMigrationMode(value, fallback = "legacy") {
  return MODES.includes(value) ? value : fallback;
}

export function adaptLearnerVisibleState(state, learnerSeat = 0) {
  if (!Array.isArray(state?.players) || state.players.length !== 8) {
    throw new TypeError("Cancellation Hearts requires exactly eight players");
  }
  if (!Number.isInteger(learnerSeat) || learnerSeat < 0 || learnerSeat >= state.players.length) {
    throw new TypeError("learnerSeat is outside the table");
  }
  const learner = state.players[learnerSeat];
  const players = state.players.map((player, seat) => Object.freeze({
    seat,
    name: player.name,
    score: player.score,
    roundPoints: player.roundPoints,
    cardCount: Array.isArray(player.hand) ? player.hand.length : 0,
    trickCount: Array.isArray(player.tricks) ? player.tricks.length : 0
  }));
  const observedActions = (state.actionLog ?? []).flatMap((action) => (
    action?.card && Number.isInteger(action.player)
      ? [Object.freeze({
          seat: action.player,
          card: observableCard(action.card),
          trickNumber: Number.isInteger(action.trickNumber) ? action.trickNumber : null
        })]
      : []
  ));
  return Object.freeze({
    schemaVersion: 1,
    informationBoundary: "learner-observable",
    learnerSeat,
    learnerHand: (learner.hand ?? []).map(observableCard),
    players,
    dealer: state.dealer,
    round: state.round,
    target: state.target,
    difficulty: state.difficulty,
    currentPlayer: state.currentPlayer,
    leader: state.leader,
    currentTrick: (state.trick ?? []).map((entry) => Object.freeze({
      seat: entry.player,
      card: observableCard(entry.card),
      cancelled: entry.cancelled === true
    })),
    trickNumber: state.trickNumber,
    heartsBroken: state.heartsBroken,
    phase: state.phase,
    passOffset: state.passOffset,
    carryoverPoints: state.carryoverPoints ?? 0,
    activeStrategy: state.coachStrategy ?? null,
    originalStrategy: state.originalStrategy ?? null,
    strategyPivots: [...(state.strategyPivots ?? [])],
    mode: state.mode ?? "standard",
    practiceType: state.practiceType ?? "solo",
    practiceStrength: state.practiceStrength ?? "strong",
    partnerIndex: state.partnerIndex ?? null,
    observedActions
  });
}

function optional(input, key, value) {
  return value == null ? input : { ...input, [key]: value };
}

export function buildOperationInput(operation, context = {}) {
  if (!LEARNING_OPERATIONS.includes(operation)) throw new TypeError(`Unsupported app operation: ${operation}`);
  switch (operation) {
    case "recommend-passing":
      return optional({}, "strategy", context.strategy);
    case "recommend-play": {
      let input = { legalCards: (context.legalCards ?? []).map(observableCard) };
      input = optional(input, "strategy", context.strategy);
      input = optional(input, "weights", context.weights);
      return input;
    }
    case "detect-pivot":
      return optional({}, "strategy", context.strategy);
    case "evaluate-play": {
      let input = {
        legalCards: (context.legalCards ?? []).map(observableCard),
        chosenCardCode: String(context.chosenCardCode ?? "")
      };
      input = optional(input, "strategy", context.strategy);
      input = optional(input, "weights", context.weights);
      return input;
    }
    case "next-activity":
      return {
        targetSkillId: String(context.targetSkillId ?? ""),
        seed: String(context.seed ?? "")
      };
    default:
      return {};
  }
}

function failureCode(status, body) {
  const code = record(body)?.code;
  if (typeof code === "string") return code;
  if (status === 401) return "authentication-required";
  if (status === 403) return "authorization-denied";
  if (status === 400) return "invalid-request";
  return "gateway-unavailable";
}

function failureMessage(code) {
  return ({
    "authentication-required": "Your learning session is not authenticated.",
    "authorization-denied": "Your account is not entitled to this learning service.",
    "configuration-unavailable": "The learning service is not configured.",
    "readiness-unavailable": "The learning service is not ready.",
    "runtime-unavailable": "The Cancellation Hearts learning runtime is unavailable.",
    "persistence-unavailable": "The learning service could not save this result.",
    "invalid-request": "The learning request was rejected.",
    "not-found": "The requested learning operation is unavailable."
  })[code] ?? "The learning service is unavailable.";
}

async function responseBody(response) {
  const type = response.headers?.get?.("content-type") ?? "";
  if (!type.includes("application/json")) return null;
  try { return await response.json(); } catch { return null; }
}

function endpoint(baseUrl, operation) {
  const base = String(baseUrl ?? "").replace(/\/$/, "");
  return `${base}/v1/domains/${DOMAIN_ID}/${encodeURIComponent(operation)}`;
}

function requestId(prefix, idFactory) {
  return `${prefix}:${idFactory()}`.replace(/[^A-Za-z0-9._:-]/g, "-").slice(0, 128);
}

export function validateGatewayResult(value, operation) {
  const result = record(value);
  if (!result || result.domainId !== DOMAIN_ID || result.operation !== operation) {
    throw new LearningGatewayError("malformed-response", "Gateway response identity is invalid");
  }
  if (!DISPOSITIONS.has(result.disposition)) {
    throw new LearningGatewayError("malformed-response", "Gateway response disposition is invalid");
  }
  return result;
}

export function createLearningGatewayClient({
  baseUrl = "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 8000,
  idFactory = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation is required");
  return Object.freeze({
    async execute(operation, learnerVisibleState, operationInput = {}) {
      if (!LEARNING_OPERATIONS.includes(operation)) throw new TypeError(`Unsupported app operation: ${operation}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint(baseUrl, operation), {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-request-id": requestId("app", idFactory),
            "x-correlation-id": requestId("app-correlation", idFactory)
          },
          body: JSON.stringify({ learnerVisibleState, operationInput })
        });
        const body = await responseBody(response);
        if (!response.ok) {
          const code = failureCode(response.status, body);
          throw new LearningGatewayError(code, failureMessage(code), {
            status: response.status,
            retryable: response.status >= 500
          });
        }
        return validateGatewayResult(body, operation);
      } catch (error) {
        if (error instanceof LearningGatewayError) throw error;
        if (error?.name === "AbortError") {
          throw new LearningGatewayError("gateway-timeout", "The learning service timed out.", { retryable: true });
        }
        throw new LearningGatewayError("gateway-unavailable", "The learning service is unavailable.", { retryable: true });
      } finally {
        clearTimeout(timeout);
      }
    }
  });
}

function codeOf(value) {
  return value?.card?.code ?? value?.code ?? null;
}

export function semanticOutput(operation, value) {
  const raw = record(value)?.disposition ? (value.output ?? value.activityResult ?? null) : value;
  switch (operation) {
    case "assess-hand":
      return raw ? { strategy: raw.strategy, summary: raw.summary } : null;
    case "recommend-strategy":
      return raw ?? null;
    case "rejected-strategies":
      return Array.isArray(raw) ? raw.map((row) => row.strategy ?? row.label ?? null) : [];
    case "recommend-passing":
      return raw ? {
        primary: (raw.primary ?? []).map(codeOf),
        secondary: (raw.secondary ?? []).map(codeOf)
      } : null;
    case "recommend-play":
      return raw ? {
        recommended: codeOf(raw.recommended),
        alternatives: (raw.alternatives ?? []).map(codeOf)
      } : null;
    case "detect-pivot":
      return raw ? { needed: Boolean(raw.needed), from: raw.from ?? null, to: raw.to ?? null } : null;
    case "moon-defense":
      return raw ? { required: Boolean(raw.required), objective: raw.objective ?? null } : null;
    case "analyze-opponents":
      return Array.isArray(raw) ? raw.map((row) => ({ seat: row.seat, name: row.name })) : [];
    case "post-hand":
      return raw ? { originalStrategy: raw.originalStrategy ?? null, pivotNeeded: Boolean(raw.pivot?.needed) } : null;
    case "post-game":
      return raw ? { placement: raw.placement ?? null, learnerScore: raw.learnerScore ?? null } : null;
    case "evaluate-play":
      return raw ? {
        recommendedCardCode: raw.recommendedCardCode ?? null,
        chosenCardCode: raw.chosenCardCode ?? null,
        chosenDecisionScore: raw.chosenDecisionScore ?? null,
        ambiguous: Boolean(raw.ambiguous),
        realizedOutcomeUsedForScoring: raw.realizedOutcomeUsedForScoring === true
      } : null;
    case "next-activity":
      return raw ? { familyId: raw.familyId ?? null, targetSkillId: raw.targetSkillId ?? raw.skillId ?? null } : null;
    default:
      return raw;
  }
}

export function compareSemanticOutputs(operation, legacyValue, gatewayValue) {
  const legacy = semanticOutput(operation, legacyValue);
  const gateway = semanticOutput(operation, gatewayValue);
  return Object.freeze({
    operation,
    equal: JSON.stringify(legacy) === JSON.stringify(gateway),
    legacy,
    gateway
  });
}

export function publicGatewayResult(result) {
  const value = validateGatewayResult(result, result.operation);
  return Object.freeze({
    operation: value.operation,
    disposition: value.disposition,
    output: value.output ?? null,
    activityResult: value.activityResult ?? null,
    instructionalAnnotations: value.instructionalAnnotations ?? null,
    learning: value.learning ?? null
  });
}
