# Testing Strategy - Using test.step for Improved Test Readability

> **Note**: This is part 14 of the testing strategy documentation. See navigation links below.

## Overview

Playwright's `test.step` feature allows you to annotate sections of test code with descriptive labels, creating a hierarchical structure that improves test readability, debugging, and reporting. This document provides comprehensive guidelines for using `test.step` in all E2E tests and fixtures.

## Why Use test.step?

### Benefits

1. **Better Test Reports**: Steps appear as collapsible sections in HTML reports with clear hierarchies
2. **Improved Debugging**: Failed tests show exactly which step failed in the trace viewer
3. **Self-Documenting Tests**: Steps provide high-level documentation of test flow
4. **Easier Maintenance**: Clear test structure makes it easier to understand and modify tests
5. **Better CI/CD Visibility**: Pipeline logs show step-by-step execution progress
6. **Enhanced Collaboration**: Non-technical stakeholders can understand test flows

### When to Use test.step

Use `test.step` in:

- **All @regression tests** - Wrap major workflow sections for clear reporting
- **Complex @spec tests** - Break down multi-phase tests into logical steps
- **Fixture implementations** - Wrap fixture logic for better debugging
- **Helper functions** - Annotate reusable test utilities

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

Steps can be nested to create hierarchies:

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

**After (with test.step):**

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

### Database Fixtures

**After:**

```typescript
executeQuery: async ({}, use, testInfo) => {
  await use(async (query: string | string[], params?: unknown[]) => {
    return await test.step(`Execute SQL: ${typeof query === 'string' ? query.substring(0, 50) : query[0]?.substring(0, 50)}...`, async () => {
      const client = await test.step('Connect to database', async () => {
        const { Client } = await import('pg')
        const client = new Client({ connectionString: connectionUrl })
        await client.connect()
        return client
      })

      try {
        return await test.step('Run query and parse results', async () => {
          const result = params ? await client.query(query, params) : await client.query(query)
          const rows = result.rows
          const rowCount = result.rowCount || 0
          return rows.length === 1 ? { rows, rowCount, ...rows[0] } : { rows, rowCount }
        })
      } finally {
        await test.step('Close database connection', async () => {
          await client.end()
        })
      }
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

### Phase 3: Complex @spec Tests (Medium Priority)

Migrate @spec tests with multiple phases:

1. Focus on tests with 50+ lines of code
2. Add steps to separate GIVEN-WHEN-THEN phases
3. Verify with: `bun test:e2e:spec`

### Phase 4: Fixtures (Long-term)

Gradually add steps to fixtures as they are modified:

- Add steps when fixing bugs in fixtures
- Add steps when adding new fixture features
- No rush - do incrementally

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
- Use nested steps for complex multi-phase operations
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

## Examples from Real Tests

### Example 1: Version Badge (@spec)

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

### Example 2: Sign-Up Flow (@regression)

```typescript
test(
  'API-AUTH-SIGN-UP-016: user can complete full sign-up workflow',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    await test.step('Setup: Start server with auth enabled', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
      })
    })

    await test.step('Sign up with valid credentials', async () => {
      const response = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'Regression User',
          email: 'regression@example.com',
          password: 'SecurePass123!',
        },
      })
      expect(response.status()).toBe(200)
    })

    await test.step('Sign in with new credentials', async () => {
      const response = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'regression@example.com',
          password: 'SecurePass123!',
        },
      })
      expect(response.status()).toBe(200)
    })

    await test.step('Verify authenticated session', async () => {
      await page.goto('/dashboard')
      await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
    })
  }
)
```

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
