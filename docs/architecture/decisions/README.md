# Architecture Decision Records (ADRs)

## Overview

This directory contains Architecture Decision Records (ADRs) - documents that capture important architectural decisions made in the Sovrium project, along with their context and consequences.

## Why ADRs?

- **Historical Context**: Understand why decisions were made
- **Onboarding**: Help new team members understand the architecture
- **Review Triggers**: Set dates to revisit decisions
- **Avoid Repetition**: Prevent re-litigating past decisions

## ADR Format

Each ADR follows this structure:

1. **Status**: Proposed, Accepted, Deprecated, Superseded
2. **Context**: What prompted this decision?
3. **Decision**: What did we decide?
4. **Rationale**: Why did we make this choice?
5. **Consequences**: What are the trade-offs?
6. **Alternatives**: What else did we consider?

## Current ADRs

| ADR                                                        | Title                                                 | Status   | Date       | Review Date |
| ---------------------------------------------------------- | ----------------------------------------------------- | -------- | ---------- | ----------- |
| [001](./001-validation-library-split.md)                   | Validation Library Split (Effect Schema vs Zod)       | Accepted | 2025-01-29 | 2025-07-01  |
| [002](./002-domain-feature-isolation.md)                   | Domain Feature Isolation Pattern                      | Accepted | 2025-01-29 | 2025-04-01  |
| [003](./003-runtime-sql-migrations.md)                     | Runtime SQL Migration Generation                      | Accepted | 2025-01-25 | 2025-07-01  |
| [004](./004-presentation-layer-feature-based-structure.md) | Presentation Layer Feature-Based Structure            | Accepted | 2025-11-10 | 2025-04-01  |
| [005](./005-authorization-strategy.md)                     | Authorization Strategy (RBAC + Field Permissions)     | Accepted | 2025-01-25 | 2025-07-01  |
| [006](./006-table-permission-configuration.md)             | Table Permission Configuration Storage and Management | Proposed | 2025-01-25 | TBD         |
| [007](./007-soft-delete-by-default.md)                     | Soft Delete by Default for All Tables                 | Accepted | 2025-12-16 | 2025-07-01  |
| [008](./008-console-logging-policy.md)                     | Console Logging Policy and Logger Service Usage       | Accepted | 2026-01-29 | 2026-07-29  |
| [009](./009-effect-schema-in-domain-layer.md)              | Effect Schema as Domain Layer Dependency              | Accepted | 2026-01-29 | 2026-07-29  |

## Planned ADRs

These decisions should be documented in future ADRs:

1. **Singular vs Plural Directory Names** - Why `table/` not `tables/`?
2. **Layer-Based vs Feature-Based Architecture** - Why combine both patterns?
3. **Root Aggregation Pattern** - Why have `tables.ts`, `pages.ts` files that re-export?
4. **Strict Array Immutability** - Why enforce at ERROR level with ESLint?
5. **Phase-Based Application Organization** - Why organize application layer by phases?

## Creating New ADRs

To create a new ADR:

1. Copy the template: `cp 001-validation-library-split.md XXX-your-decision.md`
2. Replace XXX with the next number (e.g., 003)
3. Fill in all sections
4. Update this README with the new ADR
5. Set a review date (typically 3-6 months)

## Review Process

ADRs should be reviewed on their review dates to assess:

- Is the decision still valid?
- Have circumstances changed?
- Should the decision be revised or superseded?
- What have we learned from implementing it?

## References

- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) by Michael Nygard
- [Architecture Decision Records](https://adr.github.io/)
- [ADR Tools](https://github.com/npryce/adr-tools)
