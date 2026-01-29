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
 * Source: src/domain/models/app/page/common.ts
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
      // THEN: assertion
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
      // THEN: assertion
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
  // ONE OPTIMIZED test covering all 12 @spec scenarios
  // OPTIMIZATION: Reduced from 12 to 3 startServerWithSchema calls
  // - Group 1 (001-004, 008-009, 012): Animation types and timing tests - all elements on same page
  // - Group 2 (005-007): Threshold tests - elements need different heights, separate page
  // - Group 3 (010-011): Once behavior tests - need scroll-away behavior, separate for isolation
  // ============================================================================

  test(
    'APP-PAGES-INTERACTION-SCROLL-REGRESSION: user can complete full scroll interaction workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // Group 1: Animation types and timing tests - multiple elements on same page
      await test.step('Setup: Start server with animation types and timing configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [
                // 001: fadeInUp animation (margin-top: 2000px to ensure element is below viewport)
                {
                  type: 'div',
                  props: { 'data-testid': 'anim-fadeInUp', style: 'margin-top: 2000px' },
                  interactions: { scroll: { animation: 'fadeInUp' } },
                  children: ['FadeInUp'],
                },
                // 002: fadeIn animation
                {
                  type: 'div',
                  props: { 'data-testid': 'anim-fadeIn', style: 'margin-top: 500px' },
                  interactions: { scroll: { animation: 'fadeIn' } },
                  children: ['FadeIn'],
                },
                // 003: zoomIn animation
                {
                  type: 'div',
                  props: { 'data-testid': 'anim-zoomIn', style: 'margin-top: 500px' },
                  interactions: { scroll: { animation: 'zoomIn' } },
                  children: ['ZoomIn'],
                },
                // 004: fadeInLeft animation
                {
                  type: 'div',
                  props: { 'data-testid': 'anim-fadeInLeft', style: 'margin-top: 500px' },
                  interactions: { scroll: { animation: 'fadeInLeft' } },
                  children: ['FadeInLeft'],
                },
                // 008: delay 200ms
                {
                  type: 'div',
                  props: { 'data-testid': 'anim-delay', style: 'margin-top: 500px' },
                  interactions: { scroll: { animation: 'fadeIn', delay: '200ms' } },
                  children: ['Delay'],
                },
                // 009: duration 1000ms
                {
                  type: 'div',
                  props: { 'data-testid': 'anim-duration', style: 'margin-top: 500px' },
                  interactions: { scroll: { animation: 'fadeIn', duration: '1000ms' } },
                  children: ['Duration'],
                },
                // 012: all settings combined
                {
                  type: 'div',
                  props: { 'data-testid': 'anim-combined', style: 'margin-top: 500px' },
                  interactions: {
                    scroll: {
                      animation: 'fadeInUp',
                      threshold: 0.2,
                      delay: '300ms',
                      duration: '800ms',
                    },
                  },
                  children: ['Combined'],
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-001: Fade in while moving up', async () => {
        const element = page.locator('[data-testid="anim-fadeInUp"]')
        await element.scrollIntoViewIfNeeded()
        await expect(element).toHaveClass(/animate-fadeInUp/)
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-002: Fade in smoothly', async () => {
        const element = page.locator('[data-testid="anim-fadeIn"]')
        await element.scrollIntoViewIfNeeded()
        await expect(element).toHaveClass(/animate-fadeIn/)
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-003: Zoom in from small', async () => {
        const element = page.locator('[data-testid="anim-zoomIn"]')
        await element.scrollIntoViewIfNeeded()
        await expect(element).toHaveClass(/animate-zoomIn/)
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-004: Fade in from left', async () => {
        const element = page.locator('[data-testid="anim-fadeInLeft"]')
        await element.scrollIntoViewIfNeeded()
        await expect(element).toHaveClass(/animate-fadeInLeft/)
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-008: Wait 200ms before animating', async () => {
        const element = page.locator('[data-testid="anim-delay"]')
        await element.scrollIntoViewIfNeeded()
        await expect(element).toHaveCSS('animation-delay', '0.2s')
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-009: Complete animation in 1 second', async () => {
        const element = page.locator('[data-testid="anim-duration"]')
        await element.scrollIntoViewIfNeeded()
        await expect(element).toHaveCSS('animation-duration', '1s')
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-012: Apply all settings in sequence', async () => {
        const element = page.locator('[data-testid="anim-combined"]')
        await element.scrollIntoViewIfNeeded()
        await expect(element).toHaveClass(/animate-fadeInUp/)
        await expect(element).toHaveCSS('animation-delay', '0.3s')
        await expect(element).toHaveCSS('animation-duration', '0.8s')
      })

      // Group 2: Threshold tests - need specific heights and scroll behavior
      await test.step('Setup: Start server with threshold configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [
                // 005: threshold 0.1 (10% visible)
                {
                  type: 'div',
                  props: {
                    'data-testid': 'thresh-10',
                    style: 'margin-top: 2000px; height: 1000px',
                  },
                  interactions: { scroll: { animation: 'fadeIn', threshold: 0.1 } },
                  children: ['Threshold 10%'],
                },
                // 006: threshold 0.5 (50% visible)
                {
                  type: 'div',
                  props: { 'data-testid': 'thresh-50', style: 'margin-top: 500px; height: 1000px' },
                  interactions: { scroll: { animation: 'fadeIn', threshold: 0.5 } },
                  children: ['Threshold 50%'],
                },
                // 007: threshold 1.0 (100% visible)
                {
                  type: 'div',
                  props: { 'data-testid': 'thresh-100', style: 'margin-top: 500px; height: 300px' },
                  interactions: { scroll: { animation: 'fadeIn', threshold: 1.0 } },
                  children: ['Threshold 100%'],
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-005: Trigger at 10% threshold', async () => {
        const element = page.locator('[data-testid="thresh-10"]')
        await element.scrollIntoViewIfNeeded()
        await expect(element).toHaveClass(/animate-fadeIn/)
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-006: Trigger at 50% threshold', async () => {
        const element = page.locator('[data-testid="thresh-50"]')
        await element.scrollIntoViewIfNeeded({ timeout: 5000 })
        await expect(element).toHaveClass(/animate-fadeIn/)
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-007: Trigger at 100% threshold', async () => {
        const element = page.locator('[data-testid="thresh-100"]')
        await element.scrollIntoViewIfNeeded({ timeout: 5000 })
        await expect(element).toHaveClass(/animate-fadeIn/)
      })

      // Group 3: Once behavior tests - need scroll-away-and-back behavior
      await test.step('Setup: Start server with once behavior configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [
                // 010: once: true
                {
                  type: 'div',
                  props: { 'data-testid': 'once-true', style: 'margin-top: 2000px' },
                  interactions: { scroll: { animation: 'fadeIn', once: true } },
                  children: ['Once True'],
                },
                // 011: once: false
                {
                  type: 'div',
                  props: { 'data-testid': 'once-false', style: 'margin-top: 500px' },
                  interactions: { scroll: { animation: 'fadeIn', once: false } },
                  children: ['Once False'],
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-010: Animate only on first entry', async () => {
        const element = page.locator('[data-testid="once-true"]')
        await element.scrollIntoViewIfNeeded()
        await expect(element).toHaveClass(/animate-fadeIn/)
        await page.evaluate(() => window.scrollTo(0, 0))
        await element.scrollIntoViewIfNeeded()
        await expect(element).toHaveAttribute('data-scroll-once', 'true')
      })

      await test.step('APP-PAGES-INTERACTION-SCROLL-011: Animate every time', async () => {
        const element = page.locator('[data-testid="once-false"]')
        await element.scrollIntoViewIfNeeded()
        await expect(element).toHaveClass(/animate-fadeIn/)
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.waitForTimeout(500)
        await element.scrollIntoViewIfNeeded()
        await expect(element).not.toHaveAttribute('data-scroll-once')
      })
    }
  )
})
