/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Responsive Variants
 *
 * Source: specs/app/pages/common/responsive.schema.json
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Responsive Variants', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-RESPONSIVE-001: should apply mobile className and styles',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a heading with mobile-specific props
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'heading',
                responsive: {
                  mobile: {
                    props: {
                      className: 'text-2xl text-center',
                    },
                  },
                },
              },
            ],
          },
        ],
      })

      // WHEN: viewed on mobile device
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')

      // THEN: it should apply mobile className and styles
      const heading = page.locator('h1')
      await expect(heading).toHaveClass(/text-2xl/)
      await expect(heading).toHaveClass(/text-center/)
    }
  )

  test(
    'APP-PAGES-RESPONSIVE-002: content should update to match each breakpoint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a heading with different content per breakpoint (mobile, md, lg)
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'heading',
                content: 'Default Content',
                responsive: {
                  mobile: {
                    content: 'Mobile!',
                  },
                  md: {
                    content: 'Tablet Welcome',
                  },
                  lg: {
                    content: 'Desktop Welcome',
                  },
                },
              },
            ],
          },
        ],
      })

      // WHEN: viewport changes from mobile to tablet to desktop
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')
      await expect(page.locator('h1')).toHaveText('Mobile!', { useInnerText: true })

      await page.setViewportSize({ width: 768, height: 1024 })
      await expect(page.locator('h1')).toHaveText('Tablet Welcome', { useInnerText: true })

      await page.setViewportSize({ width: 1024, height: 768 })

      // THEN: content should update to match each breakpoint
      await expect(page.locator('h1')).toHaveText('Desktop Welcome', { useInnerText: true })
    }
  )

  test(
    'APP-PAGES-RESPONSIVE-003: component should be hidden on mobile and shown on large screens',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with visible false on mobile, visible true on lg
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'text',
                content: 'Desktop Only Content',
                responsive: {
                  mobile: {
                    visible: false,
                  },
                  lg: {
                    visible: true,
                  },
                },
              },
            ],
          },
        ],
      })

      // WHEN: viewport changes from mobile to desktop
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')
      await expect(page.locator('[data-testid="text"]')).toBeHidden()

      await page.setViewportSize({ width: 1024, height: 768 })

      // THEN: component should be shown on large screens
      await expect(page.locator('[data-testid="text"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-RESPONSIVE-004: should render different child components based on breakpoint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with different children at mobile vs desktop
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'container',
                responsive: {
                  mobile: {
                    children: [
                      {
                        type: 'button',
                        content: 'Mobile Button',
                      },
                    ],
                  },
                  lg: {
                    children: [
                      {
                        type: 'button',
                        content: 'Desktop Button 1',
                      },
                      {
                        type: 'button',
                        content: 'Desktop Button 2',
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      })

      // WHEN: viewport changes
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')

      // Count only visible buttons using Playwright's built-in visibility detection
      // CSS-based responsive rendering uses display:none for hidden elements
      const visibleMobileButtons = await page.locator('button').evaluateAll((buttons) =>
        buttons.filter((btn) => {
          const style = window.getComputedStyle(btn)
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
        })
      )
      expect(visibleMobileButtons.length).toBe(1)
      await expect(page.locator('button').first()).toHaveText('Mobile Button')

      await page.setViewportSize({ width: 1024, height: 768 })

      // THEN: it should render different child components
      const visibleDesktopButtons = await page.locator('button').evaluateAll((buttons) =>
        buttons.filter((btn) => {
          const style = window.getComputedStyle(btn)
          return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
        })
      )
      expect(visibleDesktopButtons.length).toBe(2)
      const allDesktopButtons = await page.locator('button').all()
      const visibleDesktopTexts = await Promise.all(
        allDesktopButtons.map(async (btn) => {
          const isVisible = await btn.isVisible()
          if (isVisible) return await btn.textContent()
          return null
        })
      )
      const filteredTexts = visibleDesktopTexts.filter((t) => t !== null)
      expect(filteredTexts[0]).toBe('Desktop Button 1')
      expect(filteredTexts[1]).toBe('Desktop Button 2')
    }
  )

  test(
    'APP-PAGES-RESPONSIVE-005: should apply sm-specific props',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with props overrides at sm breakpoint
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'text',
                content: 'Text content',
                props: {
                  className: 'text-base',
                },
                responsive: {
                  sm: {
                    props: {
                      className: 'text-lg font-semibold',
                    },
                  },
                },
              },
            ],
          },
        ],
      })

      // WHEN: viewport reaches 640px (sm)
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')
      await expect(page.locator('[data-testid="text"]')).toHaveClass(/text-base/)

      await page.setViewportSize({ width: 640, height: 480 })

      // THEN: it should apply sm-specific props
      await expect(page.locator('[data-testid="text"]')).toHaveClass(/text-lg/)
      await expect(page.locator('[data-testid="text"]')).toHaveClass(/font-semibold/)
    }
  )

  test(
    'APP-PAGES-RESPONSIVE-006: should apply md-specific props',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with props overrides at md breakpoint
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'container',
                props: {
                  className: 'p-4',
                },
                responsive: {
                  md: {
                    props: {
                      className: 'p-8 max-w-4xl',
                    },
                  },
                },
              },
            ],
          },
        ],
      })

      // WHEN: viewport reaches 768px (md)
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')
      await expect(page.locator('[data-testid="container"]')).toHaveClass(/p-4/)

      await page.setViewportSize({ width: 768, height: 1024 })

      // THEN: it should apply md-specific props
      await expect(page.locator('[data-testid="container"]')).toHaveClass(/p-8/)
      await expect(page.locator('[data-testid="container"]')).toHaveClass(/max-w-4xl/)
    }
  )

  test(
    'APP-PAGES-RESPONSIVE-007: should apply xl/2xl-specific props for very wide screens',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with props overrides at xl and 2xl breakpoints
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'container',
                props: {
                  className: 'max-w-md',
                },
                responsive: {
                  xl: {
                    props: {
                      className: 'max-w-6xl px-8',
                    },
                  },
                  '2xl': {
                    props: {
                      className: 'max-w-7xl px-12',
                    },
                  },
                },
              },
            ],
          },
        ],
      })

      // WHEN: viewport reaches extra large sizes
      await page.setViewportSize({ width: 1280, height: 800 })
      await page.goto('/')
      await expect(page.locator('[data-testid="container"]')).toHaveClass(/max-w-6xl/)
      await expect(page.locator('[data-testid="container"]')).toHaveClass(/px-8/)

      await page.setViewportSize({ width: 1536, height: 864 })

      // THEN: it should apply 2xl-specific props
      await expect(page.locator('[data-testid="container"]')).toHaveClass(/max-w-7xl/)
      await expect(page.locator('[data-testid="container"]')).toHaveClass(/px-12/)
    }
  )

  test(
    'APP-PAGES-RESPONSIVE-008: each breakpoint should override the previous, creating progressive enhancement',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component with mobile-first progression (mobile → sm → md → lg)
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'heading',
                content: 'Responsive Heading',
                responsive: {
                  mobile: {
                    props: { className: 'text-xl' },
                  },
                  sm: {
                    props: { className: 'text-2xl' },
                  },
                  md: {
                    props: { className: 'text-3xl' },
                  },
                  lg: {
                    props: { className: 'text-4xl' },
                  },
                },
              },
            ],
          },
        ],
      })

      // WHEN: viewport expands from mobile to desktop
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')
      await expect(page.locator('h1')).toHaveClass(/text-xl/)

      await page.setViewportSize({ width: 640, height: 480 })
      await expect(page.locator('h1')).toHaveClass(/text-2xl/)

      await page.setViewportSize({ width: 768, height: 1024 })
      await expect(page.locator('h1')).toHaveClass(/text-3xl/)

      await page.setViewportSize({ width: 1024, height: 768 })

      // THEN: each breakpoint overrides the previous
      await expect(page.locator('h1')).toHaveClass(/text-4xl/)
    }
  )

  test(
    'APP-PAGES-RESPONSIVE-009: all three override types should apply simultaneously at each breakpoint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with props, content, and visible all configured per breakpoint
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'button',
                content: 'Default Button',
                props: {
                  className: 'btn-default',
                },
                responsive: {
                  mobile: {
                    props: { className: 'btn-sm' },
                    content: 'Tap Me',
                    visible: true,
                  },
                  lg: {
                    props: { className: 'btn-lg' },
                    content: 'Click Me',
                    visible: true,
                  },
                },
              },
            ],
          },
        ],
      })

      // WHEN: viewport changes
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')
      const button = page.locator('button')
      await expect(button).toBeVisible()
      await expect(button).toHaveClass(/btn-sm/)
      await expect(button).toHaveText('Tap Me', { useInnerText: true })

      await page.setViewportSize({ width: 1024, height: 768 })

      // THEN: all three override types should apply simultaneously
      await expect(button).toBeVisible()
      await expect(button).toHaveClass(/btn-lg/)
      await expect(button).toHaveText('Click Me', { useInnerText: true })
    }
  )

  test(
    'APP-PAGES-RESPONSIVE-010: mobile should show hamburger menu, desktop should show full navigation links',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a navigation menu with visible true on mobile, different children on desktop
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'navigation',
                responsive: {
                  mobile: {
                    visible: true,
                    children: [
                      {
                        type: 'button',
                        content: '☰',
                        props: { 'aria-label': 'Open menu' },
                      },
                    ],
                  },
                  lg: {
                    visible: true,
                    children: [
                      {
                        type: 'link',
                        content: 'Home',
                        props: { href: '/' },
                      },
                      {
                        type: 'link',
                        content: 'About',
                        props: { href: '/about' },
                      },
                      {
                        type: 'link',
                        content: 'Contact',
                        props: { href: '/contact' },
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      })

      // WHEN: switching between mobile and desktop views
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')
      await expect(page.locator('nav button')).toBeVisible()
      await expect(page.locator('nav button')).toHaveText('☰')

      await page.setViewportSize({ width: 1024, height: 768 })

      // THEN: desktop should show full navigation links
      await expect(page.locator('nav a')).toHaveCount(3)
      await expect(page.locator('nav a').first()).toHaveText('Home')
      await expect(page.locator('nav a').nth(1)).toHaveText('About')
      await expect(page.locator('nav a').last()).toHaveText('Contact')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-RESPONSIVE-REGRESSION-001: user can complete full responsive workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with CSS-based responsive configuration (className, visibility)
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'heading',
                content: 'Welcome',
                responsive: {
                  mobile: {
                    props: { className: 'text-2xl text-center' },
                  },
                  lg: {
                    props: { className: 'text-4xl text-left' },
                  },
                },
              },
              {
                type: 'text',
                content: 'Visible text',
                responsive: {
                  mobile: {
                    visible: true,
                  },
                  lg: {
                    visible: true,
                    props: { className: 'text-lg font-semibold' },
                  },
                },
              },
              {
                type: 'button',
                content: 'Action Button',
                responsive: {
                  mobile: {
                    props: { className: 'w-full' },
                  },
                  lg: {
                    props: { className: 'w-auto px-8' },
                  },
                },
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing CSS-based responsive features
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')

      // Verify mobile - CSS-based responsive classes work
      await expect(page.locator('h1')).toHaveText('Welcome')
      await expect(page.locator('h1')).toHaveClass(/text-2xl/)
      await expect(page.locator('h1')).toHaveClass(/text-center/)
      await expect(page.locator('[data-testid="text"]')).toBeVisible()
      await expect(page.locator('button')).toHaveClass(/w-full/)

      // Verify desktop - Test CSS media query responsiveness
      await page.setViewportSize({ width: 1024, height: 768 })
      await page.goto('/')
      await expect(page.locator('h1')).toHaveText('Welcome')
      await expect(page.locator('h1')).toHaveClass(/text-4xl/)
      await expect(page.locator('h1')).toHaveClass(/text-left/)
      await expect(page.locator('[data-testid="text"]')).toBeVisible()
      await expect(page.locator('[data-testid="text"]')).toHaveClass(/text-lg/)
      await expect(page.locator('[data-testid="text"]')).toHaveClass(/font-semibold/)
      await expect(page.locator('button')).toHaveClass(/w-auto/)
      await expect(page.locator('button')).toHaveClass(/px-8/)

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
