# ADR-0004: Feature-Pack Driven Generation and Reconfiguration

- Status: Accepted
- Date: 2026-04-26

## Context
ProOWeb must generate operational baseline capabilities (identity, auth, hierarchy, notifications, etc.) based on wizard choices and later reconfiguration.

## Decision
Generation will be organized around capability-oriented feature packs with explicit metadata:
- dependencies,
- configuration schema,
- managed file ownership,
- migration handlers for enable/disable/reconfigure.

Initial implementation baseline:
- feature-pack registry and dependency validation,
- normalized workspace-level feature-pack configuration,
- feature-pack aware generation plan by mode (`full`, `infra`),
- managed manifest ownership metadata per generated file,
- migration change-set reporting and hook extension points.

## Consequences
- New capabilities become composable and evolvable.
- Wizard behavior and regeneration become explicit and testable.
- Requires a robust pack contract and validation tooling.
