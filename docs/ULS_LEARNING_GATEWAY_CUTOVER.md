# Cancellation Hearts ULS Learning Gateway cutover

Status: production Gateway default with explicit migration rollback paths.

## Existing app seams retained

The application remains authoritative for game execution and presentation.

- `app.js` owns live game state, legality, scoring, CPU play, rendering, and pacing.
- `legalCards(playerIndex)` remains the sole application legality source.
- `playCard(playerIndex, card)` remains the execution boundary. The Gateway sidecar captures learner-visible decision context before a learner card mutates state, then submits `evaluate-play` asynchronously.
- `causal-loader.js` continues to load the adaptive Tutor, Assessment, Calibration, and reasoning stack.
- `scripts/verify-production-domain-pack-integration.mjs` remains the real app-to-production-Domain-Pack conformance harness and rule-boundary authority.

## Production learning boundary

`learning-gateway-client.mjs` owns only the browser-facing service boundary:

```text
POST /v1/domains/cancellation-hearts/{operation}
```

It:

- projects live app state into the established `learner-observable` schema;
- never includes opponent hidden hands, persona truth, CPU private state, account identity, learner identity, Supabase secrets, or Domain Runtime service credentials;
- maps operation-specific inputs for the twelve Cancellation Hearts Domain Runtime operations;
- uses the existing browser/Cloudflare Access session through normal credentialed requests;
- normalizes bounded Gateway failures.

`learning-gateway-runtime.js` supports three migration modes:

- `gateway`: canonical production learning path and default;
- `legacy`: explicit rollback/debug-only path;
- `parity`: explicit validation path that runs both implementations and compares learner-visible semantics.

The plain application URL defaults to `gateway`. A temporary query override may select `?learningMode=legacy|gateway|parity`; `CancellationHeartsLearningRuntime.setMode(...)` may also persist an explicit operator/developer override in local storage. These overrides are migration controls, not equal production architectures.

The Gateway base URL defaults to same-origin. Deployment may set either the `uls-learning-gateway-base-url` meta value or `window.CANCELLATION_HEARTS_GATEWAY_BASE_URL`. Neither mechanism may contain service credentials.

## Operations

The sidecar maps:

- `assess-hand`
- `recommend-strategy`
- `rejected-strategies`
- `recommend-passing`
- `recommend-play`
- `detect-pivot`
- `moon-defense`
- `analyze-opponents`
- `post-hand`
- `post-game`
- `evaluate-play`
- `next-activity`

`evaluate-play` captures learner-visible state and the legal-action set before `playCard` mutates live game state. Realized future outcome is deliberately not sent by the app and therefore cannot rewrite decision quality.

## Production architecture

```text
Browser
  -> Cloudflare Access
  -> ULS Learning Gateway
  -> ULS entitlement check
  -> external Cancellation Hearts Domain Runtime
  -> canonical ULS Assessment / Calibration / Learner Model / Training Decision persistence
```

The app owns game state and learner-visible projection. The Domain Pack owns Cancellation Hearts semantics and operation implementation. ULS owns canonical identity, entitlement, learning execution, Assessment, Calibration, Learner Model, Training Decisions, persistence, and provenance. Cloudflare owns perimeter authentication.

## Regression and rollback boundary

CI protects:

1. ordinary browser startup under the production Gateway default;
2. explicit `legacy`, `gateway`, and `parity` overrides;
3. Start New Game stability and lazy Tutor initialization;
4. real Gateway dispatch from the plain production-default path;
5. real Gateway dispatch from parity mode;
6. Gateway request/failure and learner-visible boundaries;
7. all twelve operation mappings and semantic parity normalization;
8. the real production Domain Pack integration harness.

Legacy remains temporarily available only as a rollback/debug path and parity oracle. It is not the normal production learning runtime. Hard deletion is deferred until parity/rollback dependencies can be removed mechanically without weakening regression coverage.
