# ME20-SIM Tutor Simulation Harness

This directory contains synthetic learner QA for the Cancellation Hearts Tutor. It exercises the same Hearts Domain Adapter, Adaptive Trainer execution pipeline, Assessment Core, and Calibration Core boundaries used by the application.

Synthetic simulation is **not learner evidence**. Every simulated record is tagged `source: synthetic-simulation`; runtime journeys use isolated in-memory stores; assessment evidence is cloned with `learnerModel:false` and `calibration:false` before it is offered to calibration; CI requires the Calibration Core to reject every synthetic assessment record.

## Commands

```bash
node --experimental-default-type=module simulation/cli.mjs --mode regression --seed 20260911
node --experimental-default-type=module simulation/cli.mjs --mode placement --seed 20260911
node --experimental-default-type=module simulation/cli.mjs --mode passing --seed 20260911
node --experimental-default-type=module simulation/cli.mjs --mode advanced --seed 20260911
node --experimental-default-type=module simulation/cli.mjs --mode alternative --seed 20260911
node --experimental-default-type=module simulation/cli.mjs --mode batch --learners 100 --hands 2 --seed 20260911 --write-report
```

`regression` runs permanent known Tutor failures. `passing` probes strategic pass reasoning and post-pass revision. `advanced` probes moon-threat thresholds, minimum intervention, observation, targeting, cancellation, and carryover reasoning. `alternative` measures whether known strong or defensible pathways are incorrectly rejected. `batch` runs full synthetic journeys beginning with the real five-hand Assessment Core diagnostic.

The latest compact machine-readable and human-readable batch reports are written to `simulation/results/latest.json` and `simulation/results/latest.md` when `--write-report` is supplied.

## Personas

The harness includes trick-by-trick beginners, learners with good instincts but weak explanations, developing planners with weak contingency reasoning, over-controllers, advanced over-targeters, moon-defense overreactors, strong players with weak passing, expert-like players, overconfident experts, and cautious/incomplete learners.

## Evaluation dimensions

The Tutor is checked for grounding, listening, inference discipline, answer/reasoning separation, specificity, minimal intervention, pathway coherence, adaptive scaffolding, progression quality, passing quality, advanced table reasoning, transfer, and rejection of defensible alternatives.

Simulation metrics are QA signals only. They must never be promoted into empirical calibration artifacts or treated as real learner-performance statistics.
