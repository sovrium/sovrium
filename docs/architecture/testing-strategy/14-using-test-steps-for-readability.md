# Testing Strategy - Using test.step for Improved Test Readability

> **Note**: This is part 14 of the testing strategy documentation. See navigation links below.

## Overview

Playwright's `test.step` feature allows you to annotate sections of test code with descriptive labels, creating a hierarchical structure that improves test readability, debugging, and reporting. This document provides comprehensive guidelines for using `test.step` in all E2E tests and fixtures, along with architectural rationale and adoption metrics.

## Pattern Status

- **Status**: Active and enforced through code review
- **Adoption**: 8 spec files currently use test.step (~3.7% of 219 total)
- **Target Adoption**: 100% of @regression tests (priority), 80% of complex @spec tests
- **Enforcement**: Code review (no ESLint rules yet)

## Why This Pattern Exists

### Problem Statement

Without structured test steps, E2E tests face several challenges:

1. **Poor CI/CD Visibility**: Test failures show only "test failed" without indicating which phase failed
2. **Difficult Debugging**: Trace viewer shows flat execution without logical grouping
3. **Unclear Test Intent**: Reading test code requires deep analysis to understand workflow
4. **Slow Maintenance**: Developers spend significant time understanding test structure before modifying
5. **Limited Collaboration**: Non-technical stakeholders cannot understand test coverage

### Solution: Hierarchical Test Steps

Playwright's `test.step` creates hierarchical structure that:

- **Improves Reporting**: HTML reports show collapsible step hierarchies
- **Enhances Debugging**: Trace viewer displays exactly which step failed
- **Self-Documents Tests**: Step names provide high-level test flow documentation
- **Accelerates Reviews**: PR reviewers understand test intent without reading implementation
- **Enables Visibility**: CI logs show step-by-step progress during execution

### Benefits

1. **Better Test Reports**: Steps appear as collapsible sections in HTML reports with clear hierarchies
2. **Improved Debugging**: Failed tests show exactly which step failed in the trace viewer (reduces debug time by 50-70%)
3. **Self-Documenting Tests**: Steps provide high-level documentation of test flow
4. **Easier Maintenance**: Clear test structure makes it easier to understand and modify tests
5. **Better CI/CD Visibility**: Pipeline logs show step-by-step execution progress
6. **Enhanced Collaboration**: Non-technical stakeholders can understand test flows

### When to Use test.step

#### Mandatory Usage

- **All @regression tests**: Wrap workflow scenarios in descriptive steps
- **Complex @spec tests**: Tests with 50+ lines or multiple phases

#### Optional Usage

- **Simple @spec tests**: Tests under 20 lines may skip steps if they provide no value
- **Fixture implementations**: Add steps incrementally when modifying fixtures
- **Helper functions**: Annotate reusable test utilities when beneficial

## Official Documentation

For complete API reference, see:

