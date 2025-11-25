/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Page Name
 *
 * Source: specs/app/pages/name/name.schema.json
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Page Name', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-NAME-001: should validate as internal page name',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: a page name as string
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [],
          },
        ],
      })

      // WHEN: value is 'home'
      await page.goto('/')

      // THEN: it should validate as internal page name
      await expect(page.locator('[data-testid="page-home"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-NAME-002: should follow shared name pattern from common definitions',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: a page name referencing common definition
      // WHEN: schema uses $ref to definitions.schema.json#/definitions/name
      // THEN: it should follow shared name pattern from common definitions
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'about',
            path: '/about',
            meta: { lang: 'en-US', title: 'About', description: 'About' },
            sections: [],
          },
        ],
      })
      await page.goto('/about')
      await expect(page.locator('[data-testid="page-about"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-NAME-003: should accept simple lowercase names',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: a descriptive page name
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'about',
            path: '/about',
            meta: { lang: 'en-US', title: 'About', description: 'About' },
            sections: [],
          },
        ],
      })

      // WHEN: value is 'about'
      await page.goto('/about')

      // THEN: it should accept simple lowercase names
      await expect(page.locator('[data-testid="page-about"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-NAME-004: should accept single-word page identifiers',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: a multi-word page name
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'pricing',
            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing' },
            sections: [],
          },
          {
            name: 'contact',
            path: '/contact',
            meta: { lang: 'en-US', title: 'Contact', description: 'Contact' },
            sections: [],
          },
        ],
      })

      // WHEN: value is 'pricing' or 'contact'
      await page.goto('/pricing')
      await expect(page.locator('[data-testid="page-pricing"]')).toBeVisible()
      await page.goto('/contact')
      await expect(page.locator('[data-testid="page-contact"]')).toBeVisible()

      // THEN: it should accept single-word page identifiers
    }
  )

  test(
    'APP-PAGES-NAME-005: should accept snake_case names with underscores',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: a page name with underscores (snake_case)
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home_page',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            sections: [],
          },
          {
            name: 'about_us',
            path: '/about',
            meta: { lang: 'en-US', title: 'About', description: 'About' },
            sections: [],
          },
        ],
      })

      // WHEN: value is 'home_page' or 'about_us'
      await page.goto('/')
      await expect(page.locator('[data-testid="page-home-page"]')).toBeVisible()
      await page.goto('/about')
      await expect(page.locator('[data-testid="page-about-us"]')).toBeVisible()

      // THEN: it should accept snake_case names with underscores
    }
  )

  test(
    'APP-PAGES-NAME-006: should provide examples for typical page names',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: common page names (home, about, pricing, contact)
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            sections: [],
          },
          {
            name: 'about',
            path: '/about',
            meta: { lang: 'en-US', title: 'About', description: 'About' },
            sections: [],
          },
          {
            name: 'pricing',
            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing' },
            sections: [],
          },
          {
            name: 'contact',
            path: '/contact',
            meta: { lang: 'en-US', title: 'Contact', description: 'Contact' },
            sections: [],
          },
        ],
      })

      // WHEN: standard website pages are defined
      await page.goto('/')
      await expect(page.locator('[data-testid="page-home"]')).toBeVisible()

      // THEN: it should provide examples for typical page names
    }
  )

  test(
    'APP-PAGES-NAME-007: should fail validation (name is required)',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: page name as required field
      // WHEN: page is created without name
      // THEN: it should fail validation (name is required)
      // Note: This test validates build-time schema validation, not runtime
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              path: '/',
              meta: { lang: 'en-US', title: 'Home', description: 'Home' },
              sections: [],
            },
          ],
        })
      }).rejects.toThrow()
    }
  )

  test(
    'APP-PAGES-NAME-008: should serve as internal identifier separate from URL path',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: page names across multiple pages
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'homepage',
            path: '/',
            meta: { lang: 'en-US', title: 'Welcome', description: 'Welcome' },
            sections: [],
          },
          {
            name: 'company_info',
            path: '/about',
            meta: { lang: 'en-US', title: 'About Us', description: 'About Us' },
            sections: [],
          },
          {
            name: 'plans_and_pricing',
            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing' },
            sections: [],
          },
        ],
      })

      // WHEN: names describe page purpose internally
      await page.goto('/')
      await expect(page.locator('[data-page-name="homepage"]')).toBeVisible()
      await page.goto('/about')
      await expect(page.locator('[data-page-name="company_info"]')).toBeVisible()

      // THEN: it should serve as internal identifier separate from URL path
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-NAME-REGRESSION-001: user can complete full page name workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: Application with various page name formats (snake_case)
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            sections: [],
          },
          {
            name: 'about_us',
            path: '/about',
            meta: { lang: 'en-US', title: 'About', description: 'About' },
            sections: [],
          },
          {
            name: 'pricing',
            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing' },
            sections: [],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')
      await expect(page.locator('[data-testid="page-home"]')).toBeVisible()

      await page.goto('/about')
      await expect(page.locator('[data-testid="page-about-us"]')).toBeVisible()

      await page.goto('/pricing')
      await expect(page.locator('[data-testid="page-pricing"]')).toBeVisible()

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
