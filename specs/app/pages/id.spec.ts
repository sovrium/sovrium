/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Page ID
 *
 * Source: specs/app/pages/id/id.schema.json
 * Domain: app
 * Spec Count: 6
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (6 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Validation Approach:
 * - UI rendering validation (Playwright page navigation)
 * - Configuration validation (startServerWithSchema)
 * - ID format validation (UUID, numeric, custom strings)
 */

test.describe('Page ID', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage of all acceptance criteria
  // ============================================================================

  test.fixme(
    'APP-PAGES-ID-001: should validate as unique identifier',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page ID as string
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            id: 'home-page-123',
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page description' },
            sections: [],
          },
        ],
      })

      // WHEN: value is 'home-page-123'
      await page.goto('/')

      // THEN: it should validate as unique identifier
      await expect(page.locator('[data-page-id="home-page-123"]')).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-ID-002: should follow shared ID pattern from common definitions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page ID referencing common definition
      // WHEN: schema uses $ref to definitions.schema.json#/definitions/id
      // THEN: it should follow shared ID pattern from common definitions
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            id: 'page-1',
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            sections: [],
          },
        ],
      })
      // WHEN: user navigates to the page
      await page.goto('/')
      // THEN: assertion
      await expect(page.locator('[data-page-id="page-1"]')).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-ID-003: should allow auto-generated ID (ID is optional)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page without explicit ID
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            sections: [],
          },
        ],
      })

      // WHEN: ID property is omitted
      await page.goto('/')

      // THEN: it should allow auto-generated ID (ID is optional)
      await expect(page.locator('[data-testid="page-home"]')).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-ID-004: should accept UUID as identifier',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page ID with UUID format
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            sections: [],
          },
        ],
      })

      // WHEN: value is '550e8400-e29b-41d4-a716-446655440000'
      await page.goto('/')

      // THEN: it should accept UUID as identifier
      await expect(
        page.locator('[data-page-id="550e8400-e29b-41d4-a716-446655440000"]')
      ).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-ID-005: should accept numeric string identifiers',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page ID with numeric string
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            id: '12345',
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            sections: [],
          },
        ],
      })

      // WHEN: value is '12345'
      await page.goto('/')

      // THEN: it should accept numeric string identifiers
      await expect(page.locator('[data-page-id="12345"]')).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-ID-006: should ensure uniqueness across all pages in array',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: page IDs across multiple pages
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            id: 'page-1',
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            sections: [],
          },
          {
            id: 'page-2',
            name: 'about',
            path: '/about',
            meta: { lang: 'en-US', title: 'About', description: 'About' },
            sections: [],
          },
          {
            id: 'page-3',
            name: 'contact',
            path: '/contact',
            meta: { lang: 'en-US', title: 'Contact', description: 'Contact' },
            sections: [],
          },
        ],
      })

      // WHEN: each page has unique ID
      await page.goto('/')
      // THEN: assertion
      await expect(page.locator('[data-page-id="page-1"]')).toBeVisible()
      // WHEN: user navigates to the page
      await page.goto('/about')
      // THEN: assertion
      await expect(page.locator('[data-page-id="page-2"]')).toBeVisible()
      // WHEN: user navigates to the page
      await page.goto('/contact')
      // THEN: assertion
      await expect(page.locator('[data-page-id="page-3"]')).toBeVisible()

      // THEN: it should ensure uniqueness across all pages in array
    }
  )

  // ============================================================================
  // @regression test - OPTIMIZED integration confidence check
  // ============================================================================

  test.fixme(
    'APP-PAGES-ID-007: user can complete full page ID workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with pages using various ID formats
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            id: 'home-page',
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            sections: [],
          },
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'about',
            path: '/about',
            meta: { lang: 'en-US', title: 'About', description: 'About' },
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

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')
      // THEN: assertion
      await expect(page.locator('[data-page-id="home-page"]')).toBeVisible()

      // WHEN: user navigates to the page
      await page.goto('/about')
      // THEN: assertion
      await expect(
        page.locator('[data-page-id="550e8400-e29b-41d4-a716-446655440000"]')
      ).toBeVisible()

      // WHEN: user navigates to the page
      await page.goto('/contact')
      // THEN: assertion
      await expect(page.locator('[data-testid="page-contact"]')).toBeVisible()

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