- [Playwright Test API](https://playwright.dev/docs/api/class-test) - Main test.step documentation
- [TestStep API](https://playwright.dev/docs/api/class-teststep) - Step object reference
- [TestStepInfo API](https://playwright.dev/docs/api/class-teststepinfo) - Step metadata and control

## Basic Syntax

```typescript
import { test, expect } from '@playwright/test'

test('test name', async ({ page }) => {
  await test.step('Step name', async () => {
    // Step implementation
  })
})
```

### Return Values

Steps can return values that are used by subsequent steps:

```typescript
const userId = await test.step('Create user', async () => {
  const response = await page.request.post('/api/users', { data: { name: 'Alice' } })
  const data = await response.json()
  return data.id // Return value available to test
})

await test.step('Verify user profile', async () => {
  await page.goto(`/users/${userId}`) // Use returned value
  await expect(page.getByText('Alice')).toBeVisible()
})
```

### Nested Steps

Steps can be nested to create hierarchies (maximum 3 levels recommended):

```typescript
await test.step('Complete checkout process', async () => {
  await test.step('Fill shipping address', async () => {
    await page.getByLabel('Street').fill('123 Main St')
    await page.getByLabel('City').fill('San Francisco')
  })

  await test.step('Select payment method', async () => {
    await page.getByRole('radio', { name: 'Credit Card' }).check()
  })

  await test.step('Confirm order', async () => {
    await page.getByRole('button', { name: 'Place Order' }).click()
  })
})
```

## Step Naming Conventions

### Imperative Form (Action-Oriented)

Use imperative verbs for steps that perform actions:

**✅ GOOD:**

```typescript
await test.step('Create authenticated user', async () => {
  /* ... */
})
await test.step('Navigate to settings page', async () => {
  /* ... */
})
await test.step('Fill registration form', async () => {
  /* ... */
})
await test.step('Submit form and verify response', async () => {
  /* ... */
})
```

**❌ BAD:**

```typescript
await test.step('User creation', async () => {
  /* ... */
}) // Noun form
await test.step('Creating user', async () => {
  /* ... */
}) // Gerund form
await test.step('User is created', async () => {
  /* ... */
}) // Passive voice
```

### Specific and Descriptive

Steps should clearly communicate what they do:

**✅ GOOD:**

```typescript
await test.step('Sign up with valid credentials', async () => {
  /* ... */
})
await test.step('Verify email confirmation sent', async () => {
  /* ... */
})
await test.step('Complete two-factor authentication', async () => {
  /* ... */
})
```

**❌ BAD:**

```typescript
await test.step('Test signup', async () => {
  /* ... */
}) // Too vague
await test.step('Do stuff', async () => {
  /* ... */
}) // Non-descriptive
await test.step('Step 1', async () => {
  /* ... */
}) // Meaningless
```

### Align with GIVEN-WHEN-THEN Structure

For @spec tests, align steps with BDD comments:

```typescript
test(
  'API-AUTH-001: should authenticate user with valid credentials',
  { tag: '@spec' },
  async ({ page }) => {
    await test.step('GIVEN: Server with auth enabled and test user', async () => {
      await startServerWithSchema({
        /* ... */
      })
      await createUser({ email: 'test@example.com', password: 'Pass123!' })
    })

    await test.step('WHEN: User submits valid credentials', async () => {
      await page.goto('/login')
      await page.getByLabel('Email').fill('test@example.com')
      await page.getByLabel('Password').fill('Pass123!')
      await page.getByRole('button', { name: 'Sign In' }).click()
    })

    await test.step('THEN: User is authenticated and redirected', async () => {
      await expect(page).toHaveURL('/dashboard')
      await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
    })
  }
)
```

## Patterns for Different Test Types

### @spec Tests (Exhaustive Acceptance Criteria)

For @spec tests, use steps to separate GIVEN-WHEN-THEN phases:

**Before (without test.step):**

```typescript
test(
  'APP-VERSION-001: should display version badge with correct version text',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with name and simple SemVer version '1.0.0'
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '1.0.0',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: version badge is visible with correct version text
    const versionBadge = page.locator('[data-testid="app-version-badge"]')
    await expect(versionBadge).toBeVisible()
    await expect(versionBadge).toHaveText('1.0.0')
  }
)
```

**After (with test.step):**

```typescript
test(
  'APP-VERSION-001: should display version badge with correct version text',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    await test.step('GIVEN: App with simple SemVer version', async () => {
      await startServerWithSchema(
        {
          name: 'test-app',
          version: '1.0.0',
        },
        { useDatabase: false }
      )
    })

    await test.step('WHEN: User navigates to homepage', async () => {
      await page.goto('/')
    })

    await test.step('THEN: Version badge displays correct text', async () => {
      const versionBadge = page.locator('[data-testid="app-version-badge"]')
      await expect(versionBadge).toBeVisible()
      await expect(versionBadge).toHaveText('1.0.0')
    })
  }
)
```

### @regression Tests (Optimized Integration Workflows)

For @regression tests, use steps to wrap major workflow sections:

**Before (without test.step):**

```typescript
test(
  'APP-VERSION-008: user can view version badge with all SemVer variations',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    // Scenario 1: Simple SemVer
    await startServerWithSchema({ name: 'test-app', version: '1.0.0' }, { useDatabase: false })
    await page.goto('/')
    const versionBadge = page.locator('[data-testid="app-version-badge"]')
    await expect(versionBadge).toBeVisible()
    await expect(versionBadge).toHaveText('1.0.0')

    // Scenario 2: Missing version
    await startServerWithSchema({ name: 'test-app' }, { useDatabase: false })
    await page.goto('/')
    await expect(page.locator('[data-testid="app-version-badge"]')).toBeHidden()

    // ... more scenarios
  }
)
```

**After (with test.step):**

```typescript
test(
  'APP-VERSION-008: user can view version badge with all SemVer variations',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    await test.step('Scenario 1: Display simple SemVer version', async () => {
      await startServerWithSchema({ name: 'test-app', version: '1.0.0' }, { useDatabase: false })
      await page.goto('/')
      const versionBadge = page.locator('[data-testid="app-version-badge"]')
      await expect(versionBadge).toBeVisible()
      await expect(versionBadge).toHaveText('1.0.0')
    })

    await test.step('Scenario 2: Hide badge when version is missing', async () => {
      await startServerWithSchema({ name: 'test-app' }, { useDatabase: false })
      await page.goto('/')
      await expect(page.locator('[data-testid="app-version-badge"]')).toBeHidden()
    })

    await test.step('Scenario 3: Display pre-release version', async () => {
      await startServerWithSchema(
        { name: 'test-app', version: '2.0.0-beta.1' },
        { useDatabase: false }
      )
      await page.goto('/')
      await expect(page.locator('[data-testid="app-version-badge"]')).toHaveText('2.0.0-beta.1')
    })
  }
)
```

### API Tests with Request/Response Validation

For API tests, use steps to separate request setup, execution, and validation:

```typescript
test(
  'API-AUTH-SIGN-UP-001: should return 200 OK with user data',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    await test.step('GIVEN: Server with auth enabled', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
      })
    })

    const response = await test.step('WHEN: User submits valid sign-up credentials', async () => {
      return await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'SecurePass123!',
        },
      })
    })

    await test.step('THEN: Response contains user data and session', async () => {
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('email', 'john@example.com')
    })
  }
)
```

## Using test.step in Fixtures

Fixtures should also use `test.step` to annotate their internal logic:

### Authentication Fixtures

**Before:**

```typescript
signUp: async ({ page }, use) => {
  await use(async (data: SignUpData): Promise<AuthResult> => {
    const response = await page.request.post('/api/auth/sign-up/email', {
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
      },
    })

    if (!response.ok()) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Sign up failed: ${JSON.stringify(errorData)}`)
    }

    const result = await response.json()
    return {
      user: result.user,
      session: result.session,
    }
  })
}
```

**After:**

```typescript
signUp: async ({ page }, use) => {
  await use(async (data: SignUpData): Promise<AuthResult> => {
    return await test.step(`Sign up user: ${data.email}`, async () => {
      const response = await test.step('POST /api/auth/sign-up/email', async () => {
        return await page.request.post('/api/auth/sign-up/email', {
          data: {
            email: data.email,
            password: data.password,
            name: data.name,
          },
        })
      })

      await test.step('Validate response', async () => {
        if (!response.ok()) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`Sign up failed: ${JSON.stringify(errorData)}`)
        }
      })

      return await test.step('Parse and return auth result', async () => {
        const result = await response.json()
        return {
          user: result.user,
          session: result.session,
        }
      })
    })
  })
}
```

## Helper Functions with test.step

Reusable helper functions should also use `test.step`:

### Before (without test.step):

```typescript
async function createTestUser(page: Page, email: string) {
  await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'Test User', email, password: 'Pass123!' },
  })
  await page.request.post('/api/auth/sign-in/email', {
    data: { email, password: 'Pass123!' },
  })
}
```

### After (with test.step):

```typescript
async function createTestUser(page: Page, email: string) {
  return await test.step(`Create and authenticate user: ${email}`, async () => {
    await test.step('Sign up', async () => {
      await page.request.post('/api/auth/sign-up/email', {
        data: { name: 'Test User', email, password: 'Pass123!' },
      })
    })

    await test.step('Sign in', async () => {
      await page.request.post('/api/auth/sign-in/email', {
        data: { email, password: 'Pass123!' },
      })
    })
  })
}
```

## Advanced Features

### Step Timeout

Set a timeout for specific steps:

```typescript
await test.step(
  'Wait for slow API response',
  async () => {
    await page.waitForResponse('**/api/slow-endpoint')
  },
  { timeout: 60000 }
) // 60 second timeout for this step only
```

### Step Location (Custom Source)

Override the location shown in reports:

```typescript
await test.step(
  'Custom step',
  async () => {
    // Implementation
  },
  { location: { file: 'helpers.ts', line: 42, column: 8 } }
)
```

### Boxed Steps (Error Handling)

Box steps to make errors point to the step call site rather than internals:

```typescript
await test.step(
  'Complex operation',
  async () => {
    // If an error occurs inside, stack trace points to this line
    await someComplexOperation()
  },
  { box: true }
)
```

### Step Attachments (TestStepInfo)

Attach data to steps for better debugging:

```typescript
await test.step('Verify API response', async (stepInfo) => {
  const response = await page.request.get('/api/data')
  const data = await response.json()

  // Attach response data to step
  await stepInfo.attach('api-response', {
    body: JSON.stringify(data, null, 2),
    contentType: 'application/json',
  })

  expect(data).toHaveProperty('status', 'success')
})
```

## Migration Strategy

### Phase 1: New Tests (Immediate)

All new tests written from now on MUST use `test.step`:

- Use steps in all @spec tests (GIVEN-WHEN-THEN)
- Use steps in all @regression tests (scenarios)
- Use steps in new fixtures

### Phase 2: Regression Tests (Priority)

Migrate existing @regression tests first (highest ROI):

1. Identify all @regression tests: `grep -r '@regression' specs/`
2. Add steps to wrap major workflow sections
3. Test locally: `bun test:e2e:regression`
4. Commit with message: `refactor: add test.step to [feature] regression tests`

**Target**: 100% of @regression tests

### Phase 3: Complex @spec Tests (Medium Priority)

Migrate @spec tests with multiple phases:

1. Focus on tests with 50+ lines of code
2. Add steps to separate GIVEN-WHEN-THEN phases
3. Verify with: `bun test:e2e:spec`

**Target**: 80% of complex @spec tests

### Phase 4: Fixtures (Long-term)

Gradually add steps to fixtures as they are modified:

- Add steps when fixing bugs in fixtures
- Add steps when adding new fixture features
- No rush - do incrementally

**Target**: 30-40% of fixtures

### Phase 5: Simple @spec Tests (Optional)

Simple @spec tests (single assertions) can remain without steps:

- Tests under 20 lines
- Single-phase tests (only THEN, no GIVEN/WHEN)
- Low complexity tests

## Best Practices Summary

### DO ✅

- Use imperative verbs in step names ("Create user", "Verify email")
- Be specific and descriptive ("Sign up with valid credentials")
- Align with GIVEN-WHEN-THEN structure in @spec tests
- Wrap major workflow sections in @regression tests
- Use nested steps for complex multi-phase operations (max 3 levels)
- Return values from steps when needed
- Use steps in fixtures for better debugging
- Keep step names concise but clear (50 characters max)

### DON'T ❌

- Use vague names ("Test stuff", "Step 1")
- Use noun/gerund forms ("User creation", "Creating user")
- Create steps for single assertions (over-engineering)
- Nest steps more than 3 levels deep (readability issues)
- Use steps in simple helper functions (< 5 lines)
- Add steps just for the sake of it (must add value)

## Common Pitfalls

### Pitfall 1: Over-Granularization

❌ **Wrong**:

```typescript
await test.step('Click button', async () => {
  await page.getByRole('button').click()
})
await test.step('Check text', async () => {
  await expect(page.getByText('Success')).toBeVisible()
})
```

✅ **Correct**:

```typescript
await test.step('Submit form and verify success', async () => {
  await page.getByRole('button').click()
  await expect(page.getByText('Success')).toBeVisible()
})
```

### Pitfall 2: Deep Nesting (>3 Levels)

❌ **Wrong**:

```typescript
await test.step('Level 1', async () => {
  await test.step('Level 2', async () => {
    await test.step('Level 3', async () => {
      await test.step('Level 4', async () => {
        // Too deep
      })
    })
  })
})
```

✅ **Correct**:

```typescript
await test.step('Complete checkout', async () => {
  await test.step('Fill shipping', async () => {
    // Implementation
  })
  await test.step('Select payment', async () => {
    // Implementation
  })
  await test.step('Confirm order', async () => {
    // Implementation
  })
})
```

### Pitfall 3: Vague Step Names

❌ **Wrong**:

```typescript
await test.step('Test user', async () => {
  /* ... */
})
await test.step('Step 1', async () => {
  /* ... */
})
```

✅ **Correct**:

```typescript
await test.step('Create authenticated user', async () => {
  /* ... */
})
await test.step('Verify user can access protected resource', async () => {
  /* ... */
})
```

## Enforcement

### Current State

- **No ESLint rules**: test.step usage is currently enforced through code review
- **Documentation**: Comprehensive guides and examples available
- **Team Standard**: Expected pattern for all new @regression tests

### Manual Review Checklist

During PR reviews, verify:

- [ ] All @regression tests use test.step to wrap scenarios
- [ ] Complex @spec tests (50+ lines) use test.step for GIVEN-WHEN-THEN
- [ ] Step names are imperative and descriptive
- [ ] Step nesting depth is under 3 levels
- [ ] Steps are logically grouped (setup, action, verification)
- [ ] HTML report shows clear hierarchical structure

### Potential ESLint Enforcement (Future)

No ESLint rules currently exist to enforce test.step usage. Potential future enforcement options:

1. **Custom ESLint Rule**: Detect @regression tests without test.step
   - **Complexity**: High (requires AST analysis to detect test.step usage)
   - **Value**: Automates enforcement for new tests
   - **Trade-off**: May be brittle if test patterns evolve

2. **Playwright Reporter Plugin**: Custom reporter that warns if @regression tests lack steps
   - **Complexity**: Medium (uses Playwright's reporter API)
   - **Value**: Non-blocking feedback during test execution
   - **Trade-off**: Post-execution feedback (doesn't prevent commit)

3. **Pre-commit Hook**: Script validates @regression tests have test.step
   - **Complexity**: Low (grep/regex-based detection)
   - **Value**: Fast feedback before commit
   - **Trade-off**: May have false positives/negatives

**Recommendation**: Continue with code review enforcement for now. Consider custom ESLint rule if adoption drops below 80%.

## Success Metrics

### Quantitative Metrics

| Metric                       | Baseline  | Target (Phase 2) | Target (Phase 3) |
| ---------------------------- | --------- | ---------------- | ---------------- |
| @regression tests with steps | 0%        | 100%             | 100%             |
| @spec tests with steps       | 0%        | 0%               | 80%+             |
| Fixtures with steps          | 0%        | 10-20%           | 30-40%           |
| Average debug time           | 15-20 min | 7-10 min         | 5-8 min          |
| PR review time               | 10-15 min | 7-10 min         | 5-7 min          |

### Qualitative Metrics

**Developer Feedback** (post-Phase 2 survey):

- "test.step improved test readability" - target: 80%+ agreement
- "Debugging is faster with steps" - target: 75%+ agreement
- "Steps add too much noise" - target: <20% agreement

**Code Review Quality**:

- Reviewers understand test flow without deep code analysis
- Reviewers identify coverage gaps more easily
- Test maintenance suggestions are more specific

## Current Adoption Status

**Files using test.step**: 8 spec files (as of 2025-12-02)

- `specs/api/auth/sign-up/email/post.spec.ts`
- `specs/api/auth/sign-in/email/post.spec.ts`
- `specs/api/auth/change-password/post.spec.ts`
- `specs/api/auth/verify-email/get.spec.ts`
- `specs/api/auth/sign-out/post.spec.ts`
- `specs/api/auth/send-verification-email/post.spec.ts`
- `specs/api/auth/update-user/patch.spec.ts`
- `specs/templates/landing-page.spec.ts`

**Total spec files**: 219
**@regression test occurrences**: 260 across 100 files
**Adoption Rate**: ~3.7% (8/219) - Early adoption phase
**Target**: 100% of @regression tests (priority), 80% of complex @spec tests

## Quality Checklist

Before considering a test migration complete, verify:

- [ ] All major workflow sections are wrapped in steps
- [ ] Step names are imperative and descriptive
- [ ] Steps align with GIVEN-WHEN-THEN structure (@spec tests)
- [ ] Steps wrap scenarios in @regression tests
- [ ] Nested steps are used appropriately (not too deep)
- [ ] Tests run successfully: `bun test:e2e`
- [ ] HTML report shows clear step hierarchy
- [ ] Steps improve readability without adding noise

## Validation

After implementing steps, validate improvements:

### 1. Run Tests and Check Report

```bash
bun test:e2e
bun run playwright show-report
```

### 2. Verify Step Hierarchy

- Open HTML report
- Expand failed tests (if any)
- Verify steps are clearly visible
- Check nesting makes sense

### 3. Review Trace Viewer

```bash
bun run playwright show-trace
```

- Open a trace file
- Verify steps appear in timeline
- Check that failed step is highlighted

### 4. Compare Before/After Readability

- Read test without looking at code
- Can you understand the flow from steps alone?
- Are step names descriptive enough?

## Resources

### Official Documentation

- [Playwright Test API](https://playwright.dev/docs/api/class-test) - test.step reference
- [TestStep API](https://playwright.dev/docs/api/class-teststep) - Step object details
- [TestStepInfo API](https://playwright.dev/docs/api/class-teststepinfo) - Step metadata

### Community Articles

- [Improve Your Playwright Documentation with Test Steps](https://www.checklyhq.com/blog/improve-your-playwright-documentation-with-steps/)
- [Keep your Playwright tests structured with steps](https://timdeschryver.dev/blog/keep-your-playwright-tests-structured-with-steps)
- [Box Test Steps in Playwright](https://dev.to/playwright/box-test-steps-in-playwright-15d9)

## Related Documentation

- [Part 3: Testing Approach](./03-testing-approach.md) - GIVEN-WHEN-THEN structure
- [Part 8: Playwright Best Practices](./08-playwright-best-practices.md) - Core Playwright patterns
- [Part 10: Best Practices Summary](./10-best-practices-summary.md) - General testing guidelines

---

## Navigation

[← Part 13](./13-references.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-testing-approach.md) | [Part 4](./04-managing-red-tests-with-fixme.md) | [Part 5](./05-quick-reference-when-to-write-tests.md) | [Part 6](./06-test-file-naming-convention.md) | [Part 7](./07-testing-principles.md) | [Part 8](./08-playwright-best-practices.md) | [Part 9](./09-test-execution-strategies.md) | [Part 10](./10-best-practices-summary.md) | [Part 11](./11-anti-patterns-to-avoid.md) | [Part 12](./12-enforcement-and-code-review.md) | [Part 13](./13-references.md) | **Part 14**
