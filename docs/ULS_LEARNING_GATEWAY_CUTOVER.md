# Cancellation Hearts ULS Learning Gateway cutover

Status: dual-path integration gate.

## Existing app seams retained

The integration deliberately keeps the existing application authoritative for game execution and presentation.

- `app.js` owns live game state, legality, scoring, CPU play, rendering, pacing, and the existing local coach implementation.
- `legalCards(playerIndex)` remains the sole application legality source.
- `playCard(playerIndex, card)` remains the execution boundary. The gateway sidecar captures the learner-visible decision context before a learner card mutates state, then submits `evaluate-play` asynchronously.
- Existing coach renderers remain the `legacy` path. The gateway sidecar wraps them without deleting or replacing their game-facing logic.
- `causal-loader.js` continues to load the existing adaptive tutor, assessment, calibration, and reasoning stack. It is not retired in this packet.
- `scripts/verify-production-domain-pack-integration.mjs` remains the real app-to-production-Domain-Pack conformance harness and rule-boundary authority.

## New application boundary

`learning-gateway-client.mjs` owns only the browser-facing service boundary:

```text
POST /v1/domains/cancellation-hearts/{operation}
```

It:

- projects the live app state into the established `learner-observable` schema;
- never includes opponent hidden hands, persona truth, CPU private state, account identity, learner identity, Supabase secrets, or Domain Runtime service credentials;
- maps operation-specific inputs for the twelve Cancellation Hearts Domain Runtime operations;
- uses the existing browser/Cloudflare Access session through normal credentialed requests;
- normalizes bounded gateway failures;
- exposes learner-visible semantic normalization for parity checks.

`learning-gateway-runtime.js` is the browser sidecar. It supports:

- `legacy`: existing local coach only;
- `gateway`: gateway results replace the corresponding coach result surfaces;
- `parity`: the existing local coach stays visible while both paths run and learner-visible semantics are compared.

The default remains `legacy` until real deployment and end-to-end verification are complete.

The mode can be set through `CancellationHeartsLearningRuntime.setMode(...)`, persisted in local storage, or temporarily selected with `?learningMode=legacy|gateway|parity`.

The gateway base URL defaults to same-origin. Deployment may set either the `uls-learning-gateway-base-url` meta value or `window.CANCELLATION_HEARTS_GATEWAY_BASE_URL`. Neither mechanism may contain service credentials.

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

`evaluate-play` captures the learner-visible state and legal-action set before `playCard` mutates the live game. Realized future outcome is deliberately not sent by the app and therefore cannot rewrite decision quality.

## Parity and test boundary

The app CI now verifies:

1. existing adaptive tutor smoke coverage;
2. existing diagnostic Assessment/Calibration integration;
3. gateway request, failure, and learner-visible boundary behavior;
4. all twelve operation mappings;
5. semantic parity normalization;
6. preservation of the real production Domain Pack integration harness and its rule-edge coverage.

The existing Domain Pack repository remains responsible for executing `scripts/verify-production-domain-pack-integration.mjs` against the built production Domain Pack. The app does not copy that Domain logic or its rules implementation.

## Remaining deployment gate

This branch does not claim live gateway deployment. Before switching production from `legacy`:

- deploy the ULS Learning Gateway Worker;
- deploy the Cancellation Hearts Domain Runtime Worker;
- configure Cloudflare Access, Supabase, release pins, and the ULS runtime registry;
- configure matching server-side runtime credentials;
- set the application gateway base URL or same-origin route;
- run the real app in `parity` against the deployed path;
- verify persisted Assessment Evidence, Learner Model updates, Calibration observations where emitted, Adaptive Training decisions, and failure behavior;
- only then change production mode to `gateway` and begin legacy-runtime retirement.
