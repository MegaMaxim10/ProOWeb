# ProOWeb

Process-Oriented Web Application Builder.

## Vision

ProOWeb is a web editor (IDE) that helps engineering teams build business applications
(backend + frontend) while keeping business processes at the center and preserving full source code ownership.

## What the Current MVP Does

- Runs the Node.js editor on `http://localhost:1755` via `npm run prooweb`.
- Shows a wizard when the workspace is not initialized.
- Captures base project settings, super-admin account details, Git repository policy,
  backend Swagger UI options, backend base package, external IAM auth configuration,
  session/device security preferences, and organization hierarchy preferences.
- Generates the target project at repository root:
  - `src/backend/springboot` with strict modular hexagonal structure:
    - `gateway`,
    - `kernel` (`*-domain`, `*-application`, `*-infrastructure`),
    - `common` (`*-domain`, `*-application`, `*-infrastructure`),
    - `system` (`*-domain`, `*-application`, `*-infrastructure`),
    - `prooweb-application` composition module,
    - `tests` (`test-support`, `vanilla-unit-tests/*-ut`, `*-it`, `coverage`),
  - `src/frontend/web/react` (React/Vite connected to backend),
  - `src/frontend/mobile` (placeholder),
  - `deployment/docker` with `dev`, `demo`, `test`, `preprod`, `prod` profiles,
  - root shortcut scripts for build, tests, verification, and profile startup.
- Tracks generated sources through `.prooweb-managed.json`.
- Applies feature-pack driven generation with dependency validation and ownership metadata.
- Exposes smart migration (`POST /api/migrate`) with conflict strategy,
  automatic backup, and detailed report.
- Supports external IAM authentication (OIDC-first, auth-only) while RBAC stays internal.
- Supports session/device security capabilities (session observation, risk detection, revocation APIs).
- Supports organization hierarchy capabilities (units, supervisors, members, hierarchy-aware assignment resolution).
- Supports notification workflows + Liquibase generation (template-driven notification dispatch/audit, managed changelog generation).
- Supports dashboard-driven reconfiguration lifecycle with full smart-migration reporting (`POST /api/reconfigure`).
- Supports editor-side process modeling:
  - BPMN models and versions stored in `.prooweb/process-models`,
  - version lifecycle (`DRAFT`, `VALIDATED`, `DEPLOYED`, `RETIRED`) and version diff,
  - deployment action that generates backend/frontend source files only when a version is deployed,
  - managed conflict strategy with automatic backup and detailed deployment report.
- Supports runtime contract generation:
  - runtime contract projection generated from deployed process versions (`spec-v1` + BPMN),
  - backend/frontend runtime catalogs generated for process execution bootstrap.
- Supports deployment compiler behavior:
  - deployment compiles process specs into managed backend/frontend source artifacts,
  - generated runtime catalogs/contracts and handler stubs remain source-owned and undeploy-safe.
- Supports runtime engine core:
  - generated runtime engine classes and APIs per deployment (state machine, BPMN main transitions, guided start, task creation/completion),
  - runtime instance stop/archive lifecycle with timeline.
- Supports assignment and resolution engine:
  - strategy-aware automatic/manual assignment (`ROLE_QUEUE`, `SUPERVISOR_ONLY`, `SUPERVISOR_THEN_ANCESTORS`, `UNIT_MEMBERS`, `SINGLE_MATCH_ONLY`, `MANUAL_ONLY`, `ROUND_ROBIN`),
  - RBAC + hierarchy aware candidate resolution with rule `allowPreviouslyAssignedAssignee`,
  - runtime task assignment/reassignment API (`POST /api/process-runtime/tasks/{taskId}/assign`) with monitor/admin force mode.
- Supports process data and forms:
  - generated activity form catalog from deployed specs (manual activities, mapped input fields, output storage strategy),
  - runtime engine support for input-source resolution (`PROCESS_CONTEXT`, `PREVIOUS_ACTIVITY`, `SHARED_DATA`, backend/external stubs),
  - runtime output storage projection (`INSTANCE` / `SHARED` / `BOTH`) and role-based task/instance data filtering.
- Supports generated runtime workbench:
  - React runtime panel with task views (`to process`, `to assign`, `all visible`),
  - instance views (`participating`, `consultation`, status filter),
  - assignment actions (`assign`, `force assign`) + process start, completion, timeline, monitor operations.
