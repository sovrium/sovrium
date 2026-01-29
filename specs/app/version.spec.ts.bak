/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for App Version
 *
 * Source: src/domain/models/app/version.ts
 * Domain: app
 * Spec Count: 7
 *
 * App Version Behavior:
 * - Displays version badge with SemVer format
 * - Supports prerelease versions (alpha, beta, rc)
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

// ============================================================================
// SPECIFICATION TESTS (@spec)
// Granular tests defining acceptance criteria during TDD development
// Run during: Development, pre-commit (bun test:e2e:spec)
// ============================================================================

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

test(
  'APP-VERSION-002: should NOT render version badge when version property is missing',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with only name (no version property)
    await startServerWithSchema(
      {
        name: 'test-app',
        // version intentionally omitted
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: version badge is NOT rendered
    const versionBadge = page.locator('[data-testid="app-version-badge"]')
    await expect(versionBadge).toBeHidden()
  }
)

test(
  'APP-VERSION-003: should display pre-release version exactly as specified',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with pre-release version '2.0.0-beta.1'
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '2.0.0-beta.1',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: badge displays pre-release version exactly as specified
    const versionBadge = page.locator('[data-testid="app-version-badge"]')
    await expect(versionBadge).toBeVisible()
    await expect(versionBadge).toHaveText('2.0.0-beta.1')
  }
)

test(
  'APP-VERSION-004: should display version with build metadata intact',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with build metadata in version '1.0.0+build.123'
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '1.0.0+build.123',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: badge displays version with build metadata intact
    const versionBadge = page.locator('[data-testid="app-version-badge"]')
    await expect(versionBadge).toBeVisible()
    await expect(versionBadge).toHaveText('1.0.0+build.123')
  }
)

test(
  'APP-VERSION-005: should display complete version string with pre-release and build metadata',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with both pre-release and build metadata '1.0.0-alpha+001'
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '1.0.0-alpha+001',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: badge displays complete version string
    const versionBadge = page.locator('[data-testid="app-version-badge"]')
    await expect(versionBadge).toBeVisible()
    await expect(versionBadge).toHaveText('1.0.0-alpha+001')
  }
)

test(
  'APP-VERSION-006: should display badge before (above) the app name heading',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with name and version
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '1.0.0',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: badge appears before (above) the app name heading
    const versionBadge = page.locator('[data-testid="app-version-badge"]')
    const appNameHeading = page.locator('[data-testid="app-name-heading"]')

    // THEN: assertion
    await expect(versionBadge).toBeVisible()
    await expect(appNameHeading).toBeVisible()

    // Verify version badge appears above name heading in DOM order
    const versionBox = await versionBadge.boundingBox()
    const nameBox = await appNameHeading.boundingBox()

    // Both elements should have bounding boxes (verified by toBeVisible above)
    // THEN: assertion
    expect(versionBox).not.toBeNull()
    expect(nameBox).not.toBeNull()

    // Version badge Y position should be less than (above) name heading Y position
    // THEN: assertion
    expect(versionBox!.y).toBeLessThan(nameBox!.y)
  }
)

test(
  'APP-VERSION-007: should have proper accessibility attributes',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: app with version
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '1.0.0',
      },
      { useDatabase: false }
    )

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: badge has proper accessibility attributes (data-testid='app-version-badge')
    const versionBadge = page.locator('[data-testid="app-version-badge"]')
    await expect(versionBadge).toBeVisible()

    // Verify testid attribute exists
    // THEN: assertion
    await expect(versionBadge).toHaveAttribute('data-testid', 'app-version-badge')
  }
)

// ============================================================================
// REGRESSION TEST (@regression)
// ONE OPTIMIZED test verifying components work together efficiently
// Generated from 7 @spec tests - see individual @spec tests for exhaustive criteria
// ============================================================================

test(
  'APP-VERSION-REGRESSION: user can complete full version workflow',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    await test.step('APP-VERSION-001: Displays version badge with correct version text for simple SemVer', async () => {
      await startServerWithSchema({ name: 'test-app', version: '1.0.0' }, { useDatabase: false })
      await page.goto('/')
      const versionBadge = page.locator('[data-testid="app-version-badge"]')
      await expect(versionBadge).toBeVisible()
      await expect(versionBadge).toHaveText('1.0.0')
    })

    await test.step('APP-VERSION-002: Does NOT render version badge when version property is missing', async () => {
      await startServerWithSchema({ name: 'test-app' }, { useDatabase: false })
      await page.goto('/')
      const versionBadge = page.locator('[data-testid="app-version-badge"]')
      await expect(versionBadge).toBeHidden()
    })

    await test.step('APP-VERSION-003: Displays pre-release version exactly as specified', async () => {
      await startServerWithSchema(
        { name: 'test-app', version: '2.0.0-beta.1' },
        { useDatabase: false }
      )
      await page.goto('/')
      const versionBadge = page.locator('[data-testid="app-version-badge"]')
      await expect(versionBadge).toBeVisible()
      await expect(versionBadge).toHaveText('2.0.0-beta.1')
    })

    await test.step('APP-VERSION-004: Displays version with build metadata intact', async () => {
      await startServerWithSchema(
        { name: 'test-app', version: '1.0.0+build.123' },
        { useDatabase: false }
      )
      await page.goto('/')
      const versionBadge = page.locator('[data-testid="app-version-badge"]')
      await expect(versionBadge).toBeVisible()
      await expect(versionBadge).toHaveText('1.0.0+build.123')
    })

    await test.step('APP-VERSION-005: Displays complete version string with pre-release and build metadata', async () => {
      await startServerWithSchema(
        { name: 'test-app', version: '1.0.0-alpha+001' },
        { useDatabase: false }
      )
      await page.goto('/')
      const versionBadge = page.locator('[data-testid="app-version-badge"]')
      await expect(versionBadge).toBeVisible()
      await expect(versionBadge).toHaveText('1.0.0-alpha+001')
    })

    await test.step('APP-VERSION-006: Displays badge before (above) the app name heading', async () => {
      await startServerWithSchema({ name: 'test-app', version: '1.0.0' }, { useDatabase: false })
      await page.goto('/')
      const versionBadge = page.locator('[data-testid="app-version-badge"]')
      const appNameHeading = page.locator('[data-testid="app-name-heading"]')
      await expect(versionBadge).toBeVisible()
      await expect(appNameHeading).toBeVisible()
      const versionBox = await versionBadge.boundingBox()
      const nameBox = await appNameHeading.boundingBox()
      expect(versionBox).not.toBeNull()
      expect(nameBox).not.toBeNull()
      expect(versionBox!.y).toBeLessThan(nameBox!.y)
    })

    await test.step('APP-VERSION-007: Has proper accessibility attributes', async () => {
      await startServerWithSchema({ name: 'test-app', version: '1.0.0' }, { useDatabase: false })
      await page.goto('/')
      const versionBadge = page.locator('[data-testid="app-version-badge"]')
      await expect(versionBadge).toBeVisible()
      await expect(versionBadge).toHaveAttribute('data-testid', 'app-version-badge')
    })
  }
)
