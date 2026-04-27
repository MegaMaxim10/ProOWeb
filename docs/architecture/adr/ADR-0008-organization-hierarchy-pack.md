# ADR-0008: Organization Hierarchy Feature Pack

## Status
Accepted

## Context
Generated applications need a reusable organization model to represent institutional structures (units, supervisors, personnel assignment) and to support hierarchy-aware task assignment strategies.

The implementation must stay source-owned, modular, and configurable from ProOWeb, while remaining compatible with the existing strict backend architecture and feature-pack migration model.

## Decision
- Introduce `organization-hierarchy` as a dedicated feature pack.
- Generate a strict backend module `organization` with:
  - `organization-domain`,
  - `organization-application`,
  - `organization-infrastructure`.
- Add organization APIs in gateway:
  - `GET /api/admin/organization/units`
  - `POST /api/admin/organization/units`
  - `POST /api/admin/organization/units/{unitCode}/supervisor/{username}`
  - `POST /api/admin/organization/units/{unitCode}/members/{username}`
  - `GET /api/admin/organization/assignment/resolve`
- Add wizard/runtime configuration:
  - `organizationHierarchyEnabled`
  - `organizationDefaultAssignmentStrategy`
  - `organizationMaxTraversalDepth`
- Add frontend baseline module for organization administration and assignment preview.
- Add integration coverage via `OrganizationHierarchyIT`.

## Consequences
- Generated projects now include an immediately usable organization hierarchy baseline aligned with process assignment needs.
- Assignment logic becomes configurable and extensible without coupling to an external BPMS engine.
- Migration remains deterministic because files are owned by `organization-hierarchy` in managed manifests.