- Supports PROCESS_MONITOR operations:
  - strict monitor/admin governance checks for force assignment, stop, archive, and monitor audit visibility,
  - generated monitor audit stream endpoint (`GET /api/process-runtime/monitor/events`) with instance/action filters,
  - generated React PROCESS_MONITOR console with auditable governance history.

## Wizard Git Policy

- If the user provides a Git URL:
  - existing `.git` is replaced,
  - a new repository is initialized,
  - `origin` is set to the provided URL.
- If no Git URL is provided:
  - the existing `.git` directory is removed.

## Swagger UI Policy

The wizard can enable Swagger UI only for non-preprod/prod profiles (`dev`, `demo`, `test`).
When enabled, ProOWeb:

- includes `springdoc-openapi-starter-webmvc-ui`,
- keeps Swagger disabled by default,
- enables Swagger in selected profiles through `application-<profile>.yml`.

## Base Package Policy

The wizard captures a backend `basePackage` (for example `com.acme.procurement`).
ProOWeb applies it across generated Java source paths and Maven `groupId` references so each project has its own package namespace.

## External IAM Policy

- External IAM support is generated through the `external-iam-auth` feature pack.
- The generated endpoint is `POST /api/auth/external/oidc/login`.
- Authentication can use configured provider settings from the wizard (`issuer`, `client`, claim mapping, secrets).
- Authorization remains internal: external users must match an active local account to be authenticated.

## Session & Device Security Policy

- Session/device security is generated through `session-device-security` feature pack.
- Successful internal/external authentication events are observed with device metadata.
- Suspicious activity is flagged based on configured thresholds:
  - `sessionSecurityWindowMinutes`
  - `sessionSecurityMaxDistinctDevices`
- Generated APIs:
  - `GET /api/account/sessions`
  - `POST /api/account/sessions/revoke`

## Organization Hierarchy Policy

- Organization hierarchy is generated through `organization-hierarchy` feature pack.
- The generated backend includes a strict `organization` module (`organization-domain`, `organization-application`, `organization-infrastructure`).
- Wizard/runtime options:
  - `organizationHierarchyEnabled`
  - `organizationDefaultAssignmentStrategy`
  - `organizationMaxTraversalDepth`
- Generated APIs:
  - `GET /api/admin/organization/units`
  - `POST /api/admin/organization/units`
  - `POST /api/admin/organization/units/{unitCode}/supervisor/{username}`
  - `POST /api/admin/organization/units/{unitCode}/members/{username}`
  - `GET /api/admin/organization/assignment/resolve`

## Notifications and Liquibase Policy

- Notification workflows are generated through `notifications-email` feature pack.
- Wizard/runtime options:
  - `notificationsEnabled`
  - `notificationsSenderAddress`
  - `notificationsAuditEnabled`
- Generated notification APIs:
  - `GET /api/admin/notifications/templates`
  - `POST /api/admin/notifications/dispatch`
  - `GET /api/admin/notifications/audit`

- Liquibase assets are generated through `database-liquibase` feature pack.
- Wizard/runtime options:
  - `liquibaseEnabled`
  - `liquibaseChangelogPath`
  - `liquibaseContexts`
- Generated Liquibase assets:
  - `db.changelog-master.yaml`
  - `changesets/001-baseline-schema.yaml`
  - `changesets/010-reference-data.yaml`
  - `db/changelog/README.md`

## Smart Migration

`POST /api/migrate` applies managed migration rules:

- compares current generated targets with latest managed manifest,
- detects manual edits on managed files,
- creates automatic backup before overwrite:
  - `.prooweb/backups/<migration-id>/<file>`
- handles path collisions (unmanaged file present on now-managed path) with backup + overwrite,
- returns detailed report:
  - counters (`created`, `updated`, `unchanged`, `conflictsResolved`, `collisionsResolved`, `backupsCreated`, `filesWithOverrides`, `overrideApplications`, `overrideSkips`),
  - per-file details,
  - backup root path.

## Reconfiguration Lifecycle

- `POST /api/reconfigure` applies configuration changes captured from dashboard forms.
- Default mode is `full` (application + infrastructure regeneration); `infra` mode is still available.
- Reconfiguration returns the same detailed migration report shape as smart migration, including:
  - feature-pack delta (`added`, `removed`, `unchanged`),
  - per-file actions (`created`, `updated`, `conflictsResolved`, `collisionsResolved`, `staleManagedFiles`),
  - backup traceability.

## Template Customization and Evolution Governance (Step 21)

