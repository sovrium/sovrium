/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for App Name Property
 *
 * Source: specs/app/name/name.schema.json
 * Property: name (application identifier following npm package naming conventions)
 *
 * Test Organization:
 * 1. @spec tests - Granular specification tests (12 tests from specs array)
 * 2. @regression test - ONE consolidated workflow test
 *
 * These tests specify the desired behavior for the name property.
 * All tests use test() for RED phase (TDD) - they will fail initially.
 * Implementation should focus on making each test pass.
 */

// ============================================================================
// SPECIFICATION TESTS (@spec)
// Granular tests defining acceptance criteria during TDD development
// Run during: Development, pre-commit (bun test:e2e:spec)
// ============================================================================

test(
  'APP-NAME-001: should display app name in h1 heading',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: server with app name 'test-app'
    await startServerWithSchema({ name: 'test-app' }, { useDatabase: false })

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: app name displays in h1 heading
    const heading = page.locator('h1')
    await expect(heading).toHaveText('test-app')
  }
)

test(
  'APP-NAME-002: should show app name in page title with Sovrium branding',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: server with app name 'my-dashboard'
    await startServerWithSchema({ name: 'my-dashboard' }, { useDatabase: false })

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: page title shows 'my-dashboard - Powered by Sovrium'
    await expect(page).toHaveTitle('my-dashboard - Powered by Sovrium')
  }
)

test(
  'APP-NAME-003: should display single-character name in heading',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: server with single-character name 'a'
    await startServerWithSchema({ name: 'a' }, { useDatabase: false })

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: single character displays in heading
    const heading = page.locator('h1')
    await expect(heading).toHaveText('a')
  }
)

test(
  'APP-NAME-004: should display 214-character name without truncation',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: server with 214-character name (maximum length)
    const maxLengthName =
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

    await startServerWithSchema({ name: maxLengthName }, { useDatabase: false })

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: full name displays without truncation
    const heading = page.locator('h1')
    await expect(heading).toHaveText(maxLengthName)
  }
)

test(
  'APP-NAME-005: should have exactly one h1 element on page',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: server with app name 'accessibility-test'
    await startServerWithSchema({ name: 'accessibility-test' }, { useDatabase: false })

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: page has exactly one h1 element
    const headings = page.locator('h1')
    await expect(headings).toHaveCount(1)
  }
)

test(
  'APP-NAME-006: should have h1 as the first heading level on page',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: server with app name 'semantic-html-test'
    await startServerWithSchema({ name: 'semantic-html-test' }, { useDatabase: false })

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: h1 is the first heading level on page
    // Verify h1 appears before any h2, h3, h4, h5, h6
    const firstHeading = page.locator('h1, h2, h3, h4, h5, h6').first()
    const tagName = await firstHeading.evaluate((el) => el.tagName.toLowerCase())
    // THEN: assertion
    expect(tagName).toBe('h1')
  }
)

test(
  'APP-NAME-007: should center h1 heading horizontally',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: server with app name 'layout-test'
    await startServerWithSchema({ name: 'layout-test' }, { useDatabase: false })

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: h1 heading is centered horizontally
    const heading = page.locator('h1')
    const textAlign = await heading.evaluate((el) => window.getComputedStyle(el).textAlign)
    expect(textAlign).toBe('center')
  }
)

test(
  'APP-NAME-008: should ensure h1 heading is visible and not hidden',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: server with app name 'visibility-test'
    await startServerWithSchema({ name: 'visibility-test' }, { useDatabase: false })

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: h1 heading is visible and not hidden
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()

    // Verify not hidden via CSS
    const visibility = await heading.evaluate((el) => window.getComputedStyle(el).visibility)
    // THEN: assertion
    expect(visibility).toBe('visible')

    const display = await heading.evaluate((el) => window.getComputedStyle(el).display)
    // THEN: assertion
    expect(display).not.toBe('none')
  }
)

test(
  'APP-NAME-009: should display text content that exactly matches input',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: server with app name 'my-app-2024'
    await startServerWithSchema({ name: 'my-app-2024' }, { useDatabase: false })

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: text content exactly matches input (no modification, no extra whitespace)
    const heading = page.locator('h1')
    const textContent = heading
    await expect(textContent).toHaveText('my-app-2024')
  }
)

test(
  'APP-NAME-010: should use TypographyH1 component styling with large font size',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: server with app name 'typography-test'
    await startServerWithSchema({ name: 'typography-test' }, { useDatabase: false })

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: h1 uses TypographyH1 component styling (large font size)
    const heading = page.locator('h1')
    const fontSize = await heading.evaluate((el) => window.getComputedStyle(el).fontSize)

    // TypographyH1 uses text-4xl which is 36px (2.25rem)
    // Accept parsed pixel value (accounting for browser defaults)
    const fontSizeValue = parseFloat(fontSize)
    // THEN: assertion
    expect(fontSizeValue).toBeGreaterThanOrEqual(32) // Allow some browser variance
  }
)

test(
  'APP-NAME-011: should display different app names in independent test runs',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: two different test runs with app names 'first-app' and 'second-app'

    // First test run: 'first-app'
    await startServerWithSchema({ name: 'first-app' }, { useDatabase: false })
    // WHEN: user navigates to the page
    await page.goto('/')
    let heading = page.locator('h1')
    // THEN: assertion
    await expect(heading).toHaveText('first-app')

    // Close first server and start second server
    // (fixture automatically handles cleanup between test runs)

    // Second test run: 'second-app'
    // Note: This test simulates independent runs within same test
    // In real scenario, each would be separate test with own fixture
    // For demonstration, we'll verify state isolation
    await startServerWithSchema({ name: 'second-app' }, { useDatabase: false })
    // WHEN: user navigates to the page
    await page.goto('/')
    heading = page.locator('h1')

    // WHEN: user navigates to each homepage
    // THEN: each displays its respective app name
    await expect(heading).toHaveText('second-app')
    await expect(heading).not.toHaveText('first-app')
  }
)

