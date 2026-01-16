# Testing Strategy - E2E-First TDD with Test-After Unit Tests

> **Note**: This is part 9 of the split documentation. See navigation links below.

## Test Execution Strategies

As your E2E test suite grows, running all tests becomes time-consuming. This section outlines strategies for running tests efficiently during development while maintaining comprehensive coverage in CI/CD.

### The Challenge: Speed vs. Coverage

**Problem:**

- **Development**: Need fast feedback (seconds, not minutes)
- **CI/CD**: Need comprehensive coverage (all scenarios)
- **Debugging**: Need granular tests to pinpoint failures
  **Solution:** Tag-based test execution with three test categories.

### Test Categories and Tags

Sovrium uses Playwright's tagging system to categorize E2E tests by purpose:
| Tag | Purpose | When to Run | Speed | Coverage |
| ------------- | ------------------------------- | ------------------------------------ | --------- | --------- |
| `@spec` | Specification tests (TDD) | During development, pre-commit | Fast | Granular |
| `@regression` | Regression tests (consolidated) | CI/CD, before releases | Medium | Broad |
| `@spec` | Critical path tests | Every commit, production smoke tests | Very Fast | Essential |

### 1. Specification Tests (`@spec`)

**Purpose:** Define feature completion criteria during TDD development.
**Characteristics:**

- **Granular** - One test per user story acceptance criterion
- **Fast** - Focused on specific behavior
- **Frequent** - Run during active development
- **Educational** - Document expected behavior in detail
  **When to use:**
- During TDD development (RED → GREEN cycle)
- Pre-commit verification
- Debugging specific feature behavior
  **Example:**

```typescript
// specs/auth/login.spec.ts
import { test, expect } from '@playwright/test'
test.describe('Login Flow - Specification', () => {
  // @spec - Validates email input behavior
  test('user can enter valid email', { tag: '@spec' }, async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('user@example.com')
    await expect(page.getByLabel('Email')).toHaveValue('user@example.com')
  })
  // @spec - Validates password input behavior
  test('user can enter password', { tag: '@spec' }, async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Password').fill('password123')
    await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password')
  })
  // @spec - Validates validation error display
  test('user sees error for invalid email', { tag: '@spec' }, async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('invalid-email')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Invalid email format')).toBeVisible()
  })
  // @spec - Validates successful login behavior
  test('user is redirected after successful login', { tag: '@spec' }, async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/dashboard')
  })
  // @spec - Validates session creation
  test('session is created on login', { tag: '@spec' }, async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    // Verify session cookie exists
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'session')).toBeDefined()
  })
})
```

**Running spec tests:**

````bash

### 2. Regression Tests (`@regression`)
**Purpose:** Validate complete workflows work end-to-end with consolidated coverage.
**Characteristics:**
- **Consolidated** - One test covers multiple acceptance criteria
- **Comprehensive** - Tests complete user journey
- **Efficient** - Fewer tests, broader coverage
- **CI-focused** - Optimized for automated pipelines
**When to use:**
- CI/CD pipeline (every push to main)
- Before releases
- Production smoke tests
- When you need high confidence with minimal test count
**Example:**
```typescript
// specs/auth/login.spec.ts (same file as spec tests)
import { test, expect } from '@playwright/test'
test.describe('Login Flow - Regression', () => {
  // @regression - Consolidates all spec tests above into one comprehensive test
  test('user can complete full login flow', { tag: '@regression' }, async ({ page }) => {
    // Given: User is on login page
    await page.goto('/login')
    // When: User enters invalid email
    await page.getByLabel('Email').fill('invalid-email')
    await page.getByRole('button', { name: 'Sign in' }).click()
    // Then: Validation error is shown
    await expect(page.getByText('Invalid email format')).toBeVisible()
    // When: User enters valid credentials
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    // Then: User is redirected to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.getByRole('heading')).toHaveText('Welcome')
    // Then: Session cookie is created
    const cookies = await page.context().cookies()
    expect(cookies.find((c) => c.name === 'session')).toBeDefined()
  })
})
````

**Running regression tests:**

````bash

### 3. Critical Path Tests (`@spec`)
**Purpose:** Validate essential workflows that must always work (authentication, checkout, data loss prevention).
**Characteristics:**
- **Essential** - Core functionality only
- **Fast** - Optimized for speed
- **Reliable** - Minimal flakiness
- **Always run** - Every commit, production deployments
**When to use:**
- Every commit (pre-merge checks)
- Production smoke tests after deployment
- Health checks in monitoring
- When you need maximum confidence in minimum time
**Example:**
```typescript
// specs/critical/critical-paths.spec.ts
import { test, expect } from '@playwright/test'
test.describe('Critical Paths', () => {
  // @spec - Must always work
  test('user can authenticate', { tag: '@spec' }, async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/dashboard')
  })
  // @spec - Data integrity
  test('user can save work', { tag: '@spec' }, async ({ page }) => {
    await page.goto('/editor')
    await page.getByRole('textbox').fill('Important data')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved successfully')).toBeVisible()
    // Reload and verify data persists
    await page.reload()
    await expect(page.getByRole('textbox')).toHaveValue('Important data')
  })
})
````

