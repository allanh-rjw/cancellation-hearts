# Cancellation Hearts Agent Rules

## Minimal implementation mandate

Implement the smallest clear code that completely satisfies the published rules, current product behavior, tests, and current task.

### Required

- Reuse existing code before creating new code.
- Modify an existing implementation before introducing a parallel implementation.
- Prefer pure functions and plain data structures.
- Prefer composition over inheritance.
- Reuse canonical game-state, player, trick, hand, scoring, strategy, and coaching representations directly.
- Add an abstraction only after at least two demonstrated uses require it.
- Keep gameplay rules separate from UI rendering and presentation.
- Keep coaching strategy separate from core rule enforcement.
- Keep comments focused on why a non-obvious rule exists, not what obvious code does.
- Preserve unrelated working behavior.
- Prefer deletion or simplification over wrappers and indirection when both satisfy the same requirement.
- Make the smallest viable diff that satisfies the task.

### Prohibited without concrete justification

- Base classes or abstract class hierarchies introduced for hypothetical future use.
- Manager, coordinator, factory, service, helper, adapter, or util layers that merely forward calls.
- Duplicate game-state models.
- Duplicate rule engines.
- Parallel scoring systems.
- Parallel trick-resolution logic.
- Parallel AI/persona systems when an existing strategy path can be extended.
- Wrapper functions that add no semantics.
- Speculative extension points for hypothetical future variants.
- Configuration for behavior that currently has one valid implementation.
- New dependencies when native functionality or existing dependencies already solve the requirement.
- Repo-wide refactoring as part of a bounded feature or bug fix.

### Size bias

These are defaults, not mechanical targets:

- Functions should normally be 60 lines or fewer.
- Production files should normally be 250 lines or fewer.
- Functions should normally take 4 parameters or fewer; use a typed input object when appropriate.
- Nesting should normally be 3 levels or fewer.
- Cyclomatic-style branch complexity should normally be 10 or less.

If a real requirement requires an exception, document the concrete reason rather than weakening the rule globally.

## Cancellation Hearts-specific rules

Preserve the canonical game rules already implemented, including:

- two-deck, eight-player Cancellation Hearts structure;
- both `2♣` cards participating in the opening-trick rule;
- passing sequence behavior;
- Hearts breaking rules;
- `Q♠` scoring;
- cancellation/tie behavior and point carryover;
- solo and two-player moon rules;
- configurable losing-score thresholds;
- persona behavior remaining distinct from difficulty;
- player-seat randomization where already specified;
- persistent opponent analysis and coaching behavior where already implemented.

Additional implementation rules:

- There must be one canonical authority for legal-play validation.
- There must be one canonical authority for trick resolution.
- There must be one canonical authority for hand/game scoring.
- UI components must consume canonical game state rather than recomputing game rules independently.
- Coaching may analyze game state but must not become a second gameplay engine.
- Persona logic may influence decision selection but must not redefine legal moves or scoring.
- Practice mode may constrain objectives, but it should reuse the same canonical rules wherever applicable.
- Existing code is grandfathered. Do not launch a repository-wide cleanup merely to make old code comply with this document.
- When touching an existing area, simplify it only when directly necessary for the current task.

## Execution discipline

Before editing:

1. Read this `AGENTS.md`.
2. Inspect the existing implementation relevant to the current task.
3. Identify the smallest set of files expected to change.
4. Reuse existing game-state and rule functions whenever possible.
5. Separate pre-existing failures from failures introduced by the change.

Before completion:

1. Run the relevant tests for code-changing tasks.
2. Run the repository build/typecheck/lint commands when production code, configuration, or tooling changes.
3. Exercise the affected gameplay path if practical.
4. Report files changed.
5. Report automated and manual validation performed.
6. Do not claim completion if relevant build or tests fail because of the change.

When two implementations satisfy the same behavior and tests, prefer the simpler one.

## Documentation-only packets

When the task changes only repository documentation or agent instructions:

- Do not modify production code, tests, package configuration, CI, or tooling unless the task explicitly requires it.
- Do not run unrelated build or test suites merely because documentation changed.
- Verify the requested documentation exists at the correct repository path and stop at the packet boundary.
