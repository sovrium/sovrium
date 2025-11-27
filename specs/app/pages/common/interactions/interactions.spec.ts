/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Component Interactions
 *
 * Source: src/domain/models/app/page/common.ts
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Component Interactions', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-INTERACTION-MAIN-001: should support hover effects without other interaction types',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with only hover interactions
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { hover: { transform: 'scale(1.05)', duration: '200ms' } },
                children: ['Hover Me'],
              },
            ],
          },
        ],
      })

      // WHEN: component is configured
      await page.goto('/')

      // THEN: it should support hover effects without other interaction types
      const button = page.locator('button')
      await button.hover()
      // Note: Browsers convert scale(1.05) to matrix(1.05, 0, 0, 1.05, 0, 0)
      // THEN: assertion
      await expect(button).toHaveCSS('transform', /matrix\(1\.05, 0, 0, 1\.05, 0, 0\)/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-MAIN-002: should support click actions without other interaction types',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with only click interactions
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { animation: 'pulse', navigate: '/contact' } },
                children: ['Click Me'],
              },
            ],
          },
        ],
      })

      // WHEN: component is configured
      await page.goto('/')

      // THEN: it should support click actions without other interaction types
      const button = page.locator('button')
      await button.click()
      await expect(page).toHaveURL('/contact')
    }
  )

  test(
    'APP-PAGES-INTERACTION-MAIN-003: should support scroll animations without other interaction types',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with only scroll interactions
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'div',
                props: { style: 'margin-top: 2000px' },
                interactions: { scroll: { animation: 'fadeInUp', threshold: 0.1 } },
                children: ['Scroll to see me'],
              },
            ],
          },
        ],
      })

      // WHEN: component is configured
      await page.goto('/')

      // THEN: it should support scroll animations without other interaction types
      const element = page.locator('div').first()
      await element.scrollIntoViewIfNeeded()
      await expect(element).toHaveClass(/animate-fadeInUp/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-MAIN-004: should support entrance animations without other interaction types',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with only entrance interactions
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'div',
                props: {},
                interactions: { entrance: { animation: 'fadeIn', delay: '100ms' } },
                children: ['Entrance Animation'],
              },
            ],
          },
        ],
      })

      // WHEN: component is configured
      await page.goto('/')

      // THEN: it should support entrance animations without other interaction types
      const element = page.locator('div').first()
      await expect(element).toHaveClass(/animate-fadeIn/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-MAIN-005: should support both hover effects and click actions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with hover and click interactions
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: {
                  hover: { transform: 'scale(1.05)' },
                  click: { animation: 'pulse' },
                },
                children: ['Interactive Button'],
              },
            ],
          },
        ],
      })

      // WHEN: component is configured
      await page.goto('/')

      // THEN: it should support both hover effects and click actions
      const button = page.locator('button')
      await button.hover()
      // Note: Browsers convert scale(1.05) to matrix(1.05, 0, 0, 1.05, 0, 0)
      // THEN: assertion
      await expect(button).toHaveCSS('transform', /matrix\(1\.05, 0, 0, 1\.05, 0, 0\)/)
      await button.click()
      // THEN: assertion
      await expect(button).toHaveClass(/animate-pulse/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-MAIN-006: should play entrance animation on load and scroll animation on viewport entry',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with entrance and scroll interactions
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'div',
                props: { style: 'margin-top: 2000px' },
                interactions: {
                  entrance: { animation: 'fadeIn' },
                  scroll: { animation: 'fadeInUp' },
                },
                children: ['Dual Animation'],
              },
            ],
          },
        ],
      })

      // WHEN: page loads and user scrolls
      await page.goto('/')

      // THEN: it should play entrance animation on load and scroll animation on viewport entry
      const element = page.locator('div').first()
      await expect(element).toHaveClass(/animate-fadeIn/)
      await element.scrollIntoViewIfNeeded()
      // THEN: assertion
      await expect(element).toHaveClass(/animate-fadeInUp/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-MAIN-007: all interactions should work independently and not interfere with each other',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with all four interaction types (hover, click, scroll, entrance)
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: {
                  entrance: { animation: 'fadeIn' },
                  hover: { transform: 'scale(1.05)' },
                  click: { animation: 'pulse' },
                  scroll: { animation: 'fadeInUp' },
                },
                children: ['All Interactions'],
              },
            ],
          },
        ],
      })

      // WHEN: component is fully interactive
      await page.goto('/')

      // THEN: all interactions should work independently and not interfere with each other
      const button = page.locator('button')
      await expect(button).toHaveClass(/animate-fadeIn/)
      await button.hover()
      // Note: Browsers convert scale(1.05) to matrix(1.05, 0, 0, 1.05, 0, 0)
      // THEN: assertion
      await expect(button).toHaveCSS('transform', /matrix\(1\.05, 0, 0, 1\.05, 0, 0\)/)
      await button.click()
      // THEN: assertion
      await expect(button).toHaveClass(/animate-pulse/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-MAIN-008: hover effect should apply immediately and click should navigate after animation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with hover transform and click navigation
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: {
                  hover: { transform: 'scale(1.05)', duration: '200ms' },
                  click: { animation: 'pulse', navigate: '/about' },
                },
                children: ['Navigate'],
              },
            ],
          },
          { name: 'About', path: '/about', meta: { lang: 'en-US', title: 'About' }, sections: [] },
        ],
      })

      // WHEN: user hovers then clicks
      await page.goto('/')
      const button = page.locator('button')
      await button.hover()
      // Note: Browsers convert scale(1.05) to matrix(1.05, 0, 0, 1.05, 0, 0)
      // THEN: assertion
      await expect(button).toHaveCSS('transform', /matrix\(1\.05, 0, 0, 1\.05, 0, 0\)/)
      await button.click()

      // THEN: hover effect should apply immediately and click should navigate after animation
      await expect(page).toHaveURL('/about')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-INTERACTION-MAIN-009: user can complete full interactions workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with comprehensive interaction system
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: {
                  hover: { transform: 'scale(1.05)' },
                  click: { navigate: '/about' },
                },
                children: ['Navigate'],
              },
              {
                type: 'div',
                props: {},
                interactions: { entrance: { animation: 'fadeIn' } },
                children: ['Entrance'],
              },
            ],
          },
          {
            name: 'About',
            path: '/about',
            meta: { lang: 'en-US', title: 'About' },
            sections: [],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // Verify entrance animation
      // THEN: assertion
      await expect(page.locator('div')).toHaveClass(/animate-fadeIn/)

      // Verify hover and click
      const button = page.locator('button')
      await button.hover()
      // Note: Browsers convert scale(1.05) to matrix(1.05, 0, 0, 1.05, 0, 0)
      // THEN: assertion
      await expect(button).toHaveCSS('transform', /matrix\(1\.05, 0, 0, 1\.05, 0, 0\)/)
      await button.click()
      // THEN: assertion
      await expect(page).toHaveURL('/about')

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