**Running critical tests:**

````bash

### Tag Combinations
Tests can have multiple tags for flexible execution:
```typescript
// Test is both a spec test AND a critical path
test('user can authenticate', { tag: ['@spec', '@spec'] }, async ({ page }) => {
  // This test runs during development (@spec) AND every commit (@spec)
  await page.goto('/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/dashboard')
})
// Test is both regression AND critical
test('complete checkout flow', { tag: ['@regression', '@spec'] }, async ({ page }) => {
  // This test runs in CI (@regression) AND every commit (@spec)
})
````

### Playwright Configuration for Tags

Playwright uses grep patterns to filter tests by tag metadata:

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  projects: [
    // Default - All tests (chromium only)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

**Tag filtering happens via CLI** with `--grep` flag:

- `playwright test --grep='@spec'` - Run spec tests only
- `playwright test --grep='@spec'` - Run critical tests only
- `playwright test --grep='@spec|@spec'` - Run spec OR critical tests

### Execution Strategy by Environment

| Environment                       | Tests to Run            | Command                   | Duration    |
| --------------------------------- | ----------------------- | ------------------------- | ----------- |
| **Development** (active coding)   | `@spec`                 | `bun test:e2e:spec`       | ~30 seconds |
| **Pre-commit** (local validation) | `@spec` + `@spec`       | `bun test:e2e:spec`       | ~1 minute   |
| **CI/CD** (every push)            | `@regression` + `@spec` | `bun test:e2e:regression` | ~5 minutes  |
| **Pre-release** (before deploy)   | All tests               | `bun test:e2e`            | ~15 minutes |
| **Production** (smoke test)       | `@spec`                 | `bun test:e2e:critical`   | ~30 seconds |

### NPM Scripts Configuration

Sovrium uses **grep-based** execution for all test filtering:

- Tag tests with `{ tag: '@spec' }` metadata in test definitions
- Use `--grep='@tag'` pattern matching for flexible tag combinations
- Supports OR logic with `|` operator (e.g., `@spec|@spec`)

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:spec": "playwright test --grep='@spec'",
    "test:e2e:critical": "playwright test --grep='@spec'",
    "test:e2e:spec": "playwright test --grep='@spec|@spec'",
    "test:e2e:regression": "playwright test --grep='@regression|@spec'"
  }
}
```

**Note**: The `test:e2e:critical` command serves as both the critical path test suite and production smoke tests. Use `--base-url` flag to run against different environments (e.g., `bun test:e2e:critical -- --base-url=https://production.sovrium.app`).

### TDD Workflow with Tags

**Step 1: Write RED spec test with `.fixme` and `@spec` tag**

```typescript
test.fixme('user can reset password', { tag: '@spec' }, async ({ page }) => {
  // Test defines completion criteria
  await page.goto('/reset-password')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByText('Check your email')).toBeVisible()
})
```

**Step 2: Implement feature until spec test passes**

```typescript
// Remove .fixme when implementation complete
test('user can reset password', { tag: '@spec' }, async ({ page }) => {
  await page.goto('/reset-password')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByText('Check your email')).toBeVisible()
})
```

**Step 3: Add regression test (consolidated workflow)**

```typescript
// Add regression test covering multiple password management scenarios
test('password management workflow', { tag: '@regression' }, async ({ page }) => {
  // Covers: reset password + change password + forgot password
  // Consolidated version of multiple @spec tests
})
```

**Step 4: Promote critical functionality**

```typescript
// If password reset is critical, add @spec tag
test('user can reset password', { tag: ['@spec', '@spec'] }, async ({ page }) => {
  // Now runs during development AND every commit
})
```

### Migration Strategy: Promoting Spec → Regression

As features mature, promote spec tests to regression tests:
**Option 1: Dual tagging (keep spec test, add to regression)**

