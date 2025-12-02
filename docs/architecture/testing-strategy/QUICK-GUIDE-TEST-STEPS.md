# Quick Guide: Implementing test.step in E2E Tests

This is a condensed guide for quickly implementing `test.step` in Playwright E2E tests. For comprehensive documentation, see [Part 14: Using test.step for Readability](./14-using-test-steps-for-readability.md).

## Why Use test.step?

- **Better Reports**: Collapsible hierarchical structure in HTML reports
- **Improved Debugging**: Trace viewer shows exactly which step failed
- **Self-Documenting**: Steps provide high-level test flow documentation
- **Enhanced CI/CD**: Pipeline logs show step-by-step progress

## Basic Syntax

```typescript
import { test, expect } from '@playwright/test'

test('test name', async ({ page }) => {
  await test.step('Step description', async () => {
    // Step implementation
  })
})
```

## Quick Patterns

### @spec Tests (GIVEN-WHEN-THEN)

```typescript
test('SPEC-001: should do something', { tag: '@spec' }, async ({ page, startServerWithSchema }) => {
  await test.step('GIVEN: Preconditions', async () => {
    await startServerWithSchema({
      /* config */
    })
  })

  await test.step('WHEN: User action', async () => {
    await page.goto('/somewhere')
    await page.getByRole('button').click()
  })

  await test.step('THEN: Expected outcome', async () => {
    await expect(page.getByText('Success')).toBeVisible()
  })
})
```

### @regression Tests (Scenarios)

```typescript
test(
  'SPEC-008: workflow regression',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    await test.step('Scenario 1: First workflow', async () => {
      await startServerWithSchema({
        /* config 1 */
      })
      await page.goto('/')
      await expect(page.getByText('Result 1')).toBeVisible()
    })

    await test.step('Scenario 2: Alternative workflow', async () => {
      await startServerWithSchema({
        /* config 2 */
      })
      await page.goto('/')
      await expect(page.getByText('Result 2')).toBeVisible()
    })
  }
)
```

### Nested Steps

```typescript
await test.step('Complete checkout', async () => {
  await test.step('Fill shipping address', async () => {
    await page.getByLabel('Street').fill('123 Main St')
  })

  await test.step('Select payment method', async () => {
    await page.getByRole('radio', { name: 'Credit Card' }).check()
  })

  await test.step('Confirm order', async () => {
    await page.getByRole('button', { name: 'Place Order' }).click()
  })
})
```

### Return Values

```typescript
const userId = await test.step('Create user', async () => {
  const response = await page.request.post('/api/users', { data: { name: 'Alice' } })
  const data = await response.json()
  return data.id // Return for later use
})

await test.step('Verify user profile', async () => {
  await page.goto(`/users/${userId}`) // Use returned value
})
```

## Step Naming Rules

### ✅ DO

- Use imperative verbs: "Create user", "Verify email"
- Be specific: "Sign up with valid credentials"
- Align with GIVEN-WHEN-THEN in @spec tests
- Keep concise (50 characters max)

### ❌ DON'T

- Use vague names: "Test stuff", "Step 1"
- Use noun forms: "User creation"
- Use gerunds: "Creating user"
- Over-engineer simple assertions

## Migration Priority

1. **New Tests** (immediate) - All new tests must use steps
2. **@regression Tests** (high priority) - Highest ROI, migrate first
3. **Complex @spec Tests** (medium) - Tests with 50+ lines
4. **Fixtures** (ongoing) - Add incrementally when modified
5. **Simple @spec Tests** (optional) - Tests under 20 lines can skip

## Quick Start Checklist

- [ ] Import `test` from fixtures: `import { test, expect } from '@/specs/fixtures'`
- [ ] Wrap GIVEN-WHEN-THEN sections in @spec tests
- [ ] Wrap scenarios in @regression tests
- [ ] Use descriptive imperative names
- [ ] Test locally: `bun test:e2e`
- [ ] Check HTML report: `bun run playwright show-report`
- [ ] Verify trace viewer: `bun run playwright show-trace`

## Examples

### Before (without steps)

```typescript
test('API-AUTH-001: should authenticate user', { tag: '@spec' }, async ({ page }) => {
  // GIVEN
  await startServerWithSchema({ auth: true })

  // WHEN
  await page.goto('/login')
  await page.getByLabel('Email').fill('test@example.com')
  await page.getByRole('button', { name: 'Sign In' }).click()

  // THEN
  await expect(page).toHaveURL('/dashboard')
})
```

### After (with steps)

```typescript
test('API-AUTH-001: should authenticate user', { tag: '@spec' }, async ({ page }) => {
  await test.step('GIVEN: Server with auth enabled', async () => {
    await startServerWithSchema({ auth: true })
  })

  await test.step('WHEN: User submits valid credentials', async () => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('test@example.com')
    await page.getByRole('button', { name: 'Sign In' }).click()
  })

  await test.step('THEN: User is redirected to dashboard', async () => {
    await expect(page).toHaveURL('/dashboard')
  })
})
```

## Advanced Features

### Step with Timeout

```typescript
await test.step(
  'Wait for slow API',
  async () => {
    await page.waitForResponse('**/api/slow')
  },
  { timeout: 60000 }
)
```

### Step with Attachments

```typescript
await test.step('Verify response', async (stepInfo) => {
  const data = await response.json()
  await stepInfo.attach('response', {
    body: JSON.stringify(data, null, 2),
    contentType: 'application/json',
  })
  expect(data).toHaveProperty('status', 'success')
})
```

### Boxed Steps (Better Error Traces)

```typescript
await test.step(
  'Complex operation',
  async () => {
    await someComplexOperation()
  },
  { box: true }
) // Errors point to step call site
```

## Resources

- **Full Guide**: [Part 14: Using test.step for Readability](./14-using-test-steps-for-readability.md)
- **Playwright Docs**: [test.step API](https://playwright.dev/docs/api/class-test)
- **Examples**: `specs/app/version.spec.ts`, `specs/api/auth/sign-up/email/post.spec.ts`

## Need Help?

1. Read the full guide: [Part 14](./14-using-test-steps-for-readability.md)
2. Check existing examples in `specs/` directory
3. Refer to [Playwright Best Practices](./08-playwright-best-practices.md)
