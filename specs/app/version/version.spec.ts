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
 * Source: specs/app/version/version.schema.json
 * Specs: APP-VERSION-001 through APP-VERSION-007
 *
 * Test Organization:
 * 1. @spec tests - Granular specification tests (7 tests, one per spec)
 * 2. @regression test - ONE consolidated workflow test
 */

// ============================================================================
// SPECIFICATION TESTS (@spec)
// Granular tests defining acceptance criteria during TDD development
// Run during: Development, pre-commit (bun test:e2e:spec)
// ============================================================================

test(
  'APP-VERSION-001: should display version badge with correct version text for simple SemVer',
  { tag: '@spec' },
  async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
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
  async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
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
  async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
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
  async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
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
  async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
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
  async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
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

    await expect(versionBadge).toBeVisible()
    await expect(appNameHeading).toBeVisible()

    // Verify version badge appears above name heading in DOM order
    const versionBox = await versionBadge.boundingBox()
    const nameBox = await appNameHeading.boundingBox()

    // Both elements should have bounding boxes (verified by toBeVisible above)
    expect(versionBox).not.toBeNull()
    expect(nameBox).not.toBeNull()

    // Version badge Y position should be less than (above) name heading Y position
    expect(versionBox!.y).toBeLessThan(nameBox!.y)
  }
)

test(
  'APP-VERSION-007: should have proper accessibility attributes',
  { tag: '@spec' },
  async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
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
    await expect(versionBadge).toHaveAttribute('data-testid', 'app-version-badge')
  }
)

// ============================================================================
// REGRESSION TEST (@regression)
// ONE consolidated test covering complete workflow
// Run during: CI/CD, pre-release (bun test:e2e:regression)
// ============================================================================

test(
  'APP-VERSION-REGRESSION-001: user can view version badge with all SemVer variations',
  { tag: '@regression' },
  async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
    // This test consolidates all 7 @spec tests into one efficient workflow
    // Covers: APP-VERSION-001 through APP-VERSION-007

    // Helper function to test version display (reusable for scenarios 1, 3, 4, 5)
    const testVersionDisplay = async (version: string) => {
      const versionBadge = page.locator('[data-testid="app-version-badge"]')
      await expect(versionBadge).toBeVisible()
      await expect(versionBadge).toHaveText(version)
    }

    // ========================================================================
    // Scenario 1: Simple SemVer + Positioning + Accessibility
    // (APP-VERSION-001, APP-VERSION-006, APP-VERSION-007 - combined in one load)
    // ========================================================================
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '1.0.0',
      },
      { useDatabase: false }
    )
    await page.goto('/')

    // Test version display (APP-VERSION-001)
    await testVersionDisplay('1.0.0')

    // Test badge positioning above name (APP-VERSION-006)
    const versionBadge = page.locator('[data-testid="app-version-badge"]')
    const appNameHeading = page.locator('[data-testid="app-name-heading"]')
    await expect(appNameHeading).toBeVisible()

    const versionBox = await versionBadge.boundingBox()
    const nameBox = await appNameHeading.boundingBox()
    // Both elements should have bounding boxes (verified by toBeVisible above)
    expect(versionBox).not.toBeNull()
    expect(nameBox).not.toBeNull()
    // Version badge should be positioned above name heading
    expect(versionBox!.y).toBeLessThan(nameBox!.y)

    // Test accessibility attributes (APP-VERSION-007)
    await expect(versionBadge).toHaveAttribute('data-testid', 'app-version-badge')

    // ========================================================================
    // Scenario 2: Missing version property (APP-VERSION-002)
    // ========================================================================
    await startServerWithSchema(
      {
        name: 'test-app',
        // version intentionally omitted
      },
      { useDatabase: false }
    )
    await page.goto('/')

    await expect(page.locator('[data-testid="app-version-badge"]')).toBeHidden()

    // ========================================================================
    // Scenario 3: Pre-release version (APP-VERSION-003)
    // ========================================================================
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '2.0.0-beta.1',
      },
      { useDatabase: false }
    )
    await page.goto('/')

    await testVersionDisplay('2.0.0-beta.1')

    // ========================================================================
    // Scenario 4: Build metadata (APP-VERSION-004)
    // ========================================================================
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '1.0.0+build.123',
      },
      { useDatabase: false }
    )
    await page.goto('/')

    await testVersionDisplay('1.0.0+build.123')

    // ========================================================================
    // Scenario 5: Pre-release + build metadata (APP-VERSION-005)
    // ========================================================================
    await startServerWithSchema(
      {
        name: 'test-app',
        version: '1.0.0-alpha+001',
      },
      { useDatabase: false }
    )
    await page.goto('/')

    await testVersionDisplay('1.0.0-alpha+001')
  }
)
