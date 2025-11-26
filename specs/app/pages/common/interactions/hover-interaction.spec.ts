/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Hover Interaction
 *
 * Source: specs/app/pages/common/interactions/hover-interaction.schema.json
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Hover Interaction', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-INTERACTION-HOVER-001: should smoothly scale up by 5%',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with hover transform scale(1.05)
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
                interactions: { hover: { transform: 'scale(1.05)' } },
                children: ['Hover Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user hovers over the component
      await page.goto('/')
      const button = page.locator('button')
      await button.hover()

      // THEN: it should smoothly scale up by 5%
      // Note: Browsers compute scale(1.05) to matrix(1.05, 0, 0, 1.05, 0, 0)
      await expect(button).toHaveCSS('transform', /matrix\(1\.05,.*\)/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-HOVER-002: should fade to 80% opacity',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with hover opacity 0.8
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
                interactions: { hover: { opacity: 0.8 } },
                children: ['Hover Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user hovers over the component
      await page.goto('/')
      const button = page.locator('button')
      await button.hover()

      // THEN: it should fade to 80% opacity
      await expect(button).toHaveCSS('opacity', '0.8')
    }
  )

  test(
    'APP-PAGES-INTERACTION-HOVER-003: should change background and text colors',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with hover backgroundColor and color
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
                interactions: { hover: { backgroundColor: '#007bff', color: '#ffffff' } },
                children: ['Hover Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user hovers over the component
      await page.goto('/')
      const button = page.locator('button')
      await button.hover()

      // THEN: it should change background and text colors
      await expect(button).toHaveCSS('background-color', 'rgb(0, 123, 255)')
      await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)')
    }
  )

  test(
    'APP-PAGES-INTERACTION-HOVER-004: should apply box shadow effect',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with hover shadow
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
                interactions: { hover: { shadow: '0 10px 25px rgba(0,0,0,0.1)' } },
                children: ['Hover Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user hovers over the component
      await page.goto('/')
      const button = page.locator('button')
      await button.hover()

      // THEN: it should apply box shadow effect
      await expect(button).toHaveCSS('box-shadow', /rgba/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-HOVER-005: should transition using specified duration and easing function',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with custom duration and easing
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
                  hover: { transform: 'scale(1.1)', duration: '500ms', easing: 'ease-in-out' },
                },
                children: ['Hover Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user hovers over the component
      await page.goto('/')
      const button = page.locator('button')
      await button.hover()

      // THEN: it should transition using specified duration and easing function
      // Note: Browsers may normalize 500ms to 0.5s
      await expect(button).toHaveCSS('transition-duration', /0\.5s|500ms/)
      await expect(button).toHaveCSS('transition-timing-function', /ease-in-out/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-HOVER-006: all effects should apply simultaneously with coordinated timing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with multiple hover effects (transform, shadow, duration)
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
                  hover: {
                    transform: 'scale(1.05)',
                    shadow: '0 10px 25px rgba(0,0,0,0.15)',
                    duration: '300ms',
                  },
                },
                children: ['Hover Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user hovers over the component
      await page.goto('/')
      const button = page.locator('button')
      await button.hover()

      // THEN: all effects should apply simultaneously with coordinated timing
      // Note: Browsers compute scale(1.05) to matrix(1.05, 0, 0, 1.05, 0, 0)
      await expect(button).toHaveCSS('transform', /matrix\(1\.05,.*\)/)
      await expect(button).toHaveCSS('box-shadow', /rgba/)
      await expect(button).toHaveCSS('transition-duration', /300ms|0\.3s/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-HOVER-007: should change border color smoothly',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with hover borderColor
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
                props: { style: 'border: 2px solid #ccc' },
                interactions: { hover: { borderColor: '#007bff' } },
                children: ['Hover Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user hovers over the component
      await page.goto('/')
      const button = page.locator('button')
      await button.hover()

      // THEN: it should change border color smoothly
      await expect(button).toHaveCSS('border-color', 'rgb(0, 123, 255)')
    }
  )

  test(
    'APP-PAGES-INTERACTION-HOVER-008: should apply effects instantly without transition',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with hover duration set to 0ms
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
                interactions: { hover: { transform: 'scale(1.1)', duration: '0ms' } },
                children: ['Hover Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user hovers over the component
      await page.goto('/')
      const button = page.locator('button')
      await button.hover()

      // THEN: it should apply effects instantly without transition
      await expect(button).toHaveCSS('transition-duration', '0s')
      // Note: Browsers compute scale(1.1) to matrix(1.1, 0, 0, 1.1, 0, 0)
      await expect(button).toHaveCSS('transform', /matrix\(1\.1,.*\)/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-HOVER-009: should display at full opacity',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with hover opacity set to maximum (1.0)
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
                props: { style: 'opacity: 0.5' },
                interactions: { hover: { opacity: 1.0 } },
                children: ['Hover Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user hovers over the component
      await page.goto('/')
      const button = page.locator('button')
      await button.hover()

      // THEN: it should display at full opacity
      await expect(button).toHaveCSS('opacity', '1')
    }
  )

  test(
    'APP-PAGES-INTERACTION-HOVER-010: should become completely transparent',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with hover opacity set to minimum (0.0)
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
                interactions: { hover: { opacity: 0.0 } },
                children: ['Hover Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user hovers over the component
      await page.goto('/')
      const button = page.locator('button')
      await button.hover()

      // THEN: it should become completely transparent
      await expect(button).toHaveCSS('opacity', '0')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-INTERACTION-HOVER-011: user can complete full hover interaction workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with comprehensive hover interactions
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
                  hover: {
                    transform: 'scale(1.05)',
                    shadow: '0 10px 25px rgba(0,0,0,0.15)',
                    duration: '200ms',
                    easing: 'ease-out',
                  },
                },
                children: ['Button 1'],
              },
              {
                type: 'button',
                props: {},
                interactions: {
                  hover: { backgroundColor: '#007bff', color: '#ffffff', duration: '300ms' },
                },
                children: ['Button 2'],
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // Verify transform + shadow hover
      const button1 = page.locator('button').filter({ hasText: 'Button 1' })
      await button1.hover()
      // Note: Browsers convert scale(1.05) to matrix(1.05, 0, 0, 1.05, 0, 0)
      // THEN: assertion
      await expect(button1).toHaveCSS('transform', /matrix\(1\.05, 0, 0, 1\.05, 0, 0\)/)
      await expect(button1).toHaveCSS('box-shadow', /rgba/)

      // Verify color change hover
      const button2 = page.locator('button').filter({ hasText: 'Button 2' })
      await button2.hover()
      // THEN: assertion
      await expect(button2).toHaveCSS('background-color', 'rgb(0, 123, 255)')

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
