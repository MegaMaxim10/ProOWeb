# ADR-0013: Process Data and Mapping Contract

## Status
Accepted

## Context
Step 13 requires a process data and mapping engine with explicit lineage.

Process specifications (`spec-v1`) already capture activity input/output mapping, source types, and storage strategy (`INSTANCE`, `SHARED`, `BOTH`).
The generated application needs these policies as source-owned deployment artifacts so teams can test and evolve data behavior without hidden runtime coupling.

## Decision
- Introduce a dedicated data contract projection generated from deployed process versions.
- Expose editor-side data contract preview API:
  - `GET /api/process-models/{modelKey}/versions/{version}/data-contract`
- Generate Step 13 deployment artifacts:
  - backend per-version data contract:
    - `processes/<modelKey>/v<version>.data.json`
  - backend aggregated data catalog:
    - `processes/data-catalog.json`
  - frontend per-version data contract module
  - frontend aggregated process data lineage catalog helper.
- Enrich deployment metadata and generated registries with data summary fields:
  - input/output mapping counts,
  - lineage edge count,
  - shared data entity count.

## Consequences
- Data lineage becomes explicit, versioned, and testable from generated source code.
- Shared-data usage is discoverable across process activities and versions.
- Step 14 simulation and process testing can consume stable data contracts instead of introspecting raw specs directly.
