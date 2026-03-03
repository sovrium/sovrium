# Architecture Docs Maintainer Memory

## Documented Patterns

- **dependency-risk-assessment.md** (`docs/architecture/dependency-risk-assessment.md`) — Dependency risk tiers, coupling analysis, contingency plans, mitigation patterns. Last reviewed 2026-03-03.
- Pairs with `docs/infrastructure/dependency-sustainability.md` (created separately — concrete data on versions, licenses, alternatives).

## Enforcement Status

- dependency-risk-assessment.md: Partially enforced. eslint-plugin-boundaries + ADR-001 + ADR-009 enforce coupling constraints automatically. Funding/license changes require quarterly manual review (cannot be automated).

## Documentation Gaps

- `docs/infrastructure/dependency-sustainability.md` referenced in dependency-risk-assessment.md but may not yet exist — verify if created separately.
- `.claude/docs-index.md` not updated for dependency-risk-assessment.md (per task instructions — handled separately).