test(
  'APP-NAME-012: should meet all name display requirements with complex name',
  { tag: '@spec' },
  async ({ page, startServerWithSchema }) => {
    // GIVEN: server with complex app name containing special characters allowed by npm
    const complexName = '@myorg-team.test/dashboard_v2.beta-prod'
    await startServerWithSchema({ name: complexName }, { useDatabase: false })

    // WHEN: user navigates to homepage
    await page.goto('/')

    // THEN: all name display requirements are met
    // 1. Display in h1
    const heading = page.locator('h1')
    await expect(heading).toHaveText(complexName)

    // 2. Metadata in page title
    // THEN: assertion
    await expect(page).toHaveTitle(`${complexName} - Powered by Sovrium`)

    // 3. Special characters rendered correctly
    // THEN: assertion
    await expect(heading).toHaveText(complexName)
    const textContent = await heading.textContent()
    // THEN: assertion
    expect(textContent).toContain('@')
    expect(textContent).toContain('/')
    expect(textContent).toContain('_')
    expect(textContent).toContain('-')
    expect(textContent).toContain('.')

    // 4. Accessibility (exactly one h1)
    const headingCount = await page.locator('h1').count()
    // THEN: assertion
    expect(headingCount).toBe(1)

    // 5. Styling (TypographyH1 component)
    const fontSize = await heading.evaluate((el) => window.getComputedStyle(el).fontSize)
    const fontSizeValue = parseFloat(fontSize)
    // THEN: assertion
    expect(fontSizeValue).toBeGreaterThanOrEqual(32)

    // 6. Visibility
    // THEN: assertion
    await expect(heading).toBeVisible()
  }
)

// ============================================================================
// REGRESSION TEST (@regression)
// ONE consolidated test covering complete workflow
// Run during: CI/CD, pre-release (bun test:e2e:regression)
// ============================================================================

test(
  'APP-NAME-013: user can view app name with all display requirements across different configurations',
  { tag: '@regression' },
  async ({ page, startServerWithSchema }) => {
    // OPTIMIZED REGRESSION TEST
    // This test focuses on end-to-end integration rather than duplicating @spec tests.
    // Strategy: Use ONE representative scenario (complex name) to verify all components
    // work together correctly. The 12 @spec tests already cover edge cases exhaustively.
    //
    // Consolidation: 12 server restarts → 1 server restart
    // Execution time: ~30-60s → ~5-10s
    // Coverage: Integration confidence (not exhaustive duplication)

    // GIVEN: Application with complex name (covers most edge cases in one scenario)
    // This name contains: scoped package (@), special chars (. - _ /), typical format
    const complexName = '@myorg-team.test/dashboard_v2.beta-prod'
    await startServerWithSchema({ name: complexName }, { useDatabase: false })

    // WHEN: User navigates to homepage
    await page.goto('/')

    // THEN: All integration points work together correctly

    // 1. Content Display (APP-NAME-001, APP-NAME-009, APP-NAME-012)
    const heading = page.locator('h1')
    // THEN: assertion
    await expect(heading).toHaveText(complexName)
    await expect(heading).toHaveText(complexName) // Exact match, no modification

    // 2. Metadata Integration (APP-NAME-002)
    // THEN: assertion
    await expect(page).toHaveTitle(`${complexName} - Powered by Sovrium`)

    // 3. Special Characters Preserved (APP-NAME-012)
    const textContent = await heading.textContent()
    // THEN: assertion
    expect(textContent).toContain('@')
    expect(textContent).toContain('/')
    expect(textContent).toContain('_')
    expect(textContent).toContain('-')
    expect(textContent).toContain('.')

    // 4. Accessibility Standards (APP-NAME-005, APP-NAME-006)
    const headingCount = await page.locator('h1').count()
    // THEN: assertion
    expect(headingCount).toBe(1) // Exactly one h1
    const firstHeading = page.locator('h1, h2, h3, h4, h5, h6').first()
    const tagName = await firstHeading.evaluate((el) => el.tagName.toLowerCase())
    // THEN: assertion
    expect(tagName).toBe('h1') // h1 is first heading level

    // 5. Visual Styling (APP-NAME-007, APP-NAME-010)
    const textAlign = await heading.evaluate((el) => window.getComputedStyle(el).textAlign)
    // THEN: assertion
    expect(textAlign).toBe('center') // Centered layout
    const fontSize = await heading.evaluate((el) => window.getComputedStyle(el).fontSize)
    const fontSizeValue = parseFloat(fontSize)
    // THEN: assertion
    expect(fontSizeValue).toBeGreaterThanOrEqual(32) // TypographyH1 styling (text-4xl)

    // 6. Visibility (APP-NAME-008)
    // THEN: assertion
    await expect(heading).toBeVisible()
    const visibility = await heading.evaluate((el) => window.getComputedStyle(el).visibility)
    // THEN: assertion
    expect(visibility).toBe('visible')
    const display = await heading.evaluate((el) => window.getComputedStyle(el).display)
    // THEN: assertion
    expect(display).not.toBe('none')

    // Note: Edge cases (min length, max length, independence) are thoroughly
    // covered by @spec tests. This regression test verifies that all components
    // integrate correctly in a real-world scenario.
  }
)
