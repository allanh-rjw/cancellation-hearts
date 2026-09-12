# Expanded Gameplay Simulation Packet — 2026-09-12

Purpose: run a wider deterministic sample against the merged Standard game and Shoot-the-Moon Practice behavior without changing gameplay logic.

Coverage expansion:
- Standard: 8 deterministic seeds per Easy/Medium/Hard/Expert difficulty, 2 hands each;
- Shoot-the-Moon Practice: 16 deterministic seeds per strength for Solo and Two-player modes;
- existing 8-hand pass-cycle test retained;
- existing compact 1024x768 coverage retained;
- existing forced Solo and Two-player moon success checks retained;
- existing final-trick full-cancellation rule checks retained.

The existing hard gates remain unchanged:
- monotonic Practice strength ladders;
- Ridiculously Strong to Marginal separation >= 50 percentage points;
- no successful-but-nonterminal Practice cases;
- no material moon lead-forecast mismatches;
- no center-action/card collisions;
- Standard and Tutor regressions remain green.
