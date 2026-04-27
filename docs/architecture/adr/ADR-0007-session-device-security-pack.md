# ADR-0007: Session and Device Security Feature Pack

## Status
Accepted

## Context
After internal/external authentication flows, generated applications must provide baseline session protection:
- session observation,
- device awareness,
- suspicious activity detection,
- session revocation.

The behavior must remain source-owned, modular, and configurable from ProOWeb.

## Decision
- Introduce `session-device-security` as a dedicated feature pack.
- Keep the implementation in the identity bounded context with hexagonal boundaries:
  - domain model: `UserSessionObservation`,
  - domain port: `ObserveUserSessionPort`,
  - application use case/service: `ObserveUserSessionUseCase`, `ObserveUserSessionService`,
  - infrastructure baseline adapter: `InMemorySessionObservationAdapter`,
  - configuration: `SessionSecurityProperties`,
  - gateway API: `SessionSecurityController`.
- Wire successful authentications (internal and external) to session observation when the pack is enabled.
- Expose user-facing endpoints:
  - `GET /api/account/sessions`
  - `POST /api/account/sessions/revoke`
- Add wizard/runtime options:
  - `sessionSecurityEnabled`
  - `sessionSecurityWindowMinutes`
  - `sessionSecurityMaxDistinctDevices`
- Add integration test coverage through `SessionDeviceSecurityIT`.

## Consequences
- Generated projects include practical session risk controls by configuration, not by manual bootstrap.
- The baseline remains evolvable: projects can replace in-memory observation with persistent/session-store adapters.
- Migration behavior remains deterministic because all generated files are managed by feature-pack ownership metadata.

