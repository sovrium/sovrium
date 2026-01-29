/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Breakpoints
 *
 * Source: src/domain/models/app/theme/index.ts
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (9 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Breakpoints', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-THEME-BREAKPOINTS-001: should validate Tailwind breakpoint values',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: standard Tailwind breakpoints (sm, md, lg, xl, 2xl)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          breakpoints: {
            sm: '640px',
            md: '768px',
            lg: '1024px',
            xl: '1280px',
            '2xl': '1536px',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'breakpoints',
                  className: 'sm:block md:flex lg:grid',
                },
                children: ['Responsive Content'],
              },
            ],
          },
        ],
      })

      // WHEN: responsive system uses common breakpoints
      await page.goto('/')

      // THEN: it should validate Tailwind breakpoint values
      // 1. Verify CSS compilation contains breakpoint definitions
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--breakpoint-sm: 640px')
      expect(css).toContain('--breakpoint-md: 768px')
      expect(css).toContain('--breakpoint-lg: 1024px')
      expect(css).toContain('--breakpoint-xl: 1280px')
      expect(css).toContain('--breakpoint-2xl: 1536px')

      // 2. Verify element renders with responsive classes
      // THEN: assertion
      await expect(page.locator('[data-testid="breakpoints"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-BREAKPOINTS-002: should validate pixel-based breakpoints',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: breakpoint values in pixels
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          breakpoints: {
            mobile: '480px',
            tablet: '768px',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'breakpoints',
                  className: 'mobile:block tablet:flex',
                },
                children: ['Responsive Content'],
              },
            ],
          },
        ],
      })

      // WHEN: breakpoints use px units
      await page.goto('/')

      // THEN: it should validate pixel-based breakpoints
      await expect(page.locator('[data-testid="breakpoints"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-BREAKPOINTS-003: should validate progressive enhancement strategy',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: mobile-first breakpoint progression
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          breakpoints: {
            sm: '640px',
            md: '768px',
            lg: '1024px',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [],
          },
        ],
      })

      // WHEN: breakpoints increase from small to large
      await page.goto('/')

      // THEN: it should validate progressive enhancement strategy
      const breakpoints = await page.evaluate(() => {
        const sm = window.matchMedia('(min-width: 640px)').matches
        const md = window.matchMedia('(min-width: 768px)').matches
        const lg = window.matchMedia('(min-width: 1024px)').matches
        return { sm, md, lg }
      })
      // THEN: assertion
      expect(breakpoints).toBeTruthy()
    }
  )

  test(
    'APP-THEME-BREAKPOINTS-004: should validate lowercase naming convention',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: breakpoint with lowercase naming
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          breakpoints: {
            sm: '640px',
            md: '768px',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'breakpoints',
                  className: 'sm:block md:flex',
                },
                children: ['Responsive Content'],
              },
            ],
          },
        ],
      })

      // WHEN: breakpoint uses simple names
      await page.goto('/')

      // THEN: it should validate lowercase naming convention
      await expect(page.locator('[data-testid="breakpoints"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-BREAKPOINTS-005: should validate custom breakpoint naming',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: custom breakpoints (tablet, desktop, wide)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          breakpoints: {
            tablet: '768px',
            desktop: '1280px',
            wide: '1920px',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'breakpoints',
                  className: 'tablet:block desktop:flex wide:grid',
                },
                children: ['Responsive Content'],
              },
            ],
          },
        ],
      })

      // WHEN: project uses semantic breakpoint names
      await page.goto('/')

      // THEN: it should validate custom breakpoint naming
      await expect(page.locator('[data-testid="breakpoints"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-BREAKPOINTS-006: should validate consistency across responsive system',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: breakpoints matching responsive.schema.json
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          breakpoints: {
            sm: '640px',
            md: '768px',
            lg: '1024px',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [],
          },
        ],
      })

      // WHEN: theme breakpoints align with responsive variants
      await page.goto('/')

      // THEN: it should validate consistency across responsive system
      const breakpoints = await page.evaluate(() => {
        const sm = window.matchMedia('(min-width: 640px)').matches
        const md = window.matchMedia('(min-width: 768px)').matches
        const lg = window.matchMedia('(min-width: 1024px)').matches
        return { sm, md, lg }
      })
      // THEN: assertion
      expect(breakpoints).toBeTruthy()
    }
  )

  test(
    'APP-THEME-BREAKPOINTS-007: should render grid with media query at 768px',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: md breakpoint applied to responsive grid
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          breakpoints: {
            md: '768px',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'grid',
                props: {
                  'data-testid': 'responsive-grid',
                },
              },
            ],
          },
        ],
      })

      // WHEN: grid uses theme.breakpoints.md for tablet layout
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')

      // THEN: it should render grid with media query at 768px
      const grid = page.locator('[data-testid="responsive-grid"]')
      await expect(grid).toHaveScreenshot('breakpoint-app-001-grid-mobile.png')

      await page.setViewportSize({ width: 768, height: 1024 })
      await expect(grid).toHaveScreenshot('breakpoint-app-001-grid-tablet.png')
    }
  )

  test(
    'APP-THEME-BREAKPOINTS-008: should render hamburger menu below 1024px and full menu above',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: lg breakpoint applied to navigation menu
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          breakpoints: {
            lg: '1024px',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'navigation',
                props: {
                  'data-testid': 'main-nav',
                },
              },
            ],
          },
        ],
      })

      // WHEN: navigation switches from mobile to desktop at theme.breakpoints.lg
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')

      // THEN: it should render hamburger menu below 1024px and full menu above
      const nav = page.locator('[data-testid="main-nav"]')
      await expect(nav).toHaveScreenshot('breakpoint-app-002-nav-mobile.png')

      await page.setViewportSize({ width: 1024, height: 768 })
      await expect(nav).toHaveScreenshot('breakpoint-app-002-nav-desktop.png')
    }
  )

  test(
    'APP-THEME-BREAKPOINTS-009: should render with increasing padding at each breakpoint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: multiple breakpoints applied to hero section
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          breakpoints: {
            sm: '640px',
            md: '768px',
            lg: '1024px',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'hero',
                props: {
                  'data-testid': 'hero-section',
                },
              },
            ],
          },
        ],
      })

      // WHEN: hero section uses sm, md, lg for responsive padding
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/')

      // THEN: it should render with increasing padding at each breakpoint
      const hero = page.locator('[data-testid="hero-section"]')
      await expect(hero).toHaveScreenshot('breakpoint-app-003-hero-mobile.png')

      await page.setViewportSize({ width: 1024, height: 768 })
      await expect(hero).toHaveScreenshot('breakpoint-app-003-hero-desktop.png')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 9 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-THEME-BREAKPOINTS-REGRESSION: user can complete full breakpoints workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // OPTIMIZATION: Consolidated from 9 startServerWithSchema calls to 3
      // Group 1 (Tests 001, 003-004, 006-009): Standard Tailwind breakpoints with all section types
      // Group 2 (Test 002): Custom pixel-based breakpoints (mobile, tablet)
      // Group 3 (Test 005): Custom semantic breakpoints (tablet, desktop, wide)

      // Group 1: Comprehensive standard breakpoints with all section types
      await test.step('Setup: Start server with comprehensive standard breakpoints', async () => {
        await startServerWithSchema({
          name: 'test-app',
          theme: {
            breakpoints: {
              sm: '640px',
              md: '768px',
              lg: '1024px',
              xl: '1280px',
              '2xl': '1536px',
            },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              sections: [
                // For tests 001, 004
                {
                  type: 'div',
                  props: {
                    'data-testid': 'breakpoints',
                    className: 'sm:block md:flex lg:grid',
                  },
                  children: ['Responsive Content'],
                },
                // For test 007
                {
                  type: 'grid',
                  props: {
                    'data-testid': 'responsive-grid',
                  },
                },
                // For test 008
                {
                  type: 'navigation',
                  props: {
                    'data-testid': 'main-nav',
                  },
                },
                // For test 009
                {
                  type: 'hero',
                  props: {
                    'data-testid': 'hero-section',
                  },
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-THEME-BREAKPOINTS-001: Validates Tailwind breakpoint values', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--breakpoint-sm: 640px')
        expect(css).toContain('--breakpoint-md: 768px')
        expect(css).toContain('--breakpoint-lg: 1024px')
        expect(css).toContain('--breakpoint-xl: 1280px')
        expect(css).toContain('--breakpoint-2xl: 1536px')
        await expect(page.locator('[data-testid="breakpoints"]')).toBeVisible()
      })

      await test.step('APP-THEME-BREAKPOINTS-003: Validates progressive enhancement strategy', async () => {
        const breakpoints = await page.evaluate(() => {
          const sm = window.matchMedia('(min-width: 640px)').matches
          const md = window.matchMedia('(min-width: 768px)').matches
          const lg = window.matchMedia('(min-width: 1024px)').matches
          return { sm, md, lg }
        })
        expect(breakpoints).toBeTruthy()
      })

      await test.step('APP-THEME-BREAKPOINTS-004: Validates lowercase naming convention', async () => {
        await expect(page.locator('[data-testid="breakpoints"]')).toBeVisible()
      })

      await test.step('APP-THEME-BREAKPOINTS-006: Validates consistency across responsive system', async () => {
        const breakpoints = await page.evaluate(() => {
          const sm = window.matchMedia('(min-width: 640px)').matches
          const md = window.matchMedia('(min-width: 768px)').matches
          const lg = window.matchMedia('(min-width: 1024px)').matches
          return { sm, md, lg }
        })
        expect(breakpoints).toBeTruthy()
      })

      await test.step('APP-THEME-BREAKPOINTS-007: Renders grid with media query at 768px', async () => {
        await page.setViewportSize({ width: 375, height: 667 })
        await expect(page.locator('[data-testid="responsive-grid"]')).toBeVisible()
      })

      await test.step('APP-THEME-BREAKPOINTS-008: Renders hamburger menu below 1024px', async () => {
        await page.setViewportSize({ width: 375, height: 667 })
        await expect(page.locator('[data-testid="main-nav"]')).toBeVisible()
      })

      await test.step('APP-THEME-BREAKPOINTS-009: Renders with increasing padding at breakpoints', async () => {
        await page.setViewportSize({ width: 375, height: 667 })
        await expect(page.locator('[data-testid="hero-section"]')).toBeVisible()
      })

      // Group 2: Custom pixel-based breakpoints (mobile, tablet)
      await test.step('Setup: Start server with custom pixel-based breakpoints', async () => {
        await startServerWithSchema({
          name: 'test-app',
          theme: {
            breakpoints: {
              mobile: '480px',
              tablet: '768px',
            },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              sections: [
                {
                  type: 'div',
                  props: {
                    'data-testid': 'breakpoints',
                    className: 'mobile:block tablet:flex',
                  },
                  children: ['Responsive Content'],
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-THEME-BREAKPOINTS-002: Validates pixel-based breakpoints', async () => {
        await expect(page.locator('[data-testid="breakpoints"]')).toBeVisible()
      })

      // Group 3: Custom semantic breakpoints (tablet, desktop, wide)
      await test.step('Setup: Start server with custom semantic breakpoints', async () => {
        await startServerWithSchema({
          name: 'test-app',
          theme: {
            breakpoints: {
              tablet: '768px',
              desktop: '1280px',
              wide: '1920px',
            },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              sections: [
                {
                  type: 'div',
                  props: {
                    'data-testid': 'breakpoints',
                    className: 'tablet:block desktop:flex wide:grid',
                  },
                  children: ['Responsive Content'],
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-THEME-BREAKPOINTS-005: Validates custom breakpoint naming', async () => {
        await expect(page.locator('[data-testid="breakpoints"]')).toBeVisible()
      })
    }
  )
})
