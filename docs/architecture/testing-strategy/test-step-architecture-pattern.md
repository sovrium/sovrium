# Architecture Pattern: test.step Usage in E2E Regression Tests

## Overview

This document defines the architectural pattern for using Playwright's `test.step` feature in E2E tests, specifically focusing on **@regression tests** where test.step provides maximum value for CI/CD visibility and debugging. This pattern is actively used in the Sovrium codebase and is considered a core testing architecture decision.

## Pattern Status

- **Status**: Active and enforced through code review
- **Adoption**: 8 spec files currently use test.step (primarily in @regression tests)
- **Target Adoption**: 100% of @regression tests, 80% of complex @spec tests
- **Documentation**: Comprehensive guides available (Part 14, Quick Guide, Examples)

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

## Pattern Definition

### Core Principle

**Use test.step to wrap logical phases of test execution, creating a hierarchical structure that improves readability, debugging, and reporting.**

### When to Use test.step

#### Mandatory Usage

- **All @regression tests**: Wrap workflow scenarios in descriptive steps
- **Complex @spec tests**: Tests with 50+ lines or multiple phases

#### Optional Usage

- **Simple @spec tests**: Tests under 20 lines may skip steps if they provide no value
- **Fixture implementations**: Add steps incrementally when modifying fixtures
- **Helper functions**: Annotate reusable test utilities when beneficial

### Pattern Structure

#### @regression Tests: Workflow-Based Steps

```typescript
test(
  'SPEC-ID: workflow regression',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    await test.step('Setup: Start server with configuration', async () => {
      await startServerWithSchema({
        /* config */
      })
    })

    await test.step('Verify workflow precondition', async () => {
      const response = await page.request.post('/api/endpoint')
      expect(response.status()).toBe(401) // Not authenticated
    })

    await test.step('Execute main workflow', async () => {
      await page.goto('/path')
      await page.getByRole('button').click()
      expect(await page.getByText('Success')).toBeVisible()
    })

    await test.step('Verify workflow postcondition', async () => {
      const data = await page.request.get('/api/data')
      expect(data.status()).toBe(200)
    })
  }
)
```

**Naming Convention for @regression Tests**:

- Use descriptive action-oriented names: "Setup: Start server", "Verify workflow precondition"
- Focus on WHAT is being tested, not implementation details
- Keep concise (under 50 characters preferred)

#### @spec Tests: GIVEN-WHEN-THEN Structure

```typescript
test('SPEC-ID: should do something', { tag: '@spec' }, async ({ page, startServerWithSchema }) => {
  await test.step('GIVEN: Preconditions are set up', async () => {
    await startServerWithSchema({
      /* config */
    })
  })

  await test.step('WHEN: User performs action', async () => {
    await page.goto('/somewhere')
    await page.getByRole('button').click()
  })

  await test.step('THEN: Expected outcome occurs', async () => {
    await expect(page.getByText('Success')).toBeVisible()
  })
})
```

**Note**: @spec tests already use GIVEN-WHEN-THEN comments in code. Adding test.step is optional but recommended for complex tests to enhance reporting.

### Advanced Patterns

#### Nested Steps (Maximum 3 Levels)

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

**Guideline**: Keep nesting depth under 3 levels to maintain readability.

#### Steps with Return Values

```typescript
const userId = await test.step('Create test user', async () => {
  const response = await page.request.post('/api/users', {
    data: { name: 'Test User' },
  })
  const data = await response.json()
  return data.id // Return value for subsequent steps
})

await test.step('Verify user profile', async () => {
  await page.goto(`/users/${userId}`)
  await expect(page.getByText('Test User')).toBeVisible()
})
```

## Implementation Examples from Codebase

### Example 1: Sign-Up Workflow (@regression)

**File**: `specs/api/auth/sign-up/email/post.spec.ts`

```typescript
test(
  'API-AUTH-SIGN-UP-EMAIL-016: user can complete full sign-up workflow',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    await test.step('Setup: Start server with auth enabled', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
      })
    })

    await test.step('Sign up with valid credentials', async () => {
      const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'Regression User',
          email: 'regression@example.com',
          password: 'SecurePass123!',
        },
      })
      expect(signUpResponse.status()).toBe(200)
    })

    await test.step('Sign in with new credentials', async () => {
      const signInResponse = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'regression@example.com',
          password: 'SecurePass123!',
        },
      })
      expect(signInResponse.status()).toBe(200)
    })
  }
)
```

### Example 2: Change Password Workflow (@regression)

**File**: `specs/api/auth/change-password/post.spec.ts`

