# Architecture Principles

## 1. Source Code Ownership First
Generated application code belongs to the development team. ProOWeb accelerates generation but never removes developer ownership.

## 2. Process-Centric Construction
Business processes are first-class citizens. Data, tasks, roles, and runtime behavior are modeled around process intent.

## 3. Strict Modularity
Generated backend follows strict module boundaries (`gateway`, `kernel`, `common`, domain modules, composition module, tests).

## 4. Explicit Layering
Each module keeps clear domain, application, and infrastructure responsibilities.

## 5. Safe Regeneration
Managed files are tracked; smart migration detects conflicts, creates backups, and reports details.

## 6. Configurable Capability Packs
Baseline features are implemented as configurable generation units and can evolve independently.

## 7. Security by Default
Authentication, authorization, session controls, and audit requirements are part of baseline architecture choices.

## 8. Testability and Observability
Generated code must be testable through UT/IT suites and produce aggregate coverage reports.

## 9. Environment Discipline
Profiles (`dev`, `demo`, `test`, `preprod`, `prod`) are explicit and consistently wired across backend, frontend, and deployment assets.

## 10. Documentation Discipline
Architecture-impacting changes require updates to English documentation and ADR records.
