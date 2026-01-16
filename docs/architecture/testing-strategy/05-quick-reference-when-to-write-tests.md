# Testing Strategy - E2E-First TDD with Test-After Unit Tests

> **Note**: This is part 5 of the split documentation. See navigation links below.

## Quick Reference: When to Write Tests

| Test Type      | Timing             | Purpose                                | Location           | Tool       |
| -------------- | ------------------ | -------------------------------------- | ------------------ | ---------- |
| **E2E Tests**  | BEFORE (TDD)       | Define feature completion criteria     | `specs/*.spec.ts`  | Playwright |
| **Unit Tests** | AFTER (Test-After) | Document implementation and edge cases | `src/**/*.test.ts` | Bun Test   |

## **Development Flow**: E2E Test (RED) → Implement (GREEN) → Unit Tests (REFACTOR) → Done

## Navigation

[← Part 4](./04-managing-red-tests-with-fixme.md) | [Part 6 →](./06-test-file-naming-convention.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-testing-approach.md) | [Part 4](./04-managing-red-tests-with-fixme.md) | **Part 5** | [Part 6](./06-test-file-naming-convention.md) | [Part 7](./07-testing-principles.md) | [Part 8](./08-playwright-best-practices.md) | [Part 9](./09-test-execution-strategies.md) | [Part 10](./10-best-practices-summary.md) | [Part 11](./11-anti-patterns-to-avoid.md) | [Part 12](./12-enforcement-and-code-review.md) | [Part 13](./13-references.md)
