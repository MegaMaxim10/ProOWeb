# ADR-0014: Template Customization and Evolution Governance

## Status
Accepted

## Context
ProOWeb generates source code that teams are expected to version, review, and evolve manually.  
Without a formal customization mechanism, manual edits on managed files are overwritten during regeneration, migration, or process deployment, which makes long-term upgrades risky.

Step 21 requires:
- durable developer overrides for generated frontend/backend assets,
- deterministic behavior across generation, migration, and deployment,
- explicit reporting of customization application and skipped overrides.

## Decision
Introduce a template governance layer based on workspace-managed overrides:

- Registry: `.prooweb/template-overrides.json`
- Source payload root: `.prooweb/template-overrides/`
- Supported strategies:
  - `replace`
  - `prepend`
  - `append`
  - `replace-block`

Overrides are resolved deterministically (priority descending, then id ascending) and applied in:
- workspace generation (`generateWorkspace`),
- smart migration snapshot generation (`runSmartMigration`),
- process deployment compilation (`buildManagedDeploymentPlan`).

Dashboard/API management endpoints are exposed:
- `GET /api/template-overrides`
- `POST /api/template-overrides`
- `DELETE /api/template-overrides/{overrideId}`

Migration/deployment reports include override counters and skip diagnostics.

## Consequences
- Customization is explicit, trackable, and upgrade-safe.
- Teams can keep long-lived branding/architecture tweaks while still consuming ProOWeb upgrades.
- Generated outputs remain deterministic for CI and review workflows.
- Report verbosity increases, but provides governance-level traceability required for managed evolution.
