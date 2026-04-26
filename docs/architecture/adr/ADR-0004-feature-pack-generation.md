# ADR-0004: Feature-Pack Driven Generation and Reconfiguration

- Status: Proposed
- Date: 2026-04-26

## Context
ProOWeb must generate operational baseline capabilities (identity, auth, hierarchy, notifications, etc.) based on wizard choices and later reconfiguration.

## Decision
Generation will be organized around capability-oriented feature packs with explicit metadata:
- dependencies,
- configuration schema,
- managed file ownership,
- migration handlers for enable/disable/reconfigure.

## Consequences
- New capabilities become composable and evolvable.
- Wizard behavior and regeneration become explicit and testable.
- Requires a robust pack contract and validation tooling.
