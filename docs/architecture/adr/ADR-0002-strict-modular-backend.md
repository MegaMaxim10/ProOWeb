# ADR-0002: Strict Modular Backend Architecture Inspired by Njangui

- Status: Accepted
- Date: 2026-04-26

## Context
The generated backend must stay readable, scalable, and maintainable while supporting deep business and process capabilities.

## Decision
Generated Spring Boot backend follows a strict multi-module structure:
- `gateway` for API orchestration,
- `kernel` (`*-domain`, `*-application`, `*-infrastructure`) for foundational abstractions,
- `common` (`*-domain`, `*-application`, `*-infrastructure`) for transversal business capabilities,
- domain modules (`system` and future business modules) with the same tri-layer split,
- `<project>-application` composition module,
- `tests` with UT and IT module structure and aggregate coverage.

## Consequences
- Clear dependency direction and module boundaries.
- Easier incremental growth and refactoring.
- Stronger alignment with proven Njangui backend patterns.
