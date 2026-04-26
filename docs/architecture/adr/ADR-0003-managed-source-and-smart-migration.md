# ADR-0003: Generated Source Ownership and Smart Migration Contract

- Status: Accepted
- Date: 2026-04-26

## Context
Developers must be free to modify generated code manually while still benefiting from future regeneration and editor upgrades.

## Decision
ProOWeb tracks managed files in `.prooweb-managed.json` and applies smart migration rules:
- detect manual modifications in managed files,
- create automatic backups before overwrite,
- report all changes and conflict resolutions in detail.

## Consequences
- Regeneration remains safe and auditable.
- Teams can customize generated code without losing control.
- Migration logic becomes a critical contract that must be tested continuously.
