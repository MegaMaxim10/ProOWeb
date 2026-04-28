# ADR-0011: Editor-Side Process Modeling Catalog

## Status
Accepted

## Context
Process modeling and version management are first-class editor responsibilities.

The generated application should not become the primary source of truth for process definitions.
Process models must be authored and versioned in ProOWeb itself, persisted in repository storage, and transformed into application source code only when developers explicitly deploy a process version.

## Decision
- Keep process specifications in ProOWeb storage:
  - `.prooweb/process-models/models/*.json`
- Add dedicated editor APIs for process lifecycle:
  - list/create model,
  - create version,
  - compare versions,
  - transition lifecycle states (`DRAFT`, `VALIDATED`, `DEPLOYED`, `RETIRED`),
  - deploy a version.
- Deployment action generates backend/frontend source artifacts on demand (no always-on runtime process module generation at workspace bootstrap).
- Track deployment-generated files in:
  - `.prooweb/process-models/managed-files.json`
- Reuse managed conflict strategy for deployed artifacts:
  - backup before overwrite when managed files were manually changed,
  - backup path: `.prooweb/backups/process-deploy-<id>/...`,
  - return detailed deployment report.

## Consequences
- Process specifications are fully versioned in repository under `.prooweb` and remain editable by developers.
- Generated application code is still owned by developers and updated only through explicit deployment intent.
- ProOWeb can evolve process model management independently from generated runtime internals while preserving auditability and migration safety.
