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
  and session/device security preferences.
- Generates the target project at repository root:
  - `src/backend/springboot` with strict Njangui-inspired modular structure:
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
- Supports Step 6 external IAM authentication (OIDC-first, auth-only) while RBAC stays internal.
- Supports Step 7 session/device security baseline (session observation, risk detection, revocation APIs).

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

## External IAM Policy (Step 6)

- External IAM support is generated through the `external-iam-auth` feature pack.
- The generated endpoint is `POST /api/auth/external/oidc/login`.
- Authentication can use configured provider settings from the wizard (`issuer`, `client`, claim mapping, secrets).
- Authorization remains internal: external users must match an active local account to be authenticated.

## Session & Device Security Policy (Step 7)

- Session/device security is generated through `session-device-security` feature pack.
- Successful internal/external authentication events are observed with device metadata.
- Suspicious activity is flagged based on configured thresholds:
  - `sessionSecurityWindowMinutes`
  - `sessionSecurityMaxDistinctDevices`
- Generated APIs:
  - `GET /api/account/sessions`
  - `POST /api/account/sessions/revoke`

## Smart Migration

`POST /api/migrate` applies managed migration rules:

- compares current generated targets with latest managed manifest,
- detects manual edits on managed files,
- creates automatic backup before overwrite:
  - `.prooweb/backups/<migration-id>/<file>`
- handles path collisions (unmanaged file present on now-managed path) with backup + overwrite,
- returns detailed report:
  - counters (`created`, `updated`, `unchanged`, `conflictsResolved`, `collisionsResolved`, `backupsCreated`),
  - per-file details,
  - backup root path.

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
- `ProOWeb/src/http/*`: shared HTTP utilities.
- `ProOWeb/src/lib/workspace.js`: validation, persistence, and management metadata.
- `ProOWeb/src/lib/generator.js`: generation orchestration and managed manifest workflow.
- `ProOWeb/src/lib/generator/templates/index.js`: template assembly index.
- `ProOWeb/src/lib/generator/templates/**`: one template per file, grouped by domain/technology.
- `ProOWeb/src/lib/migration.js`: smart migration engine.
- `ProOWeb/src/lib/git.js`: wizard-driven Git policy.
- `ProOWeb/public/assets/js/*`: modular frontend scripts.
- `ProOWeb/public/assets/css/*`: modular frontend styles.

## Documentation

English baseline docs are available in [docs/README.md](docs/README.md).
