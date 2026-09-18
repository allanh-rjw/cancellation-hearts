# cancellation-hearts
Cancellation Hearts is an eight-player, two-deck strategy game where identical cards cancel. Play against seven computer opponents, use built-in coaching, analyze hands and opponents, practice solo or two-player moon attempts, and master passing, voids, lead control, scoring, and advanced tactics.

## Opponent diagnostics

Run `node scripts/diagnose-standard-opponent-ai.mjs` to compare the current Expert opponent policy with the pre-strategy legacy policy on deterministic paired deals. The harness swaps team seats, covers hold play and the full eight-hand passing cycle, and reports strategy, pathway, tactical, outcome, and 95% confidence-interval metrics as JSON.

Use `node scripts/diagnose-standard-opponent-ai.mjs --verify` for the smaller deterministic regression gate used by CI. `--deals=N` controls the number of paired deals. `--cycle=hold|passing|full` selects hold hands, rotating passing offsets, or the complete cycle; `--seed-base=N` supports independent campaigns.

The diagnostic enables behavior-neutral opponent decision traces and a deterministic greedy shadow selector. Its JSON report compares policy agreement, immediate risk, safe-exit use, cancellation exposure, and carried-penalty exposure by trick, persona, strategy, pass direction, and seat. Ordinary games leave this instrumentation disabled.
