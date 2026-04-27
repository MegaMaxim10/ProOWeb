# ADR-0012: Runtime Contract Generation from Deployed Process Specs

## Status
Accepted

## Context
Step 12 requires a process runtime baseline.

At this stage, ProOWeb already stores BPMN + `spec-v1` in editor-side model versions and deploys generated source files only on explicit deployment action.
The generated application still needs deterministic runtime-ready artifacts to bootstrap process execution features (task inbox, assignment orchestration, role-based start rules) without introducing an opaque BPMS coupling.

## Decision
- Introduce a runtime contract projection built from deployed model version + normalized `spec-v1`.
- Generate runtime artifacts at deployment time:
  - backend:
    - `processes/<modelKey>/v<version>.runtime.json`,
    - `processes/runtime-catalog.json`,
    - enriched `GeneratedProcessRegistry` (runtime path + summary fields).
  - frontend:
    - per-version runtime contract module,
    - enriched process registry with runtime metadata,
    - generated manual-task catalog helper.
- Expose runtime preview API in ProOWeb editor:
  - `GET /api/process-models/{modelKey}/versions/{version}/runtime-contract`

## Consequences
- Runtime policies become explicit, versioned, and auditable in generated source code.
- Future process runtime engine features can consume stable generated contracts instead of reading editor-internal storage directly.
- Deployment report and metadata now include runtime summary details (manual/automatic activity counts and role-oriented start/monitor policies).
