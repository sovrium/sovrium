/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Sidebar Configuration
 *
 * Source: specs/app/pages/layout/sidebar/sidebar.schema.json
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Sidebar Configuration', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test.fixme(
    'APP-PAGES-SIDEBAR-001: should display sidebar navigation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with enabled set to true
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: { sidebar: { enabled: true, items: [] } },
            sections: [],
          },
        ],
      })

      // WHEN: sidebar is enabled
      await page.goto('/')

      // THEN: it should display sidebar navigation
      await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-SIDEBAR-002: should render sidebar on left side',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with position 'left'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: { sidebar: { enabled: true, position: 'left' } },
            sections: [],
          },
        ],
      })

      // WHEN: sidebar should be visible
      await page.goto('/')

      // THEN: it should display sidebar navigation
      const sidebar = page.locator('[data-testid="sidebar-left"]')
      await expect(sidebar).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-SIDEBAR-003: should render sidebar on right side',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with position 'right'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: { sidebar: { enabled: true, position: 'right' } },
            sections: [],
          },
        ],
      })

      // WHEN: position is 'left' (default)
      await page.goto('/')

      // THEN: it should render sidebar on left side
      const sidebar = page.locator('[data-testid="sidebar-right"]')
      await expect(sidebar).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-SIDEBAR-004: should apply custom sidebar width',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with custom width
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: { sidebar: { enabled: true, width: '280px', items: [] } },
            sections: [],
          },
        ],
      })

      // WHEN: position is 'right'
      await page.goto('/')

      // THEN: it should render sidebar on right side
      const sidebar = page.locator('[data-testid="sidebar"]')
      await expect(sidebar).toHaveCSS('width', '320px')
    }
  )

  test.fixme(
    'APP-PAGES-SIDEBAR-005: should allow users to collapse/expand sidebar',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a collapsible sidebar
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              sidebar: {
                enabled: true,
                collapsible: true,
                width: '256px',
                items: [{ type: 'link', label: 'Dashboard', href: '/dashboard' }],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: width is '280px'
      await page.goto('/')

      // THEN: it should apply custom sidebar width
      const sidebar = page.locator('[data-testid="sidebar"]')
      const toggleButton = page.locator('[data-testid="sidebar-toggle"]')
      await expect(sidebar).toHaveCSS('width', '256px')
      await toggleButton.click()
      await expect(sidebar).toHaveCSS('width', '64px')
    }
  )

  test.fixme(
    'APP-PAGES-SIDEBAR-006: should start in collapsed state',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar defaulting to collapsed
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              sidebar: {
                enabled: true,
                collapsible: true,
                defaultCollapsed: true,
                width: '256px',
                items: [{ type: 'link', label: 'Dashboard', href: '/dashboard', icon: 'home' }],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: collapsible is true (default)
      await page.goto('/')

      // THEN: it should allow users to collapse/expand sidebar
      const sidebar = page.locator('[data-testid="sidebar"]')
      await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
      await expect(sidebar).toHaveCSS('width', '64px')
    }
  )

  test.fixme(
    'APP-PAGES-SIDEBAR-007: should stick during page scroll',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sticky sidebar
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              sidebar: {
                enabled: true,
                sticky: true,
                position: 'left',
                width: '256px',
                items: [{ type: 'link', label: 'Section 1', href: '#section1' }],
              },
            },
            sections: [{ type: 'div', props: { style: 'height: 3000px' }, children: ['Content'] }],
          },
        ],
      })

      // WHEN: defaultCollapsed is true
      await page.goto('/')

      // THEN: it should start in collapsed state
      const sidebar = page.locator('[data-testid="sidebar"]')
      await expect(sidebar).toHaveCSS('position', 'sticky')
      await page.evaluate(() => window.scrollTo(0, 1000))
      await expect(sidebar).toBeInViewport()
    }
  )

  test.fixme(
    'APP-PAGES-SIDEBAR-008: should render clickable sidebar link',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with link item
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              sidebar: {
                enabled: true,
                items: [
                  { type: 'link', label: 'Dashboard', href: '/dashboard', icon: 'home' },
                  { type: 'link', label: 'Analytics', href: '/analytics', icon: 'chart' },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: sticky is true (default)
      await page.goto('/')

      // THEN: it should stick during page scroll
      const links = page.locator('[data-testid^="sidebar-link"]')
      await expect(links).toHaveCount(2)
      await expect(links.nth(0)).toContainText('Dashboard')
      await expect(links.nth(1)).toContainText('Analytics')
    }
  )

  test.fixme(
    'APP-PAGES-SIDEBAR-009: should render collapsible group with nested items',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with group item
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              sidebar: {
                enabled: true,
                items: [
                  {
                    type: 'group',
                    label: 'Products',
                    icon: 'package',
                    children: [
                      { type: 'link', label: 'All Products', href: '/products' },
                      { type: 'link', label: 'Add Product', href: '/products/new' },
                    ],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: item type is 'link' with label, href, icon
      await page.goto('/')

      // THEN: it should render clickable sidebar link
      const group = page.locator('[data-testid="sidebar-group-0"]')
      await expect(group).toContainText('Products')
      await group.click()
      const children = page.locator('[data-testid="sidebar-group-0-children"]')
      await expect(children).toBeVisible()
      await expect(children.locator('a')).toHaveCount(2)
    }
  )

  test.fixme(
    'APP-PAGES-SIDEBAR-010: should render visual separator between sections',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with divider item
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              sidebar: {
                enabled: true,
                items: [
                  { type: 'link', label: 'Dashboard', href: '/dashboard', icon: 'home' },
                  { type: 'divider' },
                  { type: 'link', label: 'Settings', href: '/settings', icon: 'settings' },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: item type is 'group' with label and children
      await page.goto('/')

      // THEN: it should render collapsible group with nested items
      const divider = page.locator('[data-testid="sidebar-divider"]')
      await expect(divider).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-SIDEBAR-011: should support unlimited nesting for sidebar hierarchy',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with recursive children
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              sidebar: {
                enabled: true,
                items: [
                  {
                    type: 'group',
                    label: 'Docs',
                    children: [
                      {
                        type: 'group',
                        label: 'Getting Started',
                        children: [
                          { type: 'link', label: 'Installation', href: '/docs/installation' },
                          { type: 'link', label: 'Quick Start', href: '/docs/quick-start' },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: item type is 'divider'
      await page.goto('/')

      // THEN: it should render visual separator between sections
      const topGroup = page.locator('[data-testid="sidebar-group-0"]')
      await topGroup.click()
      const nestedGroup = page
        .locator('[data-testid="sidebar-group-0"] button')
        .filter({ hasText: 'Getting Started' })
      await expect(nestedGroup).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-SIDEBAR-012: should enable documentation and admin-style layouts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar for docs/dashboard layouts
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              sidebar: {
                enabled: true,
                sticky: true,
                collapsible: true,
                items: [{ type: 'link', label: 'Dashboard', href: '/dashboard' }],
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: groups can contain nested groups or links
      await page.goto('/')

      // THEN: it should support unlimited nesting for sidebar hierarchy
      const sidebar = page.locator('[data-testid="sidebar"]')
      await expect(sidebar).toBeVisible()
      await expect(sidebar).toHaveCSS('position', 'sticky')
      await expect(page.locator('[data-testid="sidebar-toggle"]')).toBeVisible()
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-LAYOUT-SIDEBAR-REGRESSION-001: user can complete full sidebar workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              sidebar: {
                enabled: true,
                position: 'left',
                sticky: true,
                collapsible: true,
                width: '256px',
                items: [
                  { type: 'link', label: 'Dashboard', href: '/dashboard', icon: 'home' },
                  {
                    type: 'group',
                    label: 'Products',
                    icon: 'package',
                    children: [{ type: 'link', label: 'All Products', href: '/products' }],
                  },
                  { type: 'divider' },
                  { type: 'link', label: 'Settings', href: '/settings', icon: 'settings' },
                ],
              },
            },
            sections: [{ type: 'div', props: { style: 'height: 2000px' }, children: ['Content'] }],
          },
        ],
      })

      await page.goto('/')

      // Verify sidebar visible
      const sidebar = page.locator('[data-testid="sidebar"]')
      await expect(sidebar).toBeVisible()

      // Verify link click
      await page.click('[data-testid="sidebar-link-0"]')

      // Verify group expand
      await page.click('[data-testid="sidebar-group-0"]')
      await expect(page.locator('[data-testid="sidebar-group-0-children"]')).toBeVisible()

      // Verify collapse
      await page.click('[data-testid="sidebar-toggle"]')
      await expect(sidebar).toHaveCSS('width', '64px')

      // Verify sticky on scroll
      await page.evaluate(() => window.scrollTo(0, 500))
      await expect(sidebar).toBeInViewport()
    }
  )
})
