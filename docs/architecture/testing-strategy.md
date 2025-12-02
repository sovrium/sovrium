# Testing Strategy - E2E-First TDD with Test-After Unit Tests

**Testing Tools**: Playwright ^1.57.0 (E2E) | Bun 1.3.3 (Unit) | TypeScript ^5.9.3

## Overview

Sovrium uses a **dual-timing testing strategy** that optimizes for both feature clarity and implementation quality:

- **E2E Tests (TDD)**: Written BEFORE implementation as executable specifications defining feature completion
- **Unit Tests (Test-After)**: Written AFTER implementation to document the actual solution and enable confident refactoring

Both test types follow **F.I.R.S.T principles** (Fast, Isolated, Repeatable, Self-validating, Timely) and use **Given-When-Then structure**.

**Development Flow**: Write E2E Test (RED) → Implement Feature (GREEN) → Add Unit Tests (REFACTOR) → Done

## Testing Approach

**E2E-First (TDD)**:

- Write E2E tests BEFORE implementing features
- Prevents scope creep and ensures critical user workflows are verified
- Use Playwright's `.fixme` modifier for RED tests (allows CI to stay green during development)

**Unit-After (Test-After)**:

- Write unit tests AFTER implementing features
- Document actual implementation details and edge cases
- Provide fast feedback for refactoring

## Managing Red Tests with `.fixme`

When writing E2E tests BEFORE implementation, use `.fixme` to mark tests as known failures:

**Step 1: Write RED test with `.fixme`**

```typescript
test.fixme('should display version badge when app has version', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="app-version-badge"]')).toBeVisible()
})
```

**Step 2: Implement feature** (GREEN phase)

**Step 3: Remove `.fixme` when implementation is complete**

```typescript
test('should display version badge when app has version', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="app-version-badge"]')).toBeVisible()
})
```

## Quick Reference

### When to Write Tests

| Test Type      | Timing             | Purpose                                | Location           | Tool       |
| -------------- | ------------------ | -------------------------------------- | ------------------ | ---------- |
| **E2E Tests**  | BEFORE (TDD)       | Define feature completion criteria     | `specs/*.spec.ts`  | Playwright |
| **Unit Tests** | AFTER (Test-After) | Document implementation and edge cases | `src/**/*.test.ts` | Bun Test   |

### Test File Naming Convention (Pattern-Based)

| Test Type      | Extension  | Location               | Example                  |
| -------------- | ---------- | ---------------------- | ------------------------ |
| **Unit Tests** | `.test.ts` | Co-located with source | `src/calculator.test.ts` |
| **E2E Tests**  | `.spec.ts` | `specs/` directory     | `specs/login.spec.ts`    |

**CRITICAL - Architectural Pattern**: Test separation is enforced via **filename pattern filtering**, not directory structure:

- **Unit tests run with**: `bun test --concurrent .test.ts .test.tsx` (pattern-based filtering)
- **E2E tests run with**: `playwright test` (discovers `*.spec.ts` in `specs/`)
- **ESLint enforcement**: Prevents wrong test runner usage (Playwright in unit tests, Bun Test in E2E tests)

**Why This Matters Architecturally**:

- **Separation by file extension** enables co-location without conflicts (unit tests next to source, E2E tests with schemas)
- **Simple pattern filtering** makes test execution robust: `bun test .test.ts .test.tsx` excludes `.spec.ts` files automatically
- **Cross-layer convention** applies consistently across Domain, Application, Infrastructure, and Presentation layers

See `@docs/architecture/testing-strategy/06-test-file-naming-convention.md` for complete architectural rationale and enforcement details.

### Test Execution Commands

| Environment                     | Tests                   | Command                   | Duration    |
| ------------------------------- | ----------------------- | ------------------------- | ----------- |
| **Development** (active coding) | `@spec`                 | `bun test:e2e:spec`       | ~30 seconds |
| **Pre-commit**                  | `@spec` + `@spec`       | `bun test:e2e:spec`       | ~1 minute   |
| **CI/CD**                       | `@regression` + `@spec` | `bun test:e2e:regression` | ~5 minutes  |
| **Pre-release**                 | All tests               | `bun test:e2e`            | ~15 minutes |
| **Production**                  | `@spec`                 | `bun test:e2e:critical`   | ~30 seconds |

**Run all tests**: `bun test:all` (unit + E2E)

## On-Demand Documentation

For detailed information, import the relevant documentation file:

### Getting Started