- Durable overrides are stored in the workspace under:
  - `.prooweb/template-overrides.json` (registry)
  - `.prooweb/template-overrides/*.txt` (override source payloads)
- Supported override strategies:
  - `replace`
  - `prepend`
  - `append`
  - `replace-block` (requires `matchText`, optional `replacementText`)
- Override management APIs:
  - `GET /api/template-overrides`
  - `POST /api/template-overrides`
  - `DELETE /api/template-overrides/{overrideId}`
- Generation, migration, and process deployment apply overrides deterministically (priority descending, then id).
- Migration/deployment reports expose override activity so teams can audit which customizations were applied or skipped.

## Process Modeling and Deployment

- Process definitions are authored and versioned in ProOWeb, not inside generated app runtime modules.
- Storage location: `.prooweb/process-models/models/*.json`.
- Main editor APIs:
  - `GET /api/process-models`
  - `POST /api/process-models`
  - `POST /api/process-models/{modelKey}/versions`
  - `GET /api/process-models/{modelKey}/versions/{version}`
  - `GET /api/process-models/{modelKey}/versions/{version}/runtime-contract`
  - `GET /api/process-models/{modelKey}/versions/{version}/data-contract`
  - `GET /api/process-models/{modelKey}/versions/{version}/specification`
  - `POST /api/process-models/{modelKey}/versions/{version}/specification/validate`
  - `PUT /api/process-models/{modelKey}/versions/{version}/specification`
  - `GET /api/process-models/{modelKey}/diff?sourceVersion=...&targetVersion=...`
  - `POST /api/process-models/{modelKey}/versions/{version}/transition`
  - `POST /api/process-models/{modelKey}/versions/{version}/deploy`
  - `POST /api/process-models/{modelKey}/versions/{version}/simulate`
  - `POST /api/process-models/{modelKey}/versions/{version}/promote`
  - `POST /api/process-models/{modelKey}/versions/{version}/rollback`
  - `POST /api/process-models/{modelKey}/versions/{version}/undeploy`
  - `GET /api/process-models/{modelKey}/history`
  - `POST /api/process-models/{modelKey}/history/snapshots`
  - `POST /api/process-models/{modelKey}/history/undo`
  - `POST /api/process-models/{modelKey}/history/redo`
- Dashboard BPMN studio:
  - graphical modeling with `bpmn-js` (BPMN.io),
  - import/export BPMN files,
  - XML IDE editor powered by Monaco (syntax highlighting + marker-based syntax checks),
  - BPMN linting rules beyond XML syntax (graph/connectivity/sequence-flow consistency),
  - version-aware load action to fetch a selected model version directly into studio,
  - persisted undo/redo snapshots per model in `.prooweb/process-models/history/*.json`,
  - bidirectional sync between graphical canvas and XML editor.
- Process specification studio (`spec-v1`) adds:
  - version-linked JSON specification editing with Monaco,
  - strict validation against BPMN activity ids and assignment/visibility policy schema,
  - normalized persisted contract per process version for code generation.
- Deployment generates process-specific source artifacts into backend/frontend trees and tracks them in:
  - `.prooweb/process-models/managed-files.json`
- Runtime deployment assets include:
  - backend runtime contract per deployed version:
    - `src/backend/springboot/prooweb-application/src/main/resources/processes/<modelKey>/v<version>.runtime.json`
  - backend runtime catalog:
    - `src/backend/springboot/prooweb-application/src/main/resources/processes/runtime-catalog.json`
  - backend runtime engine generated modules:
    - `src/backend/springboot/system/system-domain/src/main/java/.../process/runtime/*`
    - `src/backend/springboot/system/system-application/src/main/java/.../process/runtime/*`
    - `src/backend/springboot/system/system-infrastructure/src/main/java/.../process/runtime/*`
    - `src/backend/springboot/gateway/src/main/java/.../gateway/api/ProcessRuntimeController.java`
  - frontend runtime modules:
    - `src/frontend/web/react/src/modules/processes/<modelKey>/Process<ProcessName>V<version>RuntimeContract.js`
    - `src/frontend/web/react/src/modules/processes/generatedProcessRegistry.js`
    - `src/frontend/web/react/src/modules/processes/generatedTaskInboxCatalog.js`
    - `src/frontend/web/react/src/modules/processes/runtime/generatedProcessRuntimeApi.js`
