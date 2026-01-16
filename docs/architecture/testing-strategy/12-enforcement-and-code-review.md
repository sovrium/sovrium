# Testing Strategy - E2E-First TDD with Test-After Unit Tests

> **Note**: This is part 12 of the split documentation. See navigation links below.

## Enforcement and Code Review

Since the E2E-First TDD with Test-After Unit Tests workflow cannot be fully automated via ESLint or TypeScript (timing discipline requires manual verification), **code review is the primary enforcement mechanism**.

### Automated Enforcement (ESLint)

The following aspects ARE enforced automatically via ESLint (see `eslint.config.ts`):
✅ **Test Tool Usage** (enforced via `no-restricted-imports` rule):

- **E2E tests in `specs/` directory must use Playwright** (not Bun Test)
  - Rule: `no-restricted-imports` (lines 591-609 in `eslint.config.ts`)
  - Restricts: `bun:test` imports in `specs/**/*.{ts,tsx}` files
  - Error message: "E2E tests (in specs/ directory) must use Playwright, not Bun Test. Import from @playwright/test instead."
- **Unit tests in `src/**/\*.test.ts` must use Bun Test\*\* (not Playwright)
  - Rule: `no-restricted-imports` (lines 611-629 in `eslint.config.ts`)
  - Restricts: `@playwright/test` imports in `src/**/*.test.{ts,tsx}` files
  - Error message: "Unit tests (\*.test.ts) must use Bun Test, not Playwright. Import from bun:test instead."
    ✅ **Test File Structure** (enforced via `eslint-plugin-playwright` configuration):
- E2E tests must have `.spec.ts` extension and be located in `specs/` directory
- Unit tests must have `.test.ts` extension and be co-located with source files
- Configuration: lines 647-665 in `eslint.config.ts`
  ❌ **NOT Enforced** (manual review required):
- Whether E2E tests were written BEFORE implementation (timing discipline)
- Whether unit tests were written AFTER implementation (timing discipline)
- Test coverage completeness (percentage thresholds)
- Quality of test assertions and Given-When-Then structure

### Pull Request Review Checklist

Use this checklist during code reviews to ensure the testing strategy is followed:

#### For New Features

- [ ] **E2E Test Exists**: Feature has E2E test in `specs/` directory defining completion criteria
- [ ] **E2E Test Timing**: E2E test was committed BEFORE or WITH implementation (check git history)
- [ ] **E2E Test Quality**: Test clearly defines feature completion criteria (not vague)
- [ ] **Unit Tests Exist**: Co-located unit tests exist for all implementation files
- [ ] **Unit Tests Timing**: Unit tests were committed AFTER implementation (check git history)
- [ ] **Unit Test Coverage**: Edge cases, error paths, and boundary conditions covered
- [ ] **All Tests Pass**: `bun test:all` succeeds
- [ ] **No Test Skips**: No `.skip()` or `.only()` in committed tests

#### For Refactoring

- [ ] **E2E Tests Still Pass**: Existing E2E tests verify no regression
- [ ] **Unit Tests Updated**: Unit tests reflect new implementation details
- [ ] **New Edge Cases**: Unit tests added for edge cases discovered during refactoring
- [ ] **No Test Deletion**: Tests only removed if feature removed (not to make tests pass)

#### For Bug Fixes

- [ ] **Reproducing Test First**: Test demonstrating bug was added BEFORE fix
- [ ] **Test Now Passes**: Reproducing test passes after fix
- [ ] **Unit Tests Added**: Additional unit tests for edge cases related to bug

### Red Flags (Reject Pull Request)

❌ **Implementation without E2E test**

- Feature code merged without corresponding E2E test
- E2E test written AFTER implementation is complete (defeats TDD purpose)
  ❌ **Missing unit tests after implementation**
- Feature marked as "done" without unit test coverage
- Unit tests skipped because "we have E2E tests"
  ❌ **Vague E2E tests**
- E2E test doesn't clearly define what "feature complete" means
- E2E test only checks happy path (doesn't verify feature completion)
  ❌ **Test coverage decreased**
- Pull request reduces overall test coverage percentage
  ❌ **Skipped tests in production**
- Tests marked with `.skip()` or `.only()` committed to main branch

### How to Verify Test Timing (Git History)

**Check if E2E test was written first**:

````bash

### Enforcement During Development
**Pre-commit Checks** (automated):
```bash

### Teaching Moment: Why Manual Enforcement?
**Static analysis cannot detect**:
- **Temporal order** - When code was written (before vs after)
- **Intent** - Whether test defines requirements or documents implementation
- **Completeness** - Whether tests adequately cover the feature
**Code review can verify**:
- Git history shows E2E tests written first
- Tests clearly define feature completion
- Edge cases are comprehensively covered
This is why **disciplined code review is essential** to the success of the E2E-First TDD with Test-After Unit Tests strategy.
---


## Navigation

[← Part 11](./11-anti-patterns-to-avoid.md) | [Part 13 →](./13-references.md)


**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-testing-approach.md) | [Part 4](./04-managing-red-tests-with-fixme.md) | [Part 5](./05-quick-reference-when-to-write-tests.md) | [Part 6](./06-test-file-naming-convention.md) | [Part 7](./07-testing-principles.md) | [Part 8](./08-playwright-best-practices.md) | [Part 9](./09-test-execution-strategies.md) | [Part 10](./10-best-practices-summary.md) | [Part 11](./11-anti-patterns-to-avoid.md) | **Part 12** | [Part 13](./13-references.md)
````