```typescript
test(
  'API-AUTH-CHANGE-PASSWORD-009: user can complete full change-password workflow',
  { tag: '@regression' },
  async ({ page, startServerWithSchema, signUp }) => {
    await test.step('Setup: Start server with auth enabled', async () => {
      await startServerWithSchema({
        name: 'test-app',
        auth: { emailAndPassword: true },
      })
    })

    await test.step('Verify change password fails without auth', async () => {
      const noAuthResponse = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'Current123!',
          newPassword: 'NewPass123!',
        },
      })
      expect(noAuthResponse.status()).toBe(401)
    })

    await test.step('Setup: Create and authenticate user', async () => {
      await signUp({
        email: 'workflow@example.com',
        password: 'WorkflowPass123!',
        name: 'Workflow User',
      })
    })

    await test.step('Verify change fails with wrong current password', async () => {
      const wrongPassResponse = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'WrongPassword!',
          newPassword: 'NewWorkflow123!',
        },
      })
      expect(wrongPassResponse.status()).toBe(400)
    })

    await test.step('Change password with correct credentials', async () => {
      const successResponse = await page.request.post('/api/auth/change-password', {
        data: {
          currentPassword: 'WorkflowPass123!',
          newPassword: 'NewWorkflow123!',
        },
      })
      expect(successResponse.status()).toBe(200)
    })

    await test.step('Verify new password works after sign-in', async () => {
      await page.request.post('/api/auth/sign-out')
      const newSignIn = await page.request.post('/api/auth/sign-in/email', {
        data: {
          email: 'workflow@example.com',
          password: 'NewWorkflow123!',
        },
      })
      expect(newSignIn.status()).toBe(200)
    })
  }
)
```

### Example 3: Landing Page Template (@regression)

**File**: `specs/templates/landing-page.spec.ts`

This test demonstrates comprehensive step usage with 15 numbered steps covering:

- Page load and navigation rendering
- Block variable substitution
- Feature sections with reusable blocks
- Theme application (colors, fonts)
- Language switching and persistence
- Responsive layout validation
- Complete user journey workflow

**Pattern**: Each step is numbered and descriptive, making the test easy to follow and debug.

## Best Practices

### Step Naming

#### ✅ DO

```typescript
await test.step('Setup: Start server with auth enabled', async () => {
  /* ... */
})
await test.step('Sign up with valid credentials', async () => {
  /* ... */
})
await test.step('Verify new password works after sign-in', async () => {
  /* ... */
})
await test.step('Change password with correct credentials', async () => {
  /* ... */
})
```

#### ❌ DON'T

```typescript
await test.step('Test stuff', async () => {
  /* ... */
}) // Too vague
await test.step('Step 1', async () => {
  /* ... */
}) // Not descriptive
await test.step('Creating a user', async () => {
  /* ... */
}) // Use imperative: "Create user"
await test.step('User creation process', async () => {
  /* ... */
}) // Noun form, use verb
```

### Step Granularity

- **Setup steps**: Group configuration and preconditions
- **Action steps**: Group related user actions
- **Verification steps**: Group related assertions
- **Avoid over-granularization**: Each assertion doesn't need a separate step

### Step Independence

- Steps should be logically sequential but independently understandable
- Use descriptive names that make sense without reading other steps
- Return values from steps when subsequent steps depend on them

## Integration with Testing Strategy

### Relationship with @spec vs @regression

| Test Type       | Step Usage                               | Structure          | Priority |
| --------------- | ---------------------------------------- | ------------------ | -------- |
| **@spec**       | Optional (recommended for complex tests) | GIVEN-WHEN-THEN    | Medium   |
| **@regression** | Mandatory                                | Workflow scenarios | High     |

### Why @regression Tests are Priority

1. **CI/CD Execution**: Regression tests run on every PR merge
2. **Optimized Workflows**: Each regression test validates multiple scenarios
3. **Debugging Value**: Steps show exactly which scenario failed in CI logs
4. **Reporting Impact**: HTML reports display workflow progress clearly

### Migration Strategy

**Phase 1: New Tests (Immediate)**

- All new tests use test.step from day one
- Code reviews verify step usage

**Phase 2: @regression Tests (High Priority)**

- Migrate all existing @regression tests
- Target: 100% coverage

**Phase 3: Complex @spec Tests (Medium Priority)**

- Migrate @spec tests with 50+ lines
- Target: 80% coverage

**Phase 4: Fixtures & Helpers (Ongoing)**

- Add steps incrementally when modifying code
- No dedicated migration needed

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
        // Implementation
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

## References

### Internal Documentation

- [Part 14: Using test.step for Readability](./14-using-test-steps-for-readability.md) - Comprehensive guide with examples and migration strategy
- [Part 3: Testing Approach](./03-testing-approach.md) - GIVEN-WHEN-THEN structure
- [Part 8: Playwright Best Practices](./08-playwright-best-practices.md) - Core Playwright patterns

### Official Playwright Documentation

- [test.step API](https://playwright.dev/docs/api/class-test) - Main API reference
- [TestStep API](https://playwright.dev/docs/api/class-teststep) - Step object reference
- [TestStepInfo API](https://playwright.dev/docs/api/class-teststepinfo) - Step metadata and control

### Community Resources

- [Improve Your Playwright Documentation with Test Steps](https://www.checklyhq.com/blog/improve-your-playwright-documentation-with-steps/)
- [Keep your Playwright tests structured with steps](https://timdeschryver.dev/blog/keep-your-playwright-tests-structured-with-steps)
- [Box Test Steps in Playwright](https://dev.to/playwright/box-test-steps-in-playwright-15d9)

## Appendix: Current Adoption Status

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

---

**Last Updated**: 2025-12-02
**Status**: Active pattern, actively used in auth and template tests
**Next Review**: After Phase 2 completion (100% @regression coverage)