- Data/mapping deployment assets include:
  - backend:
    - `src/backend/springboot/prooweb-application/src/main/resources/processes/<modelKey>/v<version>.data.json`
    - `src/backend/springboot/prooweb-application/src/main/resources/processes/data-catalog.json`
  - frontend:
    - `src/frontend/web/react/src/modules/processes/<modelKey>/Process<ProcessName>V<version>DataContract.js`
    - `src/frontend/web/react/src/modules/processes/generatedProcessDataLineageCatalog.js`
- If a managed generated file was manually modified, deployment creates backup before overwrite:
  - `.prooweb/backups/process-deploy-<id>/...`
- Process deployment now applies the same template override runtime used by workspace generation/migration, so deployed process artifacts remain customization-safe across upgrades.

## Safe Promotion Pipeline (Step 20)

- ProOWeb now supports a controlled promotion workflow:
  - `simulate -> test/coverage quality gates -> deploy -> rollback plan`
- Simulation API:
  - `POST /api/process-models/{modelKey}/versions/{version}/simulate`
  - validates specification + runtime/data contracts and returns reachability/timeline preview.
- Promotion API:
  - `POST /api/process-models/{modelKey}/versions/{version}/promote`
  - runs optional simulation gate, optional quality gate commands (`verify-only` or `expanded`), coverage gates, and optional auto-deployment.
- Rollback API:
  - `POST /api/process-models/{modelKey}/versions/{version}/rollback`
  - rolls back latest successful promotion (or provided promotion id) using a persisted rollback strategy.
- Promotion records are persisted under:
  - `.prooweb/process-models/promotions/<modelKey>/promotion-*.json`
- Coverage gate aggregation currently reads:
  - backend JaCoCo aggregate report (`src/backend/springboot/target/site/jacoco-aggregate/jacoco.xml`),
  - frontend Vitest summary when available (`src/frontend/web/react/coverage/coverage-summary.json`).

## Process Runtime Contract

- Runtime behavior is generated as source-owned contracts from deployed model versions.
- Runtime contract preview API:
  - `GET /api/process-models/{modelKey}/versions/{version}/runtime-contract`
- Dashboard includes a runtime contract preview action in the process modeling section.
- Deployment metadata now includes runtime summary details:
  - manual/automatic activity counts,
  - startable roles,
  - monitor roles.

## Process Data and Forms

- Data contract preview API:
  - `GET /api/process-models/{modelKey}/versions/{version}/data-contract`
- Data contract includes:
  - activity input sources and output mapping strategies,
  - lineage edges between source and target paths,
  - shared data entity catalog (produced/consumed activities),
  - summary counters (input/output mappings, lineage edges, shared entities, warnings).
- Deployment metadata now includes data summary details and shared data entities.
- Deployment now generates frontend form metadata catalog:
  - `src/frontend/web/react/src/modules/processes/generatedProcessFormCatalog.js`
- Runtime engine now applies:
  - input source resolution from `PROCESS_CONTEXT`, `PREVIOUS_ACTIVITY`, `SHARED_DATA`, and service-source stubs,
  - output storage projection to `INSTANCE`, `SHARED`, or `BOTH`,
  - role-aware task/instance data visibility using `dataViewerRoles`.
- Runtime API role-aware read/list signatures:
  - `GET /api/process-runtime/tasks?actor=...&roles=...`
  - `GET /api/process-runtime/instances/{instanceId}?actor=...&roles=...`
  - task completion payload accepts `roleCodes` for filtered runtime responses.

## Process Runtime Engine Core

- Deployment now compiles runtime engine source modules (hexagonal split) and base runtime tests:
  - domain runtime state/task/instance model,
  - application runtime use case and service orchestration,
  - infrastructure in-memory store adapter + module config,
  - gateway runtime controller endpoints.
- Runtime API endpoints include:
  - `GET /api/process-runtime/start-options`
  - `POST /api/process-runtime/instances/start`
  - `GET /api/process-runtime/instances`
  - `GET /api/process-runtime/tasks`
  - `POST /api/process-runtime/tasks/{taskId}/assign`
  - `POST /api/process-runtime/tasks/{taskId}/complete`
  - `GET /api/process-runtime/instances/{instanceId}`
  - `GET /api/process-runtime/instances/{instanceId}/timeline`
  - `POST /api/process-runtime/instances/{instanceId}/stop`
  - `POST /api/process-runtime/instances/{instanceId}/archive`

## Assignment and Resolution Engine

