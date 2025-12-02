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
 * Source: src/domain/models/app/page/layout.ts
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

  test(
    'APP-PAGES-SIDEBAR-001: should display sidebar navigation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with enabled set to true
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: { sidebar: { enabled: true, items: [] } },
            sections: [],
          },
        ],
      })

      // WHEN: sidebar is enabled
      await page.goto('/')

      // THEN: it should display sidebar navigation (defaults to left position)
      await expect(page.locator('[data-testid="sidebar-left"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-SIDEBAR-002: should render sidebar on left side',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with position 'left'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
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

  test(
    'APP-PAGES-SIDEBAR-003: should render sidebar on right side',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with position 'right'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
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

  test(
    'APP-PAGES-SIDEBAR-004: should apply custom sidebar width',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with custom width
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: { sidebar: { enabled: true, width: '280px', items: [] } },
            sections: [],
          },
        ],
      })

      // WHEN: custom width is set
      await page.goto('/')

      // THEN: it should apply custom sidebar width (defaults to left position)
      const sidebar = page.locator('[data-testid="sidebar-left"]')
      await expect(sidebar).toHaveCSS('width', '280px')
    }
  )

  test(
    'APP-PAGES-SIDEBAR-005: should allow users to collapse/expand sidebar',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a collapsible sidebar
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
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

      // WHEN: collapsible is true
      await page.goto('/')

      // THEN: it should allow users to collapse/expand sidebar (defaults to left position)
      const sidebar = page.locator('[data-testid="sidebar-left"]')
      const toggleButton = page.locator('[data-testid="sidebar-toggle"]')
      await expect(sidebar).toHaveCSS('width', '256px')
      await toggleButton.click()
      // THEN: assertion
      await expect(sidebar).toHaveCSS('width', '64px')
    }
  )

  test(
    'APP-PAGES-SIDEBAR-006: should start in collapsed state',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar defaulting to collapsed
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
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

      // WHEN: defaultCollapsed is true
      await page.goto('/')

      // THEN: it should start in collapsed state (defaults to left position)
      const sidebar = page.locator('[data-testid="sidebar-left"]')
      await expect(sidebar).toHaveAttribute('data-collapsed', 'true')
      await expect(sidebar).toHaveCSS('width', '64px')
    }
  )

  test(
    'APP-PAGES-SIDEBAR-007: should stick during page scroll',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sticky sidebar
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
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

      // WHEN: sticky is true
      await page.goto('/')

      // THEN: it should stick during page scroll
      const sidebar = page.locator('[data-testid="sidebar-left"]')
      await expect(sidebar).toHaveCSS('position', 'sticky')
      await page.evaluate(() => window.scrollTo(0, 1000))
      // THEN: assertion
      await expect(sidebar).toBeInViewport()
    }
  )

  test(
    'APP-PAGES-SIDEBAR-008: should render clickable sidebar link',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with link item
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
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

  test(
    'APP-PAGES-SIDEBAR-009: should render collapsible group with nested items',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with group item
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
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
      // THEN: assertion
      await expect(children).toBeVisible()
      await expect(children.locator('a')).toHaveCount(2)
    }
  )

  test(
    'APP-PAGES-SIDEBAR-010: should render visual separator between sections',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with divider item
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
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

  test(
    'APP-PAGES-SIDEBAR-011: should support unlimited nesting for sidebar hierarchy',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar with recursive children
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
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

      // WHEN: groups can contain nested groups
      await page.goto('/')

      // THEN: it should support unlimited nesting for sidebar hierarchy
      const topGroup = page.locator('[data-testid="sidebar-group-0"]')
      await topGroup.click()
      const nestedGroup = page.locator('[data-testid="sidebar-group-1"]')
      // THEN: assertion
      await expect(nestedGroup).toBeVisible()
      await expect(nestedGroup).toContainText('Getting Started')
    }
  )

  test(
    'APP-PAGES-SIDEBAR-012: should enable documentation and admin-style layouts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sidebar for docs/dashboard layouts
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
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

      // WHEN: sidebar has multiple features enabled
      await page.goto('/')

      // THEN: it should enable documentation and admin-style layouts (defaults to left position)
      const sidebar = page.locator('[data-testid="sidebar-left"]')
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
    'APP-PAGES-SIDEBAR-013: user can complete full sidebar workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('Setup: Start server with sidebar', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
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
              sections: [
                { type: 'div', props: { style: 'height: 2000px' }, children: ['Content'] },
              ],
            },
          ],
        })
      })

      await test.step('Navigate to page and verify sidebar visibility', async () => {
        await page.goto('/')
        const sidebar = page.locator('[data-testid="sidebar-left"]')
        await expect(sidebar).toBeVisible()
      })

      await test.step('Verify sidebar link and group interactions', async () => {
        await page.click('[data-testid="sidebar-link-0"]')
        await page.click('[data-testid="sidebar-group-0"]')
        await expect(page.locator('[data-testid="sidebar-group-0-children"]')).toBeVisible()
      })

      await test.step('Verify sidebar collapse behavior', async () => {
        const sidebar = page.locator('[data-testid="sidebar-left"]')
        await page.click('[data-testid="sidebar-toggle"]')
        await expect(sidebar).toHaveCSS('width', '64px')
      })

      await test.step('Verify sidebar sticky on scroll', async () => {
        await page.evaluate(() => window.scrollTo(0, 500))
        const sidebar = page.locator('[data-testid="sidebar-left"]')
        await expect(sidebar).toBeInViewport()
      })
    }
  )
})
