# ADR-0009: Notifications and Liquibase Baseline Pack

## Status
Accepted

## Context
Step 9 requires two production-oriented capabilities in generated projects:
- operational notification workflows (template-driven email dispatch with audit visibility),
- reproducible schema migration discipline with Liquibase.

These capabilities must remain source-owned, feature-pack managed, and compatible with the strict modular backend/frontend architecture already established.

## Decision
- Introduce and wire `notifications-email` as a dedicated feature pack:
  - backend notification workflow API in gateway (`/api/admin/notifications/*`),
  - common notification workflow services/templates/audit models,
  - frontend notification operations panel with adapter/use-case/domain split,
  - integration coverage through `NotificationWorkflowsIT`.
- Introduce and wire `database-liquibase` as a dedicated feature pack:
  - generated changelog baseline under `src/main/resources/db/changelog`,
  - master changelog + schema baseline + reference data changesets,
  - Liquibase conventions README in generated resources,
  - integration coverage through `LiquibaseBaselineIT`.
- Keep generation togglable through wizard/runtime configuration:
  - `notificationsEnabled`, `notificationsSenderAddress`, `notificationsAuditEnabled`,
  - `liquibaseEnabled`, `liquibaseChangelogPath`, `liquibaseContexts`.

## Consequences
- Generated applications now include a ready-to-use notification workflow surface for operational checks and extension.
- Schema evolution is deterministic and reproducible across environments through generated Liquibase assets.
- Feature-pack ownership remains explicit in managed manifests, preserving migration traceability and controlled reconfiguration.

