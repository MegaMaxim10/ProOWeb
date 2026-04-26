# ADR-0005: Authentication Flows as a Dedicated Feature Pack

- Status: Accepted
- Date: 2026-04-26

## Context
Phase 5 requires operational authentication journeys in generated applications:
- account registration,
- account activation,
- password login,
- password reset,
- MFA configuration and verification with OTP/TOTP.

These capabilities must be generated with explicit ownership, remain compatible with strict modular architecture, and integrate with managed-file migration semantics.

## Decision
Authentication is delivered through a dedicated `auth-flows` feature pack that depends on `identity-rbac`.

Generation includes:
- backend authentication use cases and persistence adapter in the `identity` module,
- gateway authentication APIs (`/api/auth/**` and authenticated MFA setup endpoints),
- frontend authentication workbench pages/components,
- integration tests covering registration, activation, login, reset, OTP MFA, and TOTP MFA.

The pack remains independently toggleable via feature-pack metadata and is tracked in the managed manifest ownership model.

## Consequences
- Authentication behaviors can evolve without coupling all identity templates to the same lifecycle.
- Migration reports can isolate auth-related file ownership and conflicts.
- Security and quality gates become explicit at pack level, including end-to-end automated auth flow tests.