```typescript
// Spec test becomes both @spec and @regression
test('user can complete checkout', { tag: ['@spec', '@regression'] }, async ({ page }) => {
  // Test runs in both development and CI/CD
})
```

**Option 2: Create dedicated regression test (keep spec, add regression)**

```typescript
// Keep granular spec tests
test('user can add item to cart', { tag: '@spec' }, async ({ page }) => {
  // Granular test for development
})
test('user can remove item from cart', { tag: '@spec' }, async ({ page }) => {
  // Granular test for development
})
// Add consolidated regression test
test('user can manage cart', { tag: '@regression' }, async ({ page }) => {
  // Consolidates add + remove + update quantity
  // Faster execution in CI/CD
})
```

**Option 3: Archive spec test (move to regression only)**

```typescript
// Original spec test
test('user can login', { tag: '@spec' }, async ({ page }) => {
  // ...
})
// After feature is stable, remove @spec tag and add @regression
test('user can login', { tag: '@regression' }, async ({ page }) => {
  // Now only runs in CI/CD
})
```

### Best Practices for Tagged Tests

1. **Start with `@spec` during TDD** - All new tests begin as specification tests
2. **Add `@spec` for essential workflows** - Authentication, data persistence, checkout
3. **Create `@regression` tests once stable** - Consolidate multiple spec tests into one
4. **Use multiple tags sparingly** - Only when test truly serves both purposes
5. **Review tag assignments quarterly** - Remove outdated `@spec` tags, add `@spec` as needed
6. **Document tag decisions** - Add comments explaining why test has specific tags

### Anti-Patterns to Avoid

❌ **Don't delete spec tests prematurely**

```typescript
// BAD - Deleting spec test after creating regression test
// test('user can enter email', { tag: '@spec' }, ...) // DELETED
// GOOD - Keep spec test, archive it
test('user can enter email', { tag: '@spec' }, ...) // Keep for debugging
test('complete login flow', { tag: '@regression' }, ...) // Add regression
```

❌ **Don't tag everything as `@spec`**

```typescript
// BAD - Too many critical tests
test('user can change theme', { tag: '@spec' }, ...) // Not critical
test('user can view profile', { tag: '@spec' }, ...) // Not critical
// GOOD - Only truly essential workflows
test('user can authenticate', { tag: '@spec' }, ...) // Critical
test('user can save work', { tag: '@spec' }, ...) // Critical
```

❌ **Don't create duplicate tests**

```typescript
// BAD - Same test in two files
// specs/spec/login.spec.ts
test('user can login', ...)
// specs/regression/login.spec.ts
test('user can login', ...) // Duplicate
// GOOD - One test, tagged appropriately
test('user can login', { tag: ['@spec', '@regression'] }, ...)
```

### Troubleshooting Tagged Tests

**Problem:** Spec test passes, regression test fails
**Solution:** Spec test may be too narrow. Regression test should cover broader workflow.

```typescript
// Spec test (too narrow)
test('user can click submit', { tag: '@spec' }, async ({ page }) => {
  await page.getByRole('button', { name: 'Submit' }).click()
  // Missing: form validation, API call, redirect
})
// Regression test (comprehensive)
test('user can submit form', { tag: '@regression' }, async ({ page }) => {
  // Fill form, validate, submit, verify redirect
})
```

**Problem:** Tests tagged `@spec` are flaky
**Solution:** Critical tests must be rock-solid. Add retries or fix flakiness before tagging as critical.

```typescript
// BAD - Flaky test tagged as critical
test('user can login', { tag: '@spec' }, async ({ page }) => {
  await page.waitForTimeout(3000) // Flaky
})
// GOOD - Stable test with auto-waiting
test('user can login', { tag: '@spec' }, async ({ page }) => {
  await expect(page.getByRole('button')).toBeEnabled() // Reliable
})
```

---

## Navigation

[← Part 8](./08-playwright-best-practices.md) | [Part 10 →](./10-best-practices-summary.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-testing-approach.md) | [Part 4](./04-managing-red-tests-with-fixme.md) | [Part 5](./05-quick-reference-when-to-write-tests.md) | [Part 6](./06-test-file-naming-convention.md) | [Part 7](./07-testing-principles.md) | [Part 8](./08-playwright-best-practices.md) | **Part 9** | [Part 10](./10-best-practices-summary.md) | [Part 11](./11-anti-patterns-to-avoid.md) | [Part 12](./12-enforcement-and-code-review.md) | [Part 13](./13-references.md)
