# ME21 Canonical Gameplay Campaign

Generated: 2026-09-13T01:15:09.690Z  
Candidate SHA: `24f9994f20e75ba720a8b827d585e7448cd1c3dc`  
Canonical workflow run: `34730043960`

## Coverage

- Standard hands: 1000/1000
- Complete games: 100/100
- Solo moon practice: 500/500
- Two-player moon practice: 500/500
- Tutor-enabled hands: 500/500
- Tutor recommendations checked: 6371
- Total failure clusters: 0

## Standard Game

Difficulty coverage was exactly balanced: Easy 250, Medium 250, Hard 250, Expert 250.

All eight pass-cycle states were exercised 125 times each.

Persona observations:

- The Minimalist: 936
- The Enforcer: 1048
- The Canceller: 968
- The Opportunist: 1016
- The Suit Engineer: 976
- The Hunter: 1008
- The Moonshot: 1048

No Standard Game failures were recorded.

## Complete Games

All 100 games completed.

Score-limit coverage:

- 100: 34 games
- 150: 33 games
- 200: 33 games

Hands per game:

- Minimum: 6
- Maximum: 24
- Mean: 13.69

No game-termination failures were recorded.

## Shoot-the-Moon Practice

Solo outcomes:

- Success: 118
- Broken: 382
- Failed at end: 0

Two-player outcomes:

- Success: 173
- Broken: 325
- Failed at end without completing the joint moon: 2

All 1000 Practice scenarios terminated correctly. The two two-player end-of-hand failures are legitimate failed moon attempts, not simulation or state-machine defects.

Starting-strength coverage was balanced across the four presets: 250 each for Ridiculously Strong, Strong, Solid, and Marginal.

## Tutor-in-context

- Hands: 500
- Recommendations checked against live gameplay state: 6371
- Pathways checked: 6371
- Failures: 0

Strategy coverage:

- Avoidance: 233 hands
- Targeting: 187 hands
- Two-player moon: 67 hands
- Cancellation: 9 hands
- Solo moon: 4 hands

## Synthetic-data isolation

- `calibrationEligible = 0`
- `learnerModelEligible = 0`
- `productionStateTouched = false`

## ME21 defect record

ME21 exposed genuine production defects during development, including same-seat double-2♣ opening/late-hand handling, Shoot-the-Moon Practice terminal success behavior, and final-trick no-winner penalty-pot accounting. The final candidate uses the current production implementations and retains deterministic regressions for the relevant invariants.

Several apparent failures were classified as S0 harness defects rather than production defects, including an obsolete same-seat double-2♣ repair assumption, an invalid synthetic score-limit fixture, Coach reachability testing before activating/scrolling the relevant tab, and a transient asynchronous parity-observation flake. Production rules were not weakened to satisfy those fixtures.

## Limitations

This campaign demonstrates deterministic/synthetic game, state-machine, Practice, UI-regression, and Tutor-in-context QA. It does not establish empirical human strategic quality, empirical Tutor learning effectiveness, or exhaustive cross-browser/cross-device usability.

## Status

**ACCEPTED**
