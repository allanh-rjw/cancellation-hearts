# Cancellation Hearts Tutor Simulation Report

Generated: 2026-09-12T16:20:07.429Z
Source: synthetic-simulation

## Executive summary

- Learners simulated: 100
- Seed: 20260911
- Exact placement accuracy: 47%
- Within-one-level placement accuracy: 96%
- Valid defensible-path rejection rate: 0%
- Passing packet: pass
- Advanced-strategy packet: pass
- Synthetic calibration observations admitted: 0
- Synthetic learner-model records admitted: 0
- Production state touched: no

## Placement

```json
{
  "beginner": {
    "beginner": 20
  },
  "developing": {
    "advanced": 1,
    "developing": 15,
    "beginner": 14
  },
  "advanced": {
    "developing": 26,
    "expert": 1,
    "advanced": 2,
    "beginner": 1
  },
  "expert": {
    "expert": 10,
    "advanced": 7,
    "developing": 3
  }
}
```

## Tutor behavior
- grounding: 100% (1604/1604)
- listening: 100% (1604/1604)
- inference-discipline: 100% (1604/1604)
- answer-reasoning-separation: 100% (1604/1604)
- specificity: 100% (1604/1604)
- minimal-intervention: 100% (1604/1604)
- pathway-coherence: 100% (1604/1604)
- adaptive-scaffolding: 100% (1604/1604)
- progression-quality: 100% (1604/1604)
- passing-quality: 100% (1604/1604)
- advanced-table-reasoning: 100% (1604/1604)
- transfer: 100% (1604/1604)

## Strategy packets

- Passing: passed.
- Advanced moon/observation/targeting: passed.
- Valid alternative rejection rate: 0%.

## Highest-priority recurring failures
No recurring deterministic failures found in this batch.

## Isolation guarantee

Synthetic evidence is tagged `synthetic-simulation`, uses isolated in-memory runtime stores, is cloned with learner-model and calibration eligibility disabled, and is expected to be rejected by the Calibration Core.

## Interpretation

Simulation is QA evidence, not empirical learner evidence. Placement and calibration conclusions must still be validated with real-user data.
