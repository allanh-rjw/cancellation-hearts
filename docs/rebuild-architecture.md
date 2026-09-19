# Cancellation Hearts Clean Rebuild

## Goal

Replace the current layered gameplay implementation with one deterministic game engine that owns all rules and state transitions. UI, AI, coaching, practice modes, and access control consume the engine; none may redefine gameplay legality or scoring.

The existing production app remains on `main` until the rebuild passes the acceptance gates below. The rebuild is developed on `rebuild-clean-engine` and will replace, not coexist with, the old gameplay implementation when promoted.

## Non-negotiable architecture

### Core engine

Pure JavaScript modules under `src/game/` own:

- deck construction and card identity;
- dealing and passing;
- phase/state transitions;
- opening leader resolution;
- legal-card calculation;
- card play validation;
- cancellation and trick resolution;
- carryover points;
- hand scoring;
- solo and two-player moon scoring;
- dealer/pass rotation;
- losing-score game completion.

The core engine has no DOM access, timers, sound, network calls, tutor calls, or access-control code.

### UI

The browser UI may only:

- render canonical engine state;
- ask the engine for legal actions;
- submit player actions to the engine;
- schedule presentation delays around already-resolved state transitions.

The UI may never calculate legal cards, winners, points, opening leaders, or moon outcomes independently.

### Opponent AI

Opponent strategy chooses among actions already declared legal by the engine. Difficulty/persona logic cannot redefine legality or scoring.

### Tutor/coach

The tutor receives snapshots/events from the engine. It may recommend actions, explain strategy, and analyze opponents, but cannot mutate gameplay rules.

### Access/ULS

Access and ULS integration sit outside the game engine. Authorization may lock or unlock the app, but never alter game state or rules.

## Canonical opening sequence

Opening play is a state-machine invariant, not a UI convention:

1. A two-deck hand must contain exactly two physical `2♣` cards.
2. Passing may move either or both `2♣` cards.
3. After passing completes, the first player clockwise from the dealer who holds at least one `2♣` becomes the immutable opening leader for that hand.
4. The first physical card played must be exactly one `2♣` from that player.
5. A player holding both copies plays one and retains the other.
6. Any later player holding a `2♣` when reached on the opening trick must play exactly one.
7. Each seat contributes exactly one card to the trick.
8. Other players must follow clubs when able.
9. A player void in clubs may play a diamond or a non-queen spade.
10. Hearts and `Q♠` are illegal on the opening trick.
11. If a post-pass hand has no legal opening card because it contains only hearts and `Q♠`, the hand is redealt before play begins.

The opening leader is stored in state when the opening phase begins. It is never recomputed from hands after cards start leaving hands.

## Other canonical rules retained

- Eight players, two standard decks, thirteen cards per player.
- Hearts are one penalty point each; each `Q♠` is thirteen penalty points.
- Identical cards cancel.
- Highest uncancelled card in the led suit wins a normal trick.
- If the entire led suit cancels before the final trick, the trick has no winner, points carry forward, and the same player leads again.
- Final-trick full cancellation splits all unresolved penalty points between the players who played the highest-ranked cancelling pair; odd remainder goes to the earlier play.
- Hearts break only when a heart is discarded off-suit.
- Passing pattern: `1L, 1R, 2L, 2R, 3L, 3R, across, hold`.
- Solo moon: one player takes all 52 penalty points; shooter receives 0 and every other player receives 104.
- Two-player moon: exactly two players collectively take all 52; both receive 0 and every other player receives 26.
- Losing-score thresholds: 100, 150, or 200.

## Rebuild acceptance gates

### Gate A: engine foundation

- Card/deck identity is deterministic and totals 104 unique cards.
- Deal conserves all cards with thirteen per player.
- Passing conserves all cards.
- Opening sequence passes exhaustive/randomized tests, including both `2♣` in one hand and split across two hands.
- Illegal opening actions cannot mutate state.

### Gate B: complete gameplay engine

- Cancellation, trick winners, carryover, final cancellation split, hearts breaking, moon scoring, pass/dealer rotation, and game completion all pass deterministic tests.
- Card conservation holds across complete hands and games.
- No second legal-play or scoring implementation exists.

### Gate C: opponent engine

- Easy/Medium/Hard/Expert and personas choose only from canonical legal actions.
- Strategic behavior reuses tutor concepts without duplicating rules.
- Multi-hand simulations complete without illegal actions or card/state corruption.

### Gate D: browser app

- Browser UI renders only canonical state and submits actions to the engine.
- Opening play is verified across randomized browser sessions.
- Coach-open/closed trick pacing works without modifying gameplay state.
- Existing score/settings/persona controls and responsive layout are restored.

### Gate E: tutor/practice/integration

- Standard game, solo moon practice, and two-player moon practice reuse the same core engine.
- Tutor/coach, ULS gateway, and centralized access are reattached through explicit boundaries.
- Production acceptance browser suite covers every major learner/game workflow.

### Gate F: migration

- Old gameplay override files are removed from the production load path.
- New engine becomes the only gameplay authority.
- Production is switched only after complete browser and simulation acceptance passes.
