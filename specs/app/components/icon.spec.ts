/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Lucide Icon Component
 *
 * Source: src/domain/models/app/component/component.ts (icon component type)
 * Spec Count: 18
 *
 * Test Organization:
 * 1. @spec tests - Basic icon rendering (3 tests: APP-ICON-001 to APP-ICON-003)
 * 2. @spec tests - Icon sizing (2 tests: APP-ICON-004 to APP-ICON-005)
 * 3. @spec tests - Icon coloring (3 tests: APP-ICON-006 to APP-ICON-008)
 * 4. @spec tests - Icon stroke width (2 tests: APP-ICON-009 to APP-ICON-010)
 * 5. @spec tests - Icon accessibility (2 tests: APP-ICON-011 to APP-ICON-012)
 * 6. @spec tests - Icon in composition (2 tests: APP-ICON-013 to APP-ICON-014)
 * 7. @spec tests - Icon with templates (2 tests: APP-ICON-015 to APP-ICON-016)
 * 8. @spec tests - Graceful fallback (2 tests: APP-ICON-017 to APP-ICON-018)
 * 9. @regression test - ONE optimized integration test
 */

test.describe('Lucide Icon Component', () => {
  // ============================================================================
  // BASIC ICON RENDERING (@spec)
  // ============================================================================

  test(
    'APP-ICON-001: should render icon as inline SVG with correct Lucide path data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component with icon type and a known Lucide icon name
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'status-icon',
            type: 'icon',
            props: { name: 'check-circle' },
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'status-icon' }],
          },
        ],
      })

      // WHEN: the page renders the icon component
      await page.goto('/')

      // THEN: an inline SVG element is rendered with Lucide path data
      const svg = page.locator('[data-testid="icon-check-circle"]')
      await expect(svg).toBeVisible()
      await expect(svg).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg')
      const pathElements = svg.locator('path, circle, line, polyline, rect')
      await expect(pathElements.first()).toBeAttached()
    }
  )

  test(
    'APP-ICON-002: should map icon name to the correct Lucide icon',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: components with different Lucide icon names
      await startServerWithSchema({
        name: 'test-app',
        components: [
          { name: 'icon-star', type: 'icon', props: { name: 'star' } },
          { name: 'icon-heart', type: 'icon', props: { name: 'heart' } },
          { name: 'icon-home', type: 'icon', props: { name: 'home' } },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              { component: 'icon-star' },
              { component: 'icon-heart' },
              { component: 'icon-home' },
            ],
          },
        ],
      })

      // WHEN: multiple icon components render with different names
      await page.goto('/')

      // THEN: each icon renders with its own distinct SVG path data
      const starSvg = page.locator('[data-testid="icon-star"]')
      const heartSvg = page.locator('[data-testid="icon-heart"]')
      const homeSvg = page.locator('[data-testid="icon-home"]')
      await expect(starSvg).toBeVisible()
      await expect(heartSvg).toBeVisible()
      await expect(homeSvg).toBeVisible()
      // Different icons should have different path data
      const starHtml = await starSvg.innerHTML()
      const heartHtml = await heartSvg.innerHTML()
      expect(starHtml).not.toBe(heartHtml)
    }
  )

  test(
    'APP-ICON-003: should have data-testid="icon-{name}" for test selection',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon component with a specific name
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'nav-icon', type: 'icon', props: { name: 'arrow-right' } }],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'nav-icon' }],
          },
        ],
      })

      // WHEN: the icon renders
      await page.goto('/')

      // THEN: the SVG element has data-testid matching the icon name
      await expect(page.locator('[data-testid="icon-arrow-right"]')).toBeVisible()
    }
  )

  // ============================================================================
  // ICON SIZING (@spec)
  // ============================================================================

  test(
    'APP-ICON-004: should respect size prop for width and height',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon components with different size props
      await startServerWithSchema({
        name: 'test-app',
        components: [
          { name: 'large-icon', type: 'icon', props: { name: 'star', size: 32 } },
          { name: 'small-icon', type: 'icon', props: { name: 'star', size: 16 } },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'large-icon' }, { component: 'small-icon' }],
          },
        ],
      })

      // WHEN: icons render with explicit size props
      await page.goto('/')

      // THEN: SVG width and height match the size prop
      const largeSvg = page.locator('[data-testid="icon-star"]').first()
      await expect(largeSvg).toHaveAttribute('width', '32')
      await expect(largeSvg).toHaveAttribute('height', '32')
      const smallSvg = page.locator('[data-testid="icon-star"]').last()
      await expect(smallSvg).toHaveAttribute('width', '16')
      await expect(smallSvg).toHaveAttribute('height', '16')
    }
  )

  test(
    'APP-ICON-005: should default to 24px when size prop is omitted',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon component without explicit size prop
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'default-icon', type: 'icon', props: { name: 'settings' } }],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'default-icon' }],
          },
        ],
      })

      // WHEN: the icon renders without a size prop
      await page.goto('/')

      // THEN: SVG defaults to 24px width and height
      const svg = page.locator('[data-testid="icon-settings"]')
      await expect(svg).toHaveAttribute('width', '24')
      await expect(svg).toHaveAttribute('height', '24')
    }
  )

  // ============================================================================
  // ICON COLORING (@spec)
  // ============================================================================

  test(
    'APP-ICON-006: should set SVG stroke color from color prop',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon with explicit color prop
      await startServerWithSchema({
        name: 'test-app',
        components: [
          { name: 'red-heart', type: 'icon', props: { name: 'heart', color: '#e11d48' } },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'red-heart' }],
          },
        ],
      })

      // WHEN: the icon renders with a color prop
      await page.goto('/')

      // THEN: the SVG stroke attribute is set to the specified color
      const svg = page.locator('[data-testid="icon-heart"]')
      await expect(svg).toBeVisible()
      await expect(svg).toHaveAttribute('stroke', '#e11d48')
    }
  )

  test(
    'APP-ICON-007: should inherit currentColor when no color prop is specified',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon inside a parent with a specific text color and no color prop on icon
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'colored-wrapper',
            type: 'div',
            props: { style: { color: 'rgb(59, 130, 246)' } },
            children: [{ type: 'icon', props: { name: 'info' } }],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'colored-wrapper' }],
          },
        ],
      })

      // WHEN: the icon renders without an explicit color prop
      await page.goto('/')

      // THEN: the SVG uses currentColor for its stroke (inheriting from parent)
      const svg = page.locator('[data-testid="icon-info"]')
      await expect(svg).toBeVisible()
      await expect(svg).toHaveAttribute('stroke', 'currentColor')
    }
  )

  test(
    'APP-ICON-008: should apply Tailwind color classes via className prop',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon with Tailwind color class in className prop
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'themed-icon',
            type: 'icon',
            props: { name: 'settings', className: 'text-primary' },
          },
        ],
        theme: {
          colors: { primary: '#3b82f6' },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'themed-icon' }],
          },
        ],
      })

      // WHEN: the icon renders with a Tailwind color class
      await page.goto('/')

      // THEN: the SVG element has the Tailwind class applied
      const svg = page.locator('[data-testid="icon-settings"]')
      await expect(svg).toBeVisible()
      await expect(svg).toHaveClass(/text-primary/)
    }
  )

  // ============================================================================
  // ICON STROKE WIDTH (@spec)
  // ============================================================================

  test(
    'APP-ICON-009: should control SVG stroke-width from strokeWidth prop',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon components with different strokeWidth props
      await startServerWithSchema({
        name: 'test-app',
        components: [
          { name: 'thin-arrow', type: 'icon', props: { name: 'arrow-right', strokeWidth: 1 } },
          { name: 'bold-arrow', type: 'icon', props: { name: 'arrow-right', strokeWidth: 3 } },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'thin-arrow' }, { component: 'bold-arrow' }],
          },
        ],
      })

      // WHEN: icons render with different strokeWidth props
      await page.goto('/')

      // THEN: each SVG has the corresponding stroke-width attribute
      const thinSvg = page.locator('[data-testid="icon-arrow-right"]').first()
      await expect(thinSvg).toHaveAttribute('stroke-width', '1')
      const boldSvg = page.locator('[data-testid="icon-arrow-right"]').last()
      await expect(boldSvg).toHaveAttribute('stroke-width', '3')
    }
  )

  test(
    'APP-ICON-010: should default stroke width to 2 when omitted',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon component without explicit strokeWidth prop
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'default-stroke', type: 'icon', props: { name: 'circle' } }],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'default-stroke' }],
          },
        ],
      })

      // WHEN: the icon renders without a strokeWidth prop
      await page.goto('/')

      // THEN: SVG stroke-width defaults to 2
      const svg = page.locator('[data-testid="icon-circle"]')
      await expect(svg).toHaveAttribute('stroke-width', '2')
    }
  )

  // ============================================================================
  // ICON ACCESSIBILITY (@spec)
  // ============================================================================

  test(
    'APP-ICON-011: should set aria-hidden="true" when no ariaLabel is provided',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: decorative icon without ariaLabel (default behavior)
      await startServerWithSchema({
        name: 'test-app',
        components: [
          { name: 'decorative-chevron', type: 'icon', props: { name: 'chevron-right' } },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'decorative-chevron' }],
          },
        ],
      })

      // WHEN: the icon renders without an ariaLabel prop
      await page.goto('/')

      // THEN: the SVG has aria-hidden="true" to hide it from screen readers
      const svg = page.locator('[data-testid="icon-chevron-right"]')
      await expect(svg).toBeVisible()
      await expect(svg).toHaveAttribute('aria-hidden', 'true')
    }
  )

  test(
    'APP-ICON-012: should set role="img" and aria-label when ariaLabel is provided',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: informative icon with ariaLabel prop
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'status-ok',
            type: 'icon',
            props: { name: 'check-circle', ariaLabel: 'Status OK' },
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'status-ok' }],
          },
        ],
      })

      // WHEN: the icon renders with an ariaLabel prop
      await page.goto('/')

      // THEN: the SVG has role="img" and the matching aria-label
      const svg = page.locator('[data-testid="icon-check-circle"]')
      await expect(svg).toBeVisible()
      await expect(svg).toHaveAttribute('role', 'img')
      await expect(svg).toHaveAttribute('aria-label', 'Status OK')
    }
  )

  // ============================================================================
  // ICON IN COMPONENT COMPOSITION (@spec)
  // ============================================================================

  test(
    'APP-ICON-013: should render icon correctly as child of button component',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: button component with icon and text children
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'icon-button',
            type: 'button',
            props: { className: 'flex items-center gap-2' },
            children: [
              { type: 'icon', props: { name: 'download', size: 16 } },
              { type: 'span', content: 'Download' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'icon-button' }],
          },
        ],
      })

      // WHEN: the button renders with icon + text children
      await page.goto('/')

      // THEN: icon renders inside the button alongside the text
      const button = page.locator('button')
      await expect(button).toBeVisible()
      await expect(button.locator('[data-testid="icon-download"]')).toBeVisible()
      await expect(button.locator('span')).toHaveText('Download')
    }
  )

  test(
    'APP-ICON-014: should render icon correctly as child of link component',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: link component with icon and text children
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'icon-link',
            type: 'a',
            props: { href: '/next', className: 'flex items-center gap-1' },
            children: [
              { type: 'span', content: 'Next Page' },
              { type: 'icon', props: { name: 'arrow-right', size: 14 } },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'icon-link' }],
          },
        ],
      })

      // WHEN: the link renders with text + icon children
      await page.goto('/')

      // THEN: icon renders inside the link alongside the text
      const link = page.locator('a[href="/next"]')
      await expect(link).toBeVisible()
      await expect(link.locator('[data-testid="icon-arrow-right"]')).toBeVisible()
      await expect(link.locator('span')).toHaveText('Next Page')
    }
  )

  // ============================================================================
  // ICON WITH COMPONENT TEMPLATES ($ref/$vars) (@spec)
  // ============================================================================

  test(
    'APP-ICON-015: should resolve icon name from $variable in component template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component template with $icon variable in icon name
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'feature-item',
            type: 'div',
            props: { className: 'flex items-center gap-3' },
            children: [
              { type: 'icon', props: { name: '$icon', size: 20 } },
              { type: 'span', content: '$label' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              { component: 'feature-item', vars: { icon: 'zap', label: 'Lightning Fast' } },
              { component: 'feature-item', vars: { icon: 'shield', label: 'Secure by Default' } },
            ],
          },
        ],
      })

      // WHEN: the template is instantiated with different $icon values
      await page.goto('/')

      // THEN: each instance renders the correct icon based on the variable
      await expect(page.locator('[data-testid="icon-zap"]')).toBeVisible()
      await expect(page.locator('[data-testid="icon-shield"]')).toBeVisible()
      // Verify the labels are next to the correct icons (data-testid includes instance index)
      const firstFeature = page.locator('[data-testid="component-feature-item-0"]')
      await expect(firstFeature.locator('span')).toHaveText('Lightning Fast')
      await expect(firstFeature.locator('[data-testid="icon-zap"]')).toBeVisible()
      const secondFeature = page.locator('[data-testid="component-feature-item-1"]')
      await expect(secondFeature.locator('span')).toHaveText('Secure by Default')
      await expect(secondFeature.locator('[data-testid="icon-shield"]')).toBeVisible()
    }
  )

  test(
    'APP-ICON-016: should resolve icon color from $variable in component template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component template with $iconColor variable in icon color
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'colored-feature',
            type: 'div',
            children: [
              { type: 'icon', props: { name: '$icon', color: '$iconColor' } },
              { type: 'span', content: '$label' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                component: 'colored-feature',
                vars: { icon: 'zap', iconColor: '#f59e0b', label: 'Fast' },
              },
              {
                component: 'colored-feature',
                vars: { icon: 'shield', iconColor: '#10b981', label: 'Safe' },
              },
            ],
          },
        ],
      })

      // WHEN: the template is instantiated with different $iconColor values
      await page.goto('/')

      // THEN: each icon has the correct color from the variable
      const zapIcon = page.locator('[data-testid="icon-zap"]')
      await expect(zapIcon).toBeVisible()
      await expect(zapIcon).toHaveAttribute('stroke', '#f59e0b')
      const shieldIcon = page.locator('[data-testid="icon-shield"]')
      await expect(shieldIcon).toBeVisible()
      await expect(shieldIcon).toHaveAttribute('stroke', '#10b981')
    }
  )

  // ============================================================================
  // GRACEFUL FALLBACK FOR UNKNOWN ICONS (@spec)
  // ============================================================================

  test(
    'APP-ICON-017: should not crash the page when an unknown icon name is used',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon component with a nonexistent Lucide icon name
      await startServerWithSchema({
        name: 'test-app',
        components: [
          { name: 'mystery-icon', type: 'icon', props: { name: 'nonexistent-icon-name' } },
          { name: 'valid-icon', type: 'icon', props: { name: 'check' } },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'mystery-icon' }, { component: 'valid-icon' }],
          },
        ],
      })

      // WHEN: the page renders with an unknown icon name
      await page.goto('/')

      // THEN: the page does not crash and the valid icon still renders
      await expect(page.locator('[data-testid="icon-check"]')).toBeVisible()
    }
  )

  test(
    'APP-ICON-018: should render a fallback indicator for unknown icon names',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon component with a nonexistent Lucide icon name
      await startServerWithSchema({
        name: 'test-app',
        components: [
          { name: 'unknown-icon', type: 'icon', props: { name: 'this-icon-does-not-exist' } },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ component: 'unknown-icon' }],
          },
        ],
      })

      // WHEN: the page renders with an unknown icon name
      await page.goto('/')

      // THEN: a fallback SVG or empty placeholder element is rendered instead of crashing
      const fallback = page.locator('[data-testid="icon-this-icon-does-not-exist"]')
      await expect(fallback).toBeAttached()
      // The fallback should be an SVG (empty or with a placeholder indicator)
      const tagName = await fallback.evaluate((el) => el.tagName.toLowerCase())
      expect(tagName).toBe('svg')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying icon features work together efficiently
  // Generated from 18 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-ICON-REGRESSION: user can use icons across various UI contexts',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Consolidated configuration from all @spec tests.
      // All components are rendered on a single page so each test.step()
      // only needs to navigate once and assert against its scoped locators.
      await startServerWithSchema({
        name: 'test-app',
        theme: { colors: { primary: '#3b82f6' } },
        components: [
          // 001 - basic inline SVG rendering
          { name: 'status-icon', type: 'icon', props: { name: 'check-circle' } },
          // 002 - distinct icons produce different path data
          { name: 'icon-star', type: 'icon', props: { name: 'star' } },
          { name: 'icon-heart', type: 'icon', props: { name: 'heart' } },
          // 003 - data-testid with specific icon name (home icon, unique)
          { name: 'nav-icon', type: 'icon', props: { name: 'home' } },
          // 004 - explicit size props (use unique icon: sun)
          { name: 'large-icon', type: 'icon', props: { name: 'sun', size: 32 } },
          { name: 'small-icon', type: 'icon', props: { name: 'moon', size: 16 } },
          // 005 - default 24px size (settings without size prop)
          { name: 'default-icon', type: 'icon', props: { name: 'settings' } },
          // 006 - explicit color prop
          { name: 'red-heart', type: 'icon', props: { name: 'heart-pulse', color: '#e11d48' } },
          // 007 - inherits currentColor from parent
          {
            name: 'colored-wrapper',
            type: 'div',
            props: { style: { color: 'rgb(59, 130, 246)' } },
            children: [{ type: 'icon', props: { name: 'info' } }],
          },
          // 008 - Tailwind color class via className
          {
            name: 'themed-icon',
            type: 'icon',
            props: { name: 'cog', className: 'text-primary' },
          },
          // 009 - strokeWidth control (use unique icon: minus / plus)
          { name: 'thin-arrow', type: 'icon', props: { name: 'minus', strokeWidth: 1 } },
          { name: 'bold-arrow', type: 'icon', props: { name: 'plus', strokeWidth: 3 } },
          // 010 - default stroke-width 2
          { name: 'default-stroke', type: 'icon', props: { name: 'circle' } },
          // 011 - aria-hidden when no ariaLabel
          { name: 'decorative-chevron', type: 'icon', props: { name: 'chevron-right' } },
          // 012 - role="img" + aria-label
          {
            name: 'status-ok',
            type: 'icon',
            props: { name: 'badge-check', ariaLabel: 'Status OK' },
          },
          // 013 - icon as child of button
          {
            name: 'icon-button',
            type: 'button',
            props: { className: 'flex items-center gap-2' },
            children: [
              { type: 'icon', props: { name: 'download', size: 16 } },
              { type: 'span', content: 'Download' },
            ],
          },
          // 014 - icon as child of link
          {
            name: 'icon-link',
            type: 'a',
            props: { href: '/next', className: 'flex items-center gap-1' },
            children: [
              { type: 'span', content: 'Next Page' },
              { type: 'icon', props: { name: 'arrow-right', size: 14 } },
            ],
          },
          // 015 - $variable icon name in template
          {
            name: 'feature-item',
            type: 'div',
            props: { className: 'flex items-center gap-3' },
            children: [
              { type: 'icon', props: { name: '$icon', size: 20 } },
              { type: 'span', content: '$label' },
            ],
          },
          // 016 - $variable icon color in template
          {
            name: 'colored-feature',
            type: 'div',
            children: [
              { type: 'icon', props: { name: '$icon', color: '$iconColor' } },
              { type: 'span', content: '$label' },
            ],
          },
          // 017 - unknown icon doesn't crash + valid icon still works
          { name: 'mystery-icon', type: 'icon', props: { name: 'nonexistent-icon-name' } },
          { name: 'valid-icon', type: 'icon', props: { name: 'check' } },
          // 018 - fallback SVG for unknown icon
          { name: 'unknown-icon', type: 'icon', props: { name: 'this-icon-does-not-exist' } },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              // 001
              { component: 'status-icon' },
              // 002
              { component: 'icon-star' },
              { component: 'icon-heart' },
              // 003
              { component: 'nav-icon' },
              // 004
              { component: 'large-icon' },
              { component: 'small-icon' },
              // 005
              { component: 'default-icon' },
              // 006
              { component: 'red-heart' },
              // 007
              { component: 'colored-wrapper' },
              // 008
              { component: 'themed-icon' },
              // 009
              { component: 'thin-arrow' },
              { component: 'bold-arrow' },
              // 010
              { component: 'default-stroke' },
              // 011
              { component: 'decorative-chevron' },
              // 012
              { component: 'status-ok' },
              // 013
              { component: 'icon-button' },
              // 014
              { component: 'icon-link' },
              // 015
              { component: 'feature-item', vars: { icon: 'zap', label: 'Lightning Fast' } },
              {
                component: 'feature-item',
                vars: { icon: 'shield', label: 'Secure by Default' },
              },
              // 016
              {
                component: 'colored-feature',
                vars: { icon: 'flame', iconColor: '#f59e0b', label: 'Fast' },
              },
              {
                component: 'colored-feature',
                vars: { icon: 'lock', iconColor: '#10b981', label: 'Safe' },
              },
              // 017
              { component: 'mystery-icon' },
              { component: 'valid-icon' },
              // 018
              { component: 'unknown-icon' },
            ],
          },
        ],
      })

      // WHEN: all icons are rendered on a single page
      await page.goto('/')

      await test.step('APP-ICON-001: Renders icon as inline SVG with correct Lucide path data', async () => {
        const svg = page.locator('[data-testid="icon-check-circle"]')
        await expect(svg).toBeVisible()
        await expect(svg).toHaveAttribute('xmlns', 'http://www.w3.org/2000/svg')
        const pathElements = svg.locator('path, circle, line, polyline, rect')
        await expect(pathElements.first()).toBeAttached()
      })

      await test.step('APP-ICON-002: Maps icon name to the correct Lucide icon', async () => {
        const starSvg = page.locator('[data-testid="icon-star"]')
        const heartSvg = page.locator('[data-testid="icon-heart"]')
        await expect(starSvg).toBeVisible()
        await expect(heartSvg).toBeVisible()
        const starHtml = await starSvg.innerHTML()
        const heartHtml = await heartSvg.innerHTML()
        expect(starHtml).not.toBe(heartHtml)
      })

      await test.step('APP-ICON-003: Has data-testid="icon-{name}" for test selection', async () => {
        await expect(page.locator('[data-testid="icon-home"]')).toBeVisible()
      })

      await test.step('APP-ICON-004: Respects size prop for width and height', async () => {
        const largeSvg = page.locator('[data-testid="icon-sun"]')
        await expect(largeSvg).toHaveAttribute('width', '32')
        await expect(largeSvg).toHaveAttribute('height', '32')
        const smallSvg = page.locator('[data-testid="icon-moon"]')
        await expect(smallSvg).toHaveAttribute('width', '16')
        await expect(smallSvg).toHaveAttribute('height', '16')
      })

      await test.step('APP-ICON-005: Defaults to 24px when size prop is omitted', async () => {
        const svg = page.locator('[data-testid="icon-settings"]')
        await expect(svg).toHaveAttribute('width', '24')
        await expect(svg).toHaveAttribute('height', '24')
      })

      await test.step('APP-ICON-006: Sets SVG stroke color from color prop', async () => {
        const svg = page.locator('[data-testid="icon-heart-pulse"]')
        await expect(svg).toBeVisible()
        await expect(svg).toHaveAttribute('stroke', '#e11d48')
      })

      await test.step('APP-ICON-007: Inherits currentColor when no color prop is specified', async () => {
        const svg = page.locator('[data-testid="icon-info"]')
        await expect(svg).toBeVisible()
        await expect(svg).toHaveAttribute('stroke', 'currentColor')
      })

      await test.step('APP-ICON-008: Applies Tailwind color classes via className prop', async () => {
        const svg = page.locator('[data-testid="icon-cog"]')
        await expect(svg).toBeVisible()
        await expect(svg).toHaveClass(/text-primary/)
      })

      await test.step('APP-ICON-009: Controls SVG stroke-width from strokeWidth prop', async () => {
        const thinSvg = page.locator('[data-testid="icon-minus"]')
        await expect(thinSvg).toHaveAttribute('stroke-width', '1')
        const boldSvg = page.locator('[data-testid="icon-plus"]')
        await expect(boldSvg).toHaveAttribute('stroke-width', '3')
      })

      await test.step('APP-ICON-010: Defaults stroke width to 2 when omitted', async () => {
        const svg = page.locator('[data-testid="icon-circle"]')
        await expect(svg).toHaveAttribute('stroke-width', '2')
      })

      await test.step('APP-ICON-011: Sets aria-hidden="true" when no ariaLabel is provided', async () => {
        const svg = page.locator('[data-testid="icon-chevron-right"]')
        await expect(svg).toHaveAttribute('aria-hidden', 'true')
      })

      await test.step('APP-ICON-012: Sets role="img" and aria-label when ariaLabel is provided', async () => {
        const svg = page.locator('[data-testid="icon-badge-check"]')
        await expect(svg).toBeVisible()
        await expect(svg).toHaveAttribute('role', 'img')
        await expect(svg).toHaveAttribute('aria-label', 'Status OK')
      })

      await test.step('APP-ICON-013: Renders icon correctly as child of button component', async () => {
        const button = page.locator('button')
        await expect(button).toBeVisible()
        await expect(button.locator('[data-testid="icon-download"]')).toBeVisible()
        await expect(button.locator('span')).toHaveText('Download')
      })

      await test.step('APP-ICON-014: Renders icon correctly as child of link component', async () => {
        const link = page.locator('a[href="/next"]')
        await expect(link).toBeVisible()
        await expect(link.locator('[data-testid="icon-arrow-right"]')).toBeVisible()
        await expect(link.locator('span')).toHaveText('Next Page')
      })

      await test.step('APP-ICON-015: Resolves icon name from $variable in component template', async () => {
        await expect(page.locator('[data-testid="icon-zap"]')).toBeVisible()
        await expect(page.locator('[data-testid="icon-shield"]')).toBeVisible()
      })

      await test.step('APP-ICON-016: Resolves icon color from $variable in component template', async () => {
        const flameIcon = page.locator('[data-testid="icon-flame"]')
        await expect(flameIcon).toBeVisible()
        await expect(flameIcon).toHaveAttribute('stroke', '#f59e0b')
        const lockIcon = page.locator('[data-testid="icon-lock"]')
        await expect(lockIcon).toBeVisible()
        await expect(lockIcon).toHaveAttribute('stroke', '#10b981')
      })

      await test.step('APP-ICON-017: Does not crash the page when an unknown icon name is used', async () => {
        await expect(page.locator('[data-testid="icon-check"]')).toBeVisible()
      })

      await test.step('APP-ICON-018: Renders a fallback indicator for unknown icon names', async () => {
        const fallback = page.locator('[data-testid="icon-this-icon-does-not-exist"]')
        await expect(fallback).toBeAttached()
        const tagName = await fallback.evaluate((el) => el.tagName.toLowerCase())
        expect(tagName).toBe('svg')
      })
    }
  )
})
