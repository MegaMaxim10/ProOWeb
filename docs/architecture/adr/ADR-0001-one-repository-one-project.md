# ADR-0001: One Repository Equals One Generated Project

- Status: Accepted
- Date: 2026-04-26

## Context
ProOWeb runs as an editor inside the same repository that contains generated application code. The project needs clear operational boundaries and predictable lifecycle behavior.

## Decision
A repository clone corresponds to exactly one generated project.

- Editor code is isolated under `ProOWeb/`.
- Generated application code is written at repository root.
- Workspace metadata is stored under `.prooweb/` and managed manifest files.

## Consequences
- Simpler onboarding and CI pipelines per repository.
- No multi-tenant workspace complexity in the current phase.
- Migration and regeneration logic can remain deterministic at repository scope.
