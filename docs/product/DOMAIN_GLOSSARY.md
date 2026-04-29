# Domain Glossary

## A
- Activity: a single executable step in a business process definition.
- Assignment Strategy: rule set used to assign a manual task to a concrete user.
- Automatic Activity: a process activity executed by system code.

## B
- BPMN: notation used to model process control flow.
- Business Process Definition: versioned model describing activities, transitions, and data behavior.

## C
- Capability Pack: configurable feature set generated into the application core (for example identity, notifications).
- Conflict (Migration): detected difference where a managed file was manually changed and would be overwritten.

## D
- Deployment Profile: runtime environment configuration (`dev`, `demo`, `test`, `preprod`, `prod`).
- Data Lineage: explicit mapping graph showing how activity inputs/outputs move through process instance and shared data stores.
- Device Security: controls and telemetry related to client devices and session risk.

## E
- External IAM Provider: third-party identity provider used only for authentication in generated apps.

## F
- Feature Pack: implementation unit in ProOWeb generation that can be enabled, configured, disabled, or migrated.

## G
- Gateway Module: backend module responsible for request orchestration and entry-point APIs.
- Generated Root: filesystem root where ProOWeb writes managed project artifacts.

## H
- Hexagonal Architecture: architecture style separating domain/application/infrastructure concerns.

## I
- Identity (Internal): platform-managed account lifecycle and credentials.
- Integration Test (IT): test validating behavior across module boundaries and runtime wiring.

## L
- Liquibase Foundation: initial database changelog and migration discipline for generated applications.

## M
- Managed File: generated file tracked by `.prooweb-managed.json`.
- Manual Activity: process step performed by a user through generated UI.
- Migration Report: structured output summarizing created/updated/conflicting/colliding/backed-up files.

## O
- Organization Hierarchy: model representing organization structure, reporting lines, and assignment context.

## P
- Process Instance: runtime execution state of a specific process definition version.
- Process Version: immutable revision of a process definition.

## R
- RBAC: role-based access control model used for authorization.
- Reconfiguration: post-initialization workflow that updates generation preferences and applies managed regeneration with a migration report.
- Runtime Contract: generated source-owned projection of deployed process behavior (assignment, start policy, visibility, automatic handling).

## S
- Shared Data Model: data persisted and shared across multiple process definitions and instances.
- Smart Migration: managed regeneration operation with conflict detection, backup, and detailed reporting.

## T
- Template Ownership: rule specifying whether a file is managed by generator templates or unmanaged.
- Template Override: explicit customization rule that transforms generated content for a target file (`replace`, `prepend`, `append`, `replace-block`).
- Template Override Registry: workspace metadata file (`.prooweb/template-overrides.json`) that tracks override identity, strategy, source path, and priority.
- TOTP/OTP: multi-factor authentication mechanisms for one-time passcodes.

## U
- Unit Test (UT): test validating a small behavior scope with minimal external dependencies.
- Unmanaged File: file outside ProOWeb managed manifest, never overwritten by regeneration.

## W
- Wizard: initialization and reconfiguration flow that captures project and capability preferences.
- Workspace: the full repository context containing editor code and generated application code.