- Generated runtime uses assignment policy from deployed process specification:
  - assignment mode (`AUTOMATIC`, `MANUAL`),
  - strategy (`ROLE_QUEUE`, `SUPERVISOR_ONLY`, `SUPERVISOR_THEN_ANCESTORS`, `UNIT_MEMBERS`, `SINGLE_MATCH_ONLY`, `MANUAL_ONLY`, `ROUND_ROBIN`),
  - candidate roles, manual assigner roles, and `allowPreviouslyAssignedAssignee`.
- Candidate resolution combines:
  - RBAC role matching,
  - hierarchy metadata (supervisor chain + unit ancestry),
  - deterministic multi-match resolution/fallback.
- Runtime task views now expose assignment metadata:
  - `assignmentStatus`, `assignmentMode`, `assignmentStrategy`, `candidateRoles`, `manualAssignerRoles`.

## Runtime Workbench

- Generated React app now includes runtime operations UI (`ProcessRuntimeWorkbench`) when process modeling is enabled.
- Scaffold includes safe placeholder runtime catalogs/APIs so initial generation compiles even before first process deployment.
- Once a process version is deployed, generated runtime catalogs and API module are overwritten with deployed runtime metadata and live backend calls.

## PROCESS_MONITOR Operations

- Runtime governance actions are now monitor-governed and auditable:
  - force assignment requires `PROCESS_MONITOR` or `ADMINISTRATOR`,
  - stop/archive endpoints require monitor/admin role context in payload (`roleCodes`),
  - monitor events are persisted by generated runtime store adapters and exposed through:
    - `GET /api/process-runtime/monitor/events?actor=...&roles=...&instanceId=...&actionType=...&limit=...`
- Generated runtime workbench now includes a dedicated PROCESS_MONITOR console:
  - instance/action filters,
  - governance event feed (`TASK_ASSIGN`, `INSTANCE_STOP`, `INSTANCE_ARCHIVE`),
  - force-mode visibility and action details.

## Usage

1. Start the editor:

```bash
npm run prooweb
```

2. Open `http://localhost:1755` and complete the wizard.

3. Use root-level npm shortcuts:

```bash
npm run compile
npm test
npm run verify
npm run start:dev
npm run start:demo
npm run start:test
npm run start:preprod
npm run start:prod
```

## Editor Internal Architecture

ProOWeb code is split into explicit layers:

- `ProOWeb/src/server.js`: composition root.
- `ProOWeb/src/routes`: HTTP route mapping.
- `ProOWeb/src/controllers`: HTTP adaptation layer.
- `ProOWeb/src/services`: application/service use cases.
- `ProOWeb/src/http`: reusable HTTP primitives.
- `ProOWeb/src/lib/generator.js`: generation orchestration.
- `ProOWeb/src/lib/generator/templates/`: one template per file.

## Key Files

- `ProOWeb/src/server.js`: editor server composition root.
- `ProOWeb/src/routes/app-router.js`: centralized HTTP routing.
- `ProOWeb/src/controllers/workspace-controller.js`: workspace endpoints controller.
- `ProOWeb/src/services/workspace-service.js`: workspace application service.
- `ProOWeb/src/services/process-model-service.js`: process modeling/version/deployment application service.
- `ProOWeb/src/controllers/process-model-controller.js`: process modeling API controller.
- `ProOWeb/src/http/*`: shared HTTP utilities.
- `ProOWeb/src/lib/workspace.js`: validation, persistence, and management metadata.
- `ProOWeb/src/lib/generator.js`: generation orchestration and managed manifest workflow.
- `ProOWeb/src/lib/generator/templates/index.js`: template assembly index.
- `ProOWeb/src/lib/generator/templates/**`: one template per file, grouped by domain/technology.
- `ProOWeb/src/lib/migration.js`: smart migration engine.
- `ProOWeb/src/lib/process-modeling/*`: process catalog, lifecycle, and deployment generation internals.
- `ProOWeb/src/lib/process-modeling/runtime-contract.js`: runtime contract projection from deployed process specifications.
- `ProOWeb/src/lib/process-modeling/data-contract.js`: data and mapping contract projection with lineage and shared-data catalogs.
- `ProOWeb/src/lib/git.js`: wizard-driven Git policy.
- `ProOWeb/public/assets/js/*`: modular frontend scripts.
- `ProOWeb/public/assets/css/*`: modular frontend styles.

## Documentation

English product docs are available in [docs/README.md](docs/README.md).
