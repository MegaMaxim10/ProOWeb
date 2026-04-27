# ADR-0006: External IAM Auth Pack and Configurable Base Package

## Status
Accepted

## Context
Step 6 introduces external IAM authentication (OIDC-first) while preserving the platform rule that RBAC ownership remains internal.
In parallel, generated backend sources must no longer be hardcoded to a shared package (`com.prooweb.generated`) across all projects.

Without this decision:
- external IAM support would be fragmented and difficult to enable/disable safely through managed generation;
- generated Java package/group identifiers would collide conceptually across projects and reduce ownership clarity.

## Decision
- Introduce `external-iam-auth` as a dedicated feature pack:
  - depends on `auth-flows`, `identity-rbac`, and `frontend-web-react`;
  - is disabled by default and enabled through wizard configuration.
- Generate a full external IAM auth slice:
  - domain model and port (`ExternalAuthenticationResult`, `AuthenticateExternalIdentityPort`);
  - application use case/service (`AuthenticateExternalIdentityUseCase`, `ExternalAuthenticationService`);
  - infrastructure configuration + adapter (`ExternalIamProperties`, `Hs256ExternalIamAuthenticationAdapter`);
  - gateway endpoint (`POST /api/auth/external/oidc/login`);
  - integration test (`ExternalIamAuthenticationIT`).
- Keep authorization ownership internal:
  - external IAM only authenticates identity;
  - access is granted only when a matching active local RBAC account exists.
- Add `basePackage` to wizard/workspace configuration.
- Apply package transformation at generation time:
  - rewrite Java source paths containing `com/prooweb/generated`;
  - rewrite generated content occurrences of `com.prooweb.generated` (including Maven `groupId` references).

## Consequences
- Generated projects can use project-specific package/group identifiers.
- External IAM capability can be enabled/disabled and migrated through feature-pack governance.
- Step 6 behavior is verifiable through automated IT coverage.
- Existing workspaces remain compatible: missing `basePackage` defaults to `com.prooweb.generated`.

