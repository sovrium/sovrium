# Example: Migrating Tests to Use test.step

This document shows a real example of migrating existing tests to use `test.step`, based on actual tests from the Sovrium codebase.

## Example 1: Simple @spec Test - Version Badge

### Before (Current Implementation)

```typescript
test(
  'APP-VERSION-001: should display version badge with correct version text for simple SemVer',
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

### After (with test.step)

```typescript
test(
  'APP-VERSION-001: should display version badge with correct version text for simple SemVer',
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

### Benefits

- Clear separation of test phases
- Each phase can be expanded/collapsed in reports
- Failed tests immediately show which phase failed
- Self-documenting test flow

---

## Example 2: Complex @regression Test - Version Badge Scenarios

### Before (Current Implementation)

```typescript
test(
  'APP-VERSION-008: user can view version badge with all SemVer variations',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    // Helper function to test version display
    const testVersionDisplay = async (version: string) => {
      const versionBadge = page.locator('[data-testid="app-version-badge"]')
      await expect(versionBadge).toBeVisible()
      await expect(versionBadge).toHaveText(version)
    }

    // Scenario 1: Simple SemVer + Positioning + Accessibility
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '1.0.0',
      },
      { useDatabase: false }
    )
    await page.goto('/')
    await testVersionDisplay('1.0.0')

    // Test badge positioning
    const versionBadge = page.locator('[data-testid="app-version-badge"]')
    const appNameHeading = page.locator('[data-testid="app-name-heading"]')
    await expect(appNameHeading).toBeVisible()
    const versionBox = await versionBadge.boundingBox()
    const nameBox = await appNameHeading.boundingBox()
    expect(versionBox).not.toBeNull()
    expect(nameBox).not.toBeNull()
    expect(versionBox!.y).toBeLessThan(nameBox!.y)

    // Scenario 2: Missing version
    await startServerWithSchema(
      {
        name: 'test-app',
      },
      { useDatabase: false }
    )
    await page.goto('/')
    await expect(page.locator('[data-testid="app-version-badge"]')).toBeHidden()

    // Scenario 3: Pre-release
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '2.0.0-beta.1',
      },
      { useDatabase: false }
    )
    await page.goto('/')
    await testVersionDisplay('2.0.0-beta.1')
  }
)
```

### After (with test.step)

```typescript
test(
  'APP-VERSION-008: user can view version badge with all SemVer variations',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    await test.step('Scenario 1: Display simple SemVer with positioning', async () => {
      await test.step('Setup: Start server with version 1.0.0', async () => {
        await startServerWithSchema(
          {
            name: 'test-app',
            version: '1.0.0',
          },
          { useDatabase: false }
        )
        await page.goto('/')
      })

      await test.step('Verify: Badge displays version text', async () => {
        const versionBadge = page.locator('[data-testid="app-version-badge"]')
        await expect(versionBadge).toBeVisible()
        await expect(versionBadge).toHaveText('1.0.0')
      })

      await test.step('Verify: Badge positioned above name heading', async () => {
        const versionBadge = page.locator('[data-testid="app-version-badge"]')
        const appNameHeading = page.locator('[data-testid="app-name-heading"]')
        await expect(appNameHeading).toBeVisible()

        const versionBox = await versionBadge.boundingBox()
        const nameBox = await appNameHeading.boundingBox()
        expect(versionBox).not.toBeNull()
        expect(nameBox).not.toBeNull()
        expect(versionBox!.y).toBeLessThan(nameBox!.y)
      })
    })

    await test.step('Scenario 2: Hide badge when version is missing', async () => {
      await test.step('Setup: Start server without version', async () => {
        await startServerWithSchema(
          {
            name: 'test-app',
          },
          { useDatabase: false }
        )
        await page.goto('/')
      })

      await test.step('Verify: Badge is not rendered', async () => {
        await expect(page.locator('[data-testid="app-version-badge"]')).toBeHidden()
      })
    })

    await test.step('Scenario 3: Display pre-release version', async () => {
      await test.step('Setup: Start server with pre-release version', async () => {
        await startServerWithSchema(
          {
            name: 'test-app',
            version: '2.0.0-beta.1',
          },
          { useDatabase: false }
        )
        await page.goto('/')
      })

      await test.step('Verify: Badge displays pre-release version', async () => {
        const versionBadge = page.locator('[data-testid="app-version-badge"]')
        await expect(versionBadge).toBeVisible()
        await expect(versionBadge).toHaveText('2.0.0-beta.1')
      })
    })
  }
)
```

### Benefits

- Each scenario is clearly separated and can be collapsed
- Sub-steps within scenarios show setup vs verification phases
- Test reports show which specific scenario failed
- Easier to understand test flow without reading implementation

---

## Example 3: API Test with Email Verification

### Before (Current Implementation)

```typescript
test(
  'API-AUTH-SIGN-UP-011: should send verification email when requireEmailVerification is true',
  { tag: '@spec' },
  async ({ page, startServerWithSchema, mailpit }) => {
    // GIVEN: A running server with email verification required
    await startServerWithSchema({
      name: 'test-app',
      auth: {
        emailAndPassword: { requireEmailVerification: true },
      },
    })

    const userEmail = mailpit.email('verification-test')

    // WHEN: User signs up with valid credentials
    const response = await page.request.post('/api/auth/sign-up/email', {
      data: {
        name: 'John Doe',
        email: userEmail,
        password: 'SecurePass123!',
      },
    })

    // THEN: Returns 200 OK with user data
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('user')
    expect(data.user.email).toBe(userEmail)
    expect(data.user.emailVerified).toBe(false)

    // THEN: Verification email is sent
    const email = await mailpit.waitForEmail(
      (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
    )
    expect(email).toBeDefined()
    expect(email.Subject).toBeTruthy()
    expect(email.HTML).toContain('verify')

    // THEN: Email contains verification token
    const token = extractTokenFromUrl(email.HTML, 'token')
    expect(token).not.toBeNull()
    expect(token).toBeTruthy()
  }
)
```

### After (with test.step)

```typescript
test(
  'API-AUTH-SIGN-UP-011: should send verification email when requireEmailVerification is true',
  { tag: '@spec' },
  async ({ page, startServerWithSchema, mailpit }) => {
    const userEmail =
      await test.step('GIVEN: Server with email verification required', async () => {
        await startServerWithSchema({
          name: 'test-app',
          auth: {
            emailAndPassword: { requireEmailVerification: true },
          },
        })

        return mailpit.email('verification-test')
      })

    const response = await test.step('WHEN: User signs up with valid credentials', async () => {
      return await page.request.post('/api/auth/sign-up/email', {
        data: {
          name: 'John Doe',
          email: userEmail,
          password: 'SecurePass123!',
        },
      })
    })

    await test.step('THEN: User account is created (unverified)', async () => {
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data.user.email).toBe(userEmail)
      expect(data.user.emailVerified).toBe(false)
    })

    const email = await test.step('THEN: Verification email is sent', async () => {
      const email = await mailpit.waitForEmail(
        (e) => e.To[0]?.Address === userEmail && e.Subject.toLowerCase().includes('verify')
      )
      expect(email).toBeDefined()
      expect(email.Subject).toBeTruthy()
      expect(email.HTML).toContain('verify')
      return email
    })

    await test.step('THEN: Email contains verification token', async () => {
      const token = extractTokenFromUrl(email.HTML, 'token')
      expect(token).not.toBeNull()
      expect(token).toBeTruthy()
    })
  }
)
```

### Benefits

- Multiple THEN assertions are separated into logical steps
- Return values (userEmail, response, email) flow between steps
- Failed tests show exactly which assertion phase failed
- Email verification flow is self-documenting

---

## Example 4: Fixture Implementation with Steps

### Before (Current Implementation)

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

### After (with test.step)

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

### Benefits

- Fixture calls are visible in test reports with step hierarchy
- API requests are explicitly shown in traces
- Failed fixture calls show exactly which internal step failed
- Better debugging when fixtures fail

---

## Example 5: Helper Function with Steps

### Before (Current Implementation)

```typescript
async function createMultiOrgScenario(executeQuery, options) {
  const { table, userOrgId, otherOrgId, userOrgRecords, otherOrgRecords } = options
  const userOrgRecordIds = []
  const otherOrgRecordIds = []

  // Insert user org records
  for (const record of userOrgRecords) {
    const recordWithOrg = { ...record, organization_id: userOrgId }
    const result = await executeQuery(`INSERT INTO "${table}" (...) VALUES (...) RETURNING id`)
    userOrgRecordIds.push(result.rows[0].id)
  }

  // Insert other org records
  for (const record of otherOrgRecords) {
    const recordWithOrg = { ...record, organization_id: otherOrgId }
    const result = await executeQuery(`INSERT INTO "${table}" (...) VALUES (...) RETURNING id`)
    otherOrgRecordIds.push(result.rows[0].id)
  }

  return { userOrgRecordIds, otherOrgRecordIds }
}
```

### After (with test.step)

```typescript
async function createMultiOrgScenario(executeQuery, options) {
  return await test.step('Create multi-org test scenario', async () => {
    const { table, userOrgId, otherOrgId, userOrgRecords, otherOrgRecords } = options

    const userOrgRecordIds =
      await test.step(`Insert ${userOrgRecords.length} records for user org`, async () => {
        const ids = []
        for (const record of userOrgRecords) {
          const recordWithOrg = { ...record, organization_id: userOrgId }
          const result = await executeQuery(
            `INSERT INTO "${table}" (...) VALUES (...) RETURNING id`
          )
          ids.push(result.rows[0].id)
        }
        return ids
      })

    const otherOrgRecordIds =
      await test.step(`Insert ${otherOrgRecords.length} records for other org`, async () => {
        const ids = []
        for (const record of otherOrgRecords) {
          const recordWithOrg = { ...record, organization_id: otherOrgId }
          const result = await executeQuery(
            `INSERT INTO "${table}" (...) VALUES (...) RETURNING id`
          )
          ids.push(result.rows[0].id)
        }
        return ids
      })

    return { userOrgRecordIds, otherOrgRecordIds }
  })
}
```

### Benefits

- Helper function calls are visible in test reports
- Each organization's records are inserted in a separate step
- Failed insertions show which organization's data failed
- Test traces show data setup operations clearly

---

## Migration Workflow

### Step 1: Choose a Test File

```bash
# Start with regression tests (highest ROI)
# Example: specs/app/version.spec.ts
```

### Step 2: Add test.step Wrapper

```typescript
// Before
test('SPEC-001: test', async ({ page }) => {
  // GIVEN
  await setup()

  // WHEN
  await action()

  // THEN
  await assertion()
})

// After
test('SPEC-001: test', async ({ page }) => {
  await test.step('GIVEN: ...', async () => {
    await setup()
  })

  await test.step('WHEN: ...', async () => {
    await action()
  })

  await test.step('THEN: ...', async () => {
    await assertion()
  })
})
```

### Step 3: Test Locally

```bash
bun test:e2e specs/app/version.spec.ts
```

### Step 4: Check Reports

```bash
bun run playwright show-report
```

### Step 5: Commit Changes

```bash
git add specs/app/version.spec.ts
git commit -m "refactor: add test.step to version badge tests"
```

---

## Quality Checklist

After migrating a test file, verify:

- [ ] All major sections wrapped in steps
- [ ] Step names are imperative and descriptive
- [ ] Steps align with GIVEN-WHEN-THEN (@spec) or scenarios (@regression)
- [ ] Nested steps used appropriately (not too deep)
- [ ] Tests pass locally: `bun test:e2e`
- [ ] HTML report shows clear step hierarchy
- [ ] Trace viewer shows steps in timeline
- [ ] Steps improve readability without noise

---

## Resources

- **Full Guide**: [Part 14: Using test.step for Readability](./14-using-test-steps-for-readability.md)
- **Quick Reference**: [QUICK-GUIDE-TEST-STEPS.md](./QUICK-GUIDE-TEST-STEPS.md)
- **Playwright Docs**: [test.step API](https://playwright.dev/docs/api/class-test)