- **Quick Start**: `@docs/architecture/testing-strategy/01-start.md`
  - Essential commands and workflow summary for immediate use

### Core Concepts

- **Overview**: `@docs/architecture/testing-strategy/02-overview.md`
  - High-level explanation of the dual-timing strategy
- **Testing Approach**: `@docs/architecture/testing-strategy/03-testing-approach.md`
  - Detailed explanation of E2E-First TDD + Unit-After with visual workflow
- **Managing Red Tests with `.fixme`**: `@docs/architecture/testing-strategy/04-managing-red-tests-with-fixme.md`
  - Complete guide to using Playwright's `.fixme` modifier during TDD
- **When to Write Tests**: `@docs/architecture/testing-strategy/05-quick-reference-when-to-write-tests.md`
  - Decision matrix for test timing and tool selection
- **Test File Naming**: `@docs/architecture/testing-strategy/06-test-file-naming-convention.md`
  - Naming conventions and file organization

### Testing Principles

- **F.I.R.S.T Principles**: `@docs/architecture/testing-strategy/07-testing-principles.md`
  - Fast, Isolated, Repeatable, Self-validating, Timely with comprehensive examples
  - Given-When-Then structure for both E2E and unit tests
  - Effect Schema validation examples

### Playwright Best Practices

- **Best Practices**: `@docs/architecture/testing-strategy/08-playwright-best-practices.md`
  - Testing philosophy (user-visible behavior, isolation)
  - Locator best practices (role-based, chaining, codegen)
  - Assertions and auto-waiting
  - Anti-patterns to avoid

### Test Execution Strategies

- **Tag-Based Execution**: `@docs/architecture/testing-strategy/09-test-execution-strategies.md`
  - Test categories: `@spec`, `@regression`, `@spec`
  - Execution strategy by environment
  - TDD workflow with tags
  - Migration strategies (promoting spec to regression)

### Summaries and Checklists

- **Best Practices Summary**: `@docs/architecture/testing-strategy/10-best-practices-summary.md`
  - Consolidated checklist for E2E and unit tests
- **Anti-Patterns**: `@docs/architecture/testing-strategy/11-anti-patterns-to-avoid.md`
  - Common mistakes and red flags for both test types
- **Enforcement and Code Review**: `@docs/architecture/testing-strategy/12-enforcement-and-code-review.md`
  - Automated enforcement (ESLint rules)
  - Pull request review checklist
  - Red flags for rejecting PRs

### References

- **External Resources**: `@docs/architecture/testing-strategy/13-references.md`
  - Links to F.I.R.S.T principles, Given-When-Then, Bun Test, Playwright docs

## How to Use This Documentation

1. **Start here** for quick reference and essential commands
2. **Import detailed docs** on-demand using `@docs/architecture/testing-strategy/{file}`
3. **Navigation**: Each detailed file includes cross-references to related topics

## Automated Enforcement

### ESLint Rules (Enforced Automatically)

**Test Tool Usage** (enforced via `no-restricted-imports` in `eslint.config.ts`):

- **E2E tests in `specs/` must use Playwright** (not Bun Test)
  - Restricts: `bun:test` imports in `specs/**/*.{ts,tsx}`
  - Error: "E2E tests must use Playwright"

- **Unit tests in `src/**/\*.test.ts` must use Bun Test\*\* (not Playwright)
  - Restricts: `@playwright/test` imports in `src/**/*.test.{ts,tsx}`
  - Error: "Unit tests must use Bun Test"

**What IS Enforced**:

- ✅ Import restrictions (which test tool is used where)

**What is NOT Enforced**:

- ❌ File naming convention (`.spec.ts` vs `.test.ts` - by convention only)

### Manual Enforcement (Code Review Required)

**Not enforceable via static analysis**:

- File naming convention compliance (`.spec.ts` for E2E, `.test.ts` for unit)
- E2E tests written BEFORE implementation (timing discipline)
- Unit tests written AFTER implementation (timing discipline)
- Test coverage completeness
- Quality of Given-When-Then structure

See `@docs/architecture/testing-strategy/12-enforcement-and-code-review.md` for pull request review checklist.

## Related Documentation

- **Bun Test**: `@docs/infrastructure/testing/bun-test.md` - Tool configuration and usage
- **Playwright**: `@docs/infrastructure/testing/playwright.md` - Tool configuration and usage
- **ESLint**: `@docs/infrastructure/quality/eslint.md` - Linting rules enforcement
