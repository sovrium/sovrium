/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Scroll Interaction
 *
 * Source: specs/app/pages/common/interactions/scroll-interaction.schema.json
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Scroll Interaction', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-INTERACTION-SCROLL-001: should fade in while moving up',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with scroll animation 'fadeInUp'
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
                interactions: { scroll: { animation: 'fadeInUp' } },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: component enters the viewport
      await page.goto('/')
      const element = page.locator('div').first()
      await element.scrollIntoViewIfNeeded()

      // THEN: it should fade in while moving up
      await expect(element).toHaveClass(/animate-fadeInUp/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-SCROLL-002: should fade in smoothly',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with scroll animation 'fadeIn'
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
                interactions: { scroll: { animation: 'fadeIn' } },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: component enters the viewport
      await page.goto('/')
      const element = page.locator('div').first()
      await element.scrollIntoViewIfNeeded()

      // THEN: it should fade in smoothly
      await expect(element).toHaveClass(/animate-fadeIn/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-SCROLL-003: should zoom in from small to normal size',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with scroll animation 'zoomIn'
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
                interactions: { scroll: { animation: 'zoomIn' } },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: component enters the viewport
      await page.goto('/')
      const element = page.locator('div').first()
      await element.scrollIntoViewIfNeeded()

      // THEN: it should zoom in from small to normal size
      await expect(element).toHaveClass(/animate-zoomIn/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-SCROLL-004: should fade in while sliding from the left',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with scroll animation 'fadeInLeft'
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
                interactions: { scroll: { animation: 'fadeInLeft' } },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: component enters the viewport
      await page.goto('/')
      const element = page.locator('div').first()
      await element.scrollIntoViewIfNeeded()

      // THEN: it should fade in while sliding from the left
      await expect(element).toHaveClass(/animate-fadeInLeft/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-SCROLL-005: should trigger the animation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with threshold 0.1 (10% visible)
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
                props: { style: 'margin-top: 2000px; height: 1000px' },
                interactions: { scroll: { animation: 'fadeIn', threshold: 0.1 } },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: 10% of component becomes visible
      await page.goto('/')
      const element = page.locator('div').first()
      await element.scrollIntoViewIfNeeded()

      // THEN: it should trigger the animation
      await expect(element).toHaveClass(/animate-fadeIn/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-SCROLL-006: should trigger the animation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with threshold 0.5 (50% visible)
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
                props: { style: 'margin-top: 2000px; height: 1000px' },
                interactions: { scroll: { animation: 'fadeIn', threshold: 0.5 } },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: 50% of component becomes visible
      await page.goto('/')
      const element = page.locator('div').first()
      await element.scrollIntoViewIfNeeded({ timeout: 5000 })

      // THEN: it should trigger the animation
      await expect(element).toHaveClass(/animate-fadeIn/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-SCROLL-007: should trigger the animation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with threshold 1.0 (fully visible)
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
                props: { style: 'margin-top: 2000px; height: 300px' },
                interactions: { scroll: { animation: 'fadeIn', threshold: 1.0 } },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: 100% of component becomes visible
      await page.goto('/')
      const element = page.locator('div').first()
      await element.scrollIntoViewIfNeeded({ timeout: 5000 })

      // THEN: it should trigger the animation
      await expect(element).toHaveClass(/animate-fadeIn/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-SCROLL-008: should wait 200ms before starting the animation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with delay '200ms'
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
                interactions: { scroll: { animation: 'fadeIn', delay: '200ms' } },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: component enters the viewport
      await page.goto('/')
      const element = page.locator('div').first()
      await element.scrollIntoViewIfNeeded()

      // THEN: it should wait 200ms before starting the animation
      // Note: Browsers may normalize 200ms to 0.2s, both are equivalent
      await expect(element).toHaveCSS('animation-delay', '0.2s')
    }
  )

  test(
    'APP-PAGES-INTERACTION-SCROLL-009: should complete the animation in 1 second',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with duration '1000ms'
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
                interactions: { scroll: { animation: 'fadeIn', duration: '1000ms' } },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: animation starts
      await page.goto('/')
      const element = page.locator('div').first()
      await element.scrollIntoViewIfNeeded()

      // THEN: it should complete the animation in 1 second
      // Note: Browsers may normalize 1000ms to 1s, both are equivalent
      await expect(element).toHaveCSS('animation-duration', '1s')
    }
  )

  test(
    'APP-PAGES-INTERACTION-SCROLL-010: should animate only on the first entry',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with once set to true
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
                interactions: { scroll: { animation: 'fadeIn', once: true } },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: component enters viewport multiple times
      await page.goto('/')
      const element = page.locator('div').first()

      // First entry
      await element.scrollIntoViewIfNeeded()
      await expect(element).toHaveClass(/animate-fadeIn/)

      // Scroll away and back
      await page.evaluate(() => window.scrollTo(0, 0))
      await element.scrollIntoViewIfNeeded()

      // THEN: it should animate only on the first entry
      await expect(element).toHaveClass(/animate-fadeIn/)
      await expect(element).toHaveAttribute('data-scroll-once', 'true')
    }
  )

  test(
    'APP-PAGES-INTERACTION-SCROLL-011: should animate every time it enters the viewport',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with once set to false
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
                interactions: { scroll: { animation: 'fadeIn', once: false } },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: component enters viewport multiple times
      await page.goto('/')
      const element = page.locator('div').first()

      // First entry
      await element.scrollIntoViewIfNeeded()
      await expect(element).toHaveClass(/animate-fadeIn/)

      // Scroll away and back
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(500)
      await element.scrollIntoViewIfNeeded()

      // THEN: it should animate every time it enters the viewport
      await expect(element).toHaveClass(/animate-fadeIn/)
      await expect(element).not.toHaveAttribute('data-scroll-once')
    }
  )

  test(
    'APP-PAGES-INTERACTION-SCROLL-012: should apply all settings in sequence (wait delay, then animate with duration)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with animation, threshold, delay, and duration all configured
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
                  scroll: {
                    animation: 'fadeInUp',
                    threshold: 0.2,
                    delay: '300ms',
                    duration: '800ms',
                  },
                },
                children: ['Scroll to see'],
              },
            ],
          },
        ],
      })

      // WHEN: component reaches the threshold visibility
      await page.goto('/')
      const element = page.locator('div').first()
      await element.scrollIntoViewIfNeeded()

      // THEN: it should apply all settings in sequence (wait delay, then animate with duration)
      await expect(element).toHaveClass(/animate-fadeInUp/)
      // Note: Browsers may normalize 300ms to 0.3s and 800ms to 0.8s, both are equivalent
      await expect(element).toHaveCSS('animation-delay', '0.3s')
      await expect(element).toHaveCSS('animation-duration', '0.8s')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-INTERACTIONS-SCROLL-INTERACTION-REGRESSION-001: user can complete full scroll interaction workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with comprehensive scroll interactions
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
                props: { style: 'margin-top: 1000px' },
                interactions: { scroll: { animation: 'fadeIn', threshold: 0.1, once: true } },
                children: ['Section 1'],
              },
              {
                type: 'div',
                props: { style: 'margin-top: 1000px' },
                interactions: {
                  scroll: { animation: 'fadeInUp', delay: '200ms', duration: '600ms' },
                },
                children: ['Section 2'],
              },
              {
                type: 'div',
                props: { style: 'margin-top: 1000px' },
                interactions: { scroll: { animation: 'zoomIn', threshold: 0.5 } },
                children: ['Section 3'],
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // Verify first scroll animation
      const section1 = page.locator('div').filter({ hasText: 'Section 1' })
      await section1.scrollIntoViewIfNeeded()
      await expect(section1).toHaveClass(/animate-fadeIn/)

      // Verify delayed scroll animation
      const section2 = page.locator('div').filter({ hasText: 'Section 2' })
      await section2.scrollIntoViewIfNeeded()
      await expect(section2).toHaveClass(/animate-fadeInUp/)
      // Note: Browsers may normalize 200ms to 0.2s, both are equivalent
      await expect(section2).toHaveCSS('animation-delay', '0.2s')

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
