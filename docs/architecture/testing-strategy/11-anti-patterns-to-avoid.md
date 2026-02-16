# Testing Strategy - E2E-First TDD with Test-After Unit Tests

> **Note**: This is part 11 of the split documentation. See navigation links below.

## Anti-Patterns to Avoid

### E2E Tests (Written FIRST - TDD)

- ❌ Implementing features without E2E tests first
- ❌ Testing every edge case in E2E (use unit tests for edge cases)
- ❌ Relying on test execution order
- ❌ Using real-time data or live APIs (mock external dependencies)
- ❌ Manual screenshot comparison instead of assertions
- ❌ Tests that only pass on developer's machine
- ❌ Writing E2E tests after feature is complete (defeats purpose of TDD)
- ❌ Vague E2E tests that don't clearly define feature completion

### Unit Tests (Written AFTER - Test-After)

- ❌ Testing implementation details instead of behavior
- ❌ Shared mutable state between tests
- ❌ Tests depending on execution order
- ❌ Actual network calls or database queries
- ❌ Manual verification of console output
- ❌ Skipping unit tests after implementation ("we have E2E tests, that's enough")
- ❌ Writing unit tests before understanding actual implementation (premature)
- ❌ Incomplete edge case coverage (unit tests should be comprehensive)
- ❌ **Using `mock.module()` for application modules** - Causes process-global contamination and cross-file test failures (see [Part 16](./16-test-mocking-dependency-injection-over-mock-module.md) for architectural decision and DI patterns)
- ❌ Relying on `mock.restore()` to fix module cache contamination (it doesn't evict cached evaluations)

---

## Navigation

[← Part 10](./10-best-practices-summary.md) | [Part 12 →](./12-enforcement-and-code-review.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-testing-approach.md) | [Part 4](./04-managing-red-tests-with-fixme.md) | [Part 5](./05-quick-reference-when-to-write-tests.md) | [Part 6](./06-test-file-naming-convention.md) | [Part 7](./07-testing-principles.md) | [Part 8](./08-playwright-best-practices.md) | [Part 9](./09-test-execution-strategies.md) | [Part 10](./10-best-practices-summary.md) | **Part 11** | [Part 12](./12-enforcement-and-code-review.md) | [Part 13](./13-references.md)
