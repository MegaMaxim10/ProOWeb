# Delivery Roadmap

This roadmap defines the step by step construction plan and acceptance criteria.

## Phase 1 - Product Contract and Baseline Documentation
- Lock scope, vocabulary, architecture principles, and initial ADR set.
- Deliver English documentation baseline and repository-level entry points.
- Exit criteria: contract and roadmap validated.

## Phase 2 - Generator Platform v2 (Feature-Pack Ready)
- Introduce explicit feature-pack metadata and dependency rules.
- Strengthen managed file boundaries and migration hooks.
- Exit criteria: a feature pack can be toggled with deterministic regeneration behavior.

## Phase 3 - Baseline Generated App Hardening
- Keep backend/frontend baseline operational across profiles.
- Ensure Docker, scripts, tests, and coverage aggregation remain stable.
- Exit criteria: clean generation + build + verify on supported profiles.

## Phase 4 - Identity and RBAC Foundation
- Generate complete internal identity and authorization model.
- Provide backend APIs + frontend screens for user and role administration.
- Exit criteria: end-to-end RBAC enforcement validated.

## Phase 5 - Authentication Flows
- Implement account creation, activation, login, password reset, MFA (OTP/TOTP).
- Add frontend journeys and integration tests for each flow.
- Implementation baseline: `auth-flows` feature pack (depends on `identity-rbac`).
- Exit criteria: all auth flows pass automated tests.

## Phase 6 - External IAM (Authentication Only)
- Add configurable external IdP support (OIDC-first) for authentication.
- Keep RBAC and permission ownership internal to platform.
- Add configurable backend base package to avoid hardcoded generated namespaces across projects.
- Exit criteria: external login works while authorization remains internal.

## Phase 7 - Session and Device Security
- Add session observation, device awareness, suspicious behavior detection, and session revocation.
- Expose configuration in wizard/runtime (`window`, `max distinct devices`) and generate enforcement baseline.
- Exit criteria: high-risk scenarios trigger expected controls and audit events.

## Phase 8 - Organization Hierarchy Management
- Generate generic organization structure module (units, supervisors, assignments).
- Support hierarchy-aware task assignment rules.
- Implementation baseline: `organization-hierarchy` feature pack.
- Exit criteria: hierarchy model is editable and usable in assignment strategies.

## Phase 9 - Notifications and Database Migration Maturity
- Expand email notification templates/channels.
- Provide robust Liquibase baseline and migration conventions.
- Implementation baseline:
  - `notifications-email` feature pack (backend + frontend + IT),
  - `database-liquibase` feature pack (generated changelogs + IT).
- Exit criteria: notification workflows operational and Liquibase migrations reproducible.

## Phase 10 - Wizard v2 and Reconfiguration Lifecycle
- Wizard captures preferences for all baseline capability packs.
- Reconfiguration regenerates, updates, or removes impacted code with migration reports.
- Implementation baseline:
  - `POST /api/reconfigure` endpoint,
  - dashboard reconfiguration form prefilled from workspace config,
  - smart migration report rendering with feature-pack delta and per-file actions.
- Exit criteria: capability changes are safe and traceable.

## Phase 11 - Process Modeling and Version Management
- Add BPMN modeling, model repository, and version lifecycle.
- Implementation baseline:
  - process models persisted in `.prooweb/process-models`,
  - editor APIs for create/version/diff/transition/deploy,
  - deployment generates backend/frontend source only on explicit deployment action,
  - managed conflict strategy with automatic backups and detailed report.
- Exit criteria: process definitions are versioned, diffable, and deployable.

## Phase 12 - Process Runtime Engine
- Execute modeled processes with manual and automatic activities.
- Enforce assignment strategies and runtime transitions.
- Implementation baseline:
  - runtime contract projection generated from deployed process model versions,
  - editor preview API for runtime contract (`GET /api/process-models/{modelKey}/versions/{version}/runtime-contract`),
  - generated backend/frontend runtime catalogs as source-owned artifacts.
- Exit criteria: representative process runs end-to-end in generated app.

## Phase 13 - Deployment Compiler v1 (Spec -> Source Code)
- On deployment of a process version, compile the specification into modular backend/frontend source code (strict hexagonal layout).
- Generate automatic handler stubs and runtime API contracts.
- Exit criteria: deployed version produces a compilable runtime baseline with basic tests and clean undeploy.

## Phase 14 - Runtime Engine Core
- Implement runtime execution core (state machine, BPMN main transitions, task creation, guided start, stop/archive lifecycle).
- Exit criteria: a reference process runs end-to-end in generated runtime.

## Phase 15 - Assignment and Resolution Engine
- Implement automatic/manual assignment strategies integrated with RBAC + organization hierarchy.
- Support "already assigned in current instance" rules and deterministic multi-match fallback policies.
- Exit criteria: complex assignment scenarios are validated in integration tests.

## Phase 16 - Process Data and Forms Engine
- Implement activity input/output mappings, instance/shared/both storage, and generated task forms.
- Add role-based runtime data visibility for task/instance views.
- Exit criteria: a process with forms and internal/external mappings runs in production-like conditions.

## Phase 17 - Generated App Workbench (End-user UX)
- Generate end-user process screens: tasks to process/assign, process start, instance timeline, participation and consultation views, status filters.
- Exit criteria: generated UX is complete and aligned with runtime scenario.

## Phase 18 - PROCESS_MONITOR and Operations
- Generate PROCESS_MONITOR operations console (forced reassignment, stop/archive, runtime supervision) with admin-governed permissions.
- Exit criteria: runtime governance actions are operational and auditable.

## Phase 19 - User Settings and Auto-task Behavior
- Generate user preferences screens (credentials, MFA, profile, language, theme, notifications, automatic-task treatment policy).
- Exit criteria: runtime behavior can be influenced by per-user settings.

## Phase 20 - Simulation, Test, and Safe Promotion
- Add pre-deployment simulation in ProOWeb, automated scenario testing (UT/IT/Cucumber), aggregated coverage and quality gates.
- Implement promotion workflow: simulate -> test -> deploy -> monitor -> rollback.
- Exit criteria: industrialized safe promotion pipeline is available.

## Phase 21 - Template Customization and Evolution Governance
- Provide frontend/backend template management with durable developer overrides.
- Maintain continuous intelligent migration across ProOWeb versions without breaking customizations.
- Exit criteria: long-term customization and upgrades coexist safely.

## Program-Wide Cross-Cutting Tracks
- Documentation in English only.
- Security and auditability by default.
- Test automation and coverage aggregation at each milestone.
- Backward-compatible migration path for managed projects.
