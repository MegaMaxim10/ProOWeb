# ADR-0010: Wizard v2 Reconfiguration Lifecycle

## Status
Accepted

## Context
After initial generation, teams need to change baseline capability choices (security, IAM, organization, notifications, Liquibase, package namespace) without manually editing the generated tree and without losing migration traceability.

Step 10 requires a developer-facing reconfiguration flow that is explicit, safe, and fully reportable.

## Decision
- Add a dedicated workspace reconfiguration endpoint:
  - `POST /api/reconfigure`
- Keep version-alignment migration endpoint:
  - `POST /api/migrate`
- Reconfiguration uses smart migration with default `mode=full`:
  - regenerates impacted managed files,
  - preserves conflict strategy (backup + overwrite for managed conflicts),
  - returns full migration report including feature-pack delta and per-file actions.
- Dashboard now includes a reconfiguration form preloaded from current workspace config for:
  - backend base package,
  - Swagger profiles,
  - external IAM settings,
  - session/device security,
  - organization hierarchy,
  - notification workflows,
  - Liquibase migration settings.

## Consequences
- Capability changes are now operationally supported after initialization.
- Reconfiguration remains deterministic and auditable through existing smart migration report structure.
- Teams can evolve project generation preferences without leaving the ProOWeb runtime.

