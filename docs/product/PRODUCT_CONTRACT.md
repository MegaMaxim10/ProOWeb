# Product Contract

## 1. Product Statement
ProOWeb is a process-oriented web application builder that helps software teams generate and evolve source-code-owned web applications (backend + frontend) to automate organization processes.

The product position is intentionally between:
- from-scratch development (maximum control, slow delivery), and
- classic BPMS platforms (fast modeling, limited source-code ownership and higher platform coupling).

## 2. Primary Users
- ProOWeb developer: configures a project, models processes, generates code, tests, deploys, and maintains.
- Technical lead/architect: defines project standards, security policies, and generation choices.
- Generated app administrator: manages users, roles, organization hierarchy, and operational settings.
- Generated app end user: executes manual business tasks and interacts with generated workflows.

## 3. Core Product Goals
- Keep business process modeling at the center of application construction.
- Generate production-grade source code that the team fully owns and can modify manually.
- Make generated applications operational from day one with ready-to-use foundational capabilities.
- Keep ProOWeb upgradeable while preserving user modifications via managed generation and smart migration.

## 4. Scope for the Current Program
### 4.1 In Scope
- Web editor runtime and guided workspace wizard.
- Configurable generation of backend/frontend baseline.
- Strict modular backend architecture.
- Managed file manifest, migration engine, and conflict strategy.
- Foundation capability packs to be built in upcoming steps:
  - identity and RBAC,
  - authentication (internal + external IAM auth-only mode),
  - session/device security (observation, risk detection, revocation),
  - email notifications,
  - organization hierarchy,
  - Liquibase baseline and migration discipline.
- Process modeling lifecycle to be built progressively:
  - modeling,
  - versioning,
  - simulation/testing,
  - deployment and retirement of process versions.

### 4.2 Out of Scope (Current Phase)
- Mobile frontend generation beyond placeholder mode.
- Full BPMS engine replacement from day one.
- No-code abstraction that hides generated source code from developers.

## 5. Operating Model
- One repository clone corresponds to one generated project.
- ProOWeb editor code is isolated under `ProOWeb/`.
- Generated project code lives at repository root (`src/`, `deployment/`, root scripts).
- Every editor action that changes the target application must result in explicit source code generation.
- Generated backend package namespace is project-specific (`basePackage`) and cannot remain globally hardcoded.

## 6. Source Ownership Contract
- Generated files are tracked in `.prooweb-managed.json`.
- Developers are allowed to edit generated source files manually.
- Smart migration must detect manual edits in managed files and resolve through backup + explicit reporting.
- Unmanaged files remain untouched by regeneration.

## 7. Security and Compliance Baseline
- Secure by default configuration for generated applications.
- Authentication and authorization boundaries are explicit and testable.
- External IAM support is authentication-only; authorization remains platform-owned (RBAC).
- Identity, session, and sensitive operations are auditable.

## 8. Quality Gates
A milestone is acceptable only if all gates pass:
- Build: clean build on supported profiles.
- Tests: unit + integration suites pass.
- Coverage: JaCoCo aggregate report is generated.
- Migration: smart migration report is produced and deterministic.
- Documentation: English documentation updated for contract-impacting changes.

## 9. Definition of Done for a Feature Pack
- Generator templates added and wired.
- Backend + frontend runtime behavior operational.
- Automated tests present and passing.
- Migration path defined for enable/disable/reconfigure scenarios.
- English docs updated (contract, glossary, ADR/roadmap if needed).
