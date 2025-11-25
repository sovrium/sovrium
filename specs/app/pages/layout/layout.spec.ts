/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Page Layout
 *
 * Source: specs/app/pages/layout/layout.schema.json
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Page Layout', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-LAYOUT-001: should orchestrate global page layout',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a layout configuration with all 4 components
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page description' },
            layout: {
              banner: { enabled: true, text: 'Sale - 50% off' },
              navigation: { logo: '/logo.svg', links: { desktop: [{ label: 'Home', href: '/' }] } },
              footer: { enabled: true },
              sidebar: { enabled: true, links: [{ label: 'Docs', href: '/docs' }] },
            },
            sections: [],
          },
        ],
      })

      // WHEN: layout includes banner, navigation, footer, and sidebar
      await page.goto('/')

      // THEN: it should orchestrate global page layout
      await expect(page.locator('[data-testid="banner"]')).toBeVisible()
      await expect(page.locator('[data-testid="navigation"]')).toBeVisible()
      await expect(page.locator('[data-testid="footer"]')).toBeVisible()
      await expect(page.locator('[data-testid="sidebar-left"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-LAYOUT-002: should support minimal layout with navigation only',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a layout with only navigation
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: { logo: '/logo.svg', links: { desktop: [{ label: 'Home', href: '/' }] } },
            },
            sections: [],
          },
        ],
      })

      // WHEN: banner, footer, sidebar are omitted
      await page.goto('/')

      // THEN: it should support minimal layout with navigation only
      await expect(page.locator('[data-testid="navigation"]')).toBeVisible()
      await expect(page.locator('[data-testid="banner"]')).toBeHidden()
      await expect(page.locator('[data-testid="footer"]')).toBeHidden()
      await expect(page.locator('[data-testid="sidebar-left"]')).toBeHidden()
    }
  )

  test(
    'APP-PAGES-LAYOUT-003: should provide header and footer structure',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a layout with navigation and footer
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: {
                logo: '/logo.svg',
                links: {
                  desktop: [
                    { label: 'Home', href: '/' },
                    { label: 'About', href: '/about' },
                  ],
                },
              },
              footer: { enabled: true },
            },
            sections: [],
          },
        ],
      })

      // WHEN: standard website layout is needed
      await page.goto('/')

      // THEN: it should provide header and footer structure
      await expect(page.locator('[data-testid="navigation"]')).toBeVisible()
      await expect(page.locator('[data-testid="footer"]')).toBeVisible()
      const navLinks = page.locator('[data-testid="navigation"] a')
      await expect(navLinks).toHaveCount(3) // logo + 2 links
    }
  )

  test(
    'APP-PAGES-LAYOUT-004: should support sidebar-based layouts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a layout with sidebar for docs/dashboard
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: { logo: '/logo.svg' },
              sidebar: {
                enabled: true,
                position: 'left',
                width: '250px',
                links: [
                  { label: 'Introduction', href: '/docs/intro' },
                  { label: 'Getting Started', href: '/docs/getting-started' },
                  { label: 'API Reference', href: '/docs/api' },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: sidebar navigation is enabled
      await page.goto('/')

      // THEN: it should support sidebar-based layouts
      const sidebar = page.locator('[data-testid="sidebar-left"]')
      await expect(sidebar).toBeVisible()
      await expect(sidebar).toHaveCSS('width', '250px')
      await expect(sidebar).toHaveCSS('position', 'sticky')
      const sidebarLinks = sidebar.locator('a')
      await expect(sidebarLinks).toHaveCount(3)
    }
  )

  test(
    'APP-PAGES-LAYOUT-005: should display top banner above navigation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a layout with banner for announcements
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              banner: {
                enabled: true,
                text: '🎉 Limited time offer - 50% off all plans!',
                backgroundColor: '#FF6B6B',
                textColor: '#FFFFFF',
                link: { href: '/pricing', label: 'View Pricing' },
                dismissible: true,
              },
              navigation: { logo: '/logo.svg' },
            },
            sections: [],
          },
        ],
      })

      // WHEN: banner is enabled with promotional message
      await page.goto('/')

      // THEN: it should display top banner above navigation
      const banner = page.locator('[data-testid="banner"]')
      await expect(banner).toBeVisible()
      await expect(banner).toHaveCSS('background-color', 'rgb(255, 107, 107)')
      await expect(banner).toContainText('🎉 Limited time offer - 50% off all plans!')

      // Verify banner is above navigation
      const bannerBox = await banner.boundingBox()
      const navBox = await page.locator('[data-testid="navigation"]').boundingBox()
      expect(bannerBox!.y).toBeLessThan(navBox!.y)
    }
  )

  test(
    'APP-PAGES-LAYOUT-006: should allow pages without global layout (blank page)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an empty layout configuration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {},
            sections: [{ type: 'div', props: {}, children: ['Content Only'] }],
          },
        ],
      })

      // WHEN: all components are omitted
      await page.goto('/')

      // THEN: it should allow pages without global layout (blank page)
      await expect(page.locator('[data-testid="banner"]')).toBeHidden()
      await expect(page.locator('[data-testid="navigation"]')).toBeHidden()
      await expect(page.locator('[data-testid="footer"]')).toBeHidden()
      await expect(page.locator('[data-testid="sidebar-left"]')).toBeHidden()
      await expect(page.locator('[data-testid="page-test"]')).toContainText('Content Only')
    }
  )

  test(
    'APP-PAGES-LAYOUT-007: should enable cohesive visual design across layout',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: layout components sharing consistent styling
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              banner: {
                enabled: true,
                text: 'New Feature Launch',
                gradient: 'linear-gradient(90deg, #FF6B6B 0%, #4ECDC4 100%)',
              },
              navigation: { logo: '/logo.svg', backgroundColor: '#FF6B6B', textColor: '#FFFFFF' },
              footer: { enabled: true, backgroundColor: '#2C3E50', textColor: '#FFFFFF' },
            },
            sections: [],
          },
        ],
      })

      // WHEN: banner gradient matches navigation theme
      await page.goto('/')

      // THEN: it should enable cohesive visual design across layout
      const banner = page.locator('[data-testid="banner"]')
      await expect(banner).toHaveCSS('background', /linear-gradient/)

      const navigation = page.locator('[data-testid="navigation"]')
      await expect(navigation).toHaveCSS('background-color', 'rgb(255, 107, 107)')

      const footer = page.locator('[data-testid="footer"]')
      await expect(footer).toHaveCSS('background-color', 'rgb(44, 62, 80)')
    }
  )

  test(
    'APP-PAGES-LAYOUT-008: should override or extend default layout per page',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: layout configuration at page level
      await startServerWithSchema({
        name: 'test-app',
        defaultLayout: {
          navigation: { logo: '/logo.svg', links: { desktop: [{ label: 'Home', href: '/' }] } },
          footer: { enabled: true },
        },
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home' },
            layout: null,
            sections: [],
          },
          {
            name: 'About',
            path: '/about',
            meta: { lang: 'en-US', title: 'About' },
            layout: { navigation: { logo: '/logo.svg' } },
            sections: [],
          },
          {
            name: 'Docs',
            path: '/docs',
            meta: { lang: 'en-US', title: 'Docs' },
            layout: { sidebar: { enabled: true } },
            sections: [],
          },
        ],
      })

      // WHEN: each page can define custom layout

      // Home page: no layout
      await page.goto('/')
      await expect(page.locator('[data-testid="navigation"]')).toBeHidden()
      await expect(page.locator('[data-testid="footer"]')).toBeHidden()

      // About page: navigation only
      await page.goto('/about')
      await expect(page.locator('[data-testid="navigation"]')).toBeVisible()
      await expect(page.locator('[data-testid="footer"]')).toBeHidden()

      // Docs page: extends default + sidebar
      await page.goto('/docs')
      await expect(page.locator('[data-testid="sidebar-left"]')).toBeVisible()

      // THEN: it should override or extend default layout per page
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-LAYOUT-REGRESSION-001: user can complete full layout workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with various layout patterns
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home' },
            layout: {
              banner: { enabled: true, text: 'Welcome Sale!', backgroundColor: '#10B981' },
              navigation: {
                logo: '/logo.svg',
                links: {
                  desktop: [
                    { label: 'Home', href: '/' },
                    { label: 'About', href: '/about' },
                  ],
                },
              },
              footer: { enabled: true, copyright: '© 2025 Company' },
            },
            sections: [],
          },
          {
            name: 'About',
            path: '/about',
            meta: { lang: 'en-US', title: 'About' },
            layout: { navigation: { logo: '/logo.svg' } },
            sections: [],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // Verify full layout on home
      await expect(page.locator('[data-testid="banner"]')).toContainText('Welcome Sale!')
      await expect(page.locator('[data-testid="navigation"]')).toBeVisible()
      await expect(page.locator('[data-testid="footer"]')).toContainText('© 2025 Company')

      // Navigate to about (different layout)
      await page.click('a[href="/about"]')
      await expect(page).toHaveURL('/about')
      await expect(page.locator('[data-testid="banner"]')).toBeHidden()
      await expect(page.locator('[data-testid="navigation"]')).toBeVisible()

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
