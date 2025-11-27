/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Spacing Configuration
 *
 * Source: src/domain/models/app/theme/index.ts
 * Spec Count: 13
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (13 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Spacing Configuration', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-THEME-SPACING-001: should validate Tailwind spacing utilities',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: spacing using Tailwind utility classes (py-16, px-4)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            section: 'py-16',
            container: 'px-4',
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
                  'data-testid': 'spacing',
                  className: 'py-16 px-4',
                },
                children: ['Spacing validation test'],
              },
            ],
          },
        ],
      })

      // WHEN: spacing is defined with Tailwind syntax
      await page.goto('/')

      // THEN: it should validate Tailwind spacing utilities
      await expect(page.locator('[data-testid="spacing"]')).toBeVisible()
      await expect(page.locator('[data-testid="spacing"]')).toHaveClass(/py-16/)
      await expect(page.locator('[data-testid="spacing"]')).toHaveClass(/px-4/)
    }
  )

  test(
    'APP-THEME-SPACING-002: should validate responsive spacing with Tailwind breakpoints',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: spacing with responsive variants (py-16 sm:py-20)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            section: 'py-16 sm:py-20',
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
                  'data-testid': 'responsive-spacing',
                  className: 'py-16 sm:py-20',
                },
                children: ['Responsive spacing test'],
              },
            ],
          },
        ],
      })

      // WHEN: spacing includes breakpoint-specific values
      await page.goto('/')

      // THEN: it should validate responsive spacing with Tailwind breakpoints
      await expect(page.locator('[data-testid="responsive-spacing"]')).toBeVisible()
      await expect(page.locator('[data-testid="responsive-spacing"]')).toHaveClass(/py-16/)
      await expect(page.locator('[data-testid="responsive-spacing"]')).toHaveClass(/sm:py-20/)
    }
  )

  test(
    'APP-THEME-SPACING-003: should validate centering and width constraints',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: container spacing with max-width and auto margins
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            container: 'max-w-7xl mx-auto px-4',
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

      // WHEN: spacing defines container constraints (max-w-7xl mx-auto px-4)
      await page.goto('/')

      // THEN: it should validate centering and width constraints
      const container = page.locator('[data-testid="container"]')
      await expect(container).toHaveClass(/max-w-7xl/)
      await expect(container).toHaveClass(/mx-auto/)
    }
  )

  test(
    'APP-THEME-SPACING-004: should validate consistent spacing scale',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: spacing variants with size modifiers (gap, gap-small, gap-large)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            'gap-small': '1rem',
            gap: '1.5rem',
            'gap-large': '2rem',
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
                  'data-testid': 'spacing-scale',
                  className: 'flex flex-col gap-6 p-5',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      className: 'flex p-3 border border-gray-200',
                      style: {
                        gap: 'var(--spacing-gap-small)',
                      },
                    },
                    children: [
                      {
                        type: 'div',
                        props: { className: 'p-5 bg-blue-500' },
                      },
                      {
                        type: 'div',
                        props: { className: 'p-5 bg-blue-500' },
                      },
                      {
                        type: 'div',
                        props: { className: 'p-5 bg-blue-500' },
                      },
                    ],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'flex p-3 border border-gray-200',
                      style: {
                        gap: 'var(--spacing-gap)',
                      },
                    },
                    children: [
                      {
                        type: 'div',
                        props: { className: 'p-5 bg-emerald-500' },
                      },
                      {
                        type: 'div',
                        props: { className: 'p-5 bg-emerald-500' },
                      },
                      {
                        type: 'div',
                        props: { className: 'p-5 bg-emerald-500' },
                      },
                    ],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'flex p-3 border border-gray-200',
                      style: {
                        gap: 'var(--spacing-gap-large)',
                      },
                    },
                    children: [
                      {
                        type: 'div',
                        props: { className: 'p-5 bg-amber-500' },
                      },
                      {
                        type: 'div',
                        props: { className: 'p-5 bg-amber-500' },
                      },
                      {
                        type: 'div',
                        props: { className: 'p-5 bg-amber-500' },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: spacing system includes small, medium, and large variants
      await page.goto('/')

      // THEN: it should validate consistent spacing scale
      // 1. Verify CSS compilation contains spacing custom properties
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--spacing-gap-small: 1rem')
      expect(css).toContain('--spacing-gap: 1.5rem')
      expect(css).toContain('--spacing-gap-large: 2rem')

      // 2. Visual validation shows gap progression (small → medium → large)
      await expect(page.locator('[data-testid="spacing-scale"]')).toHaveScreenshot(
        'spacing-004-gap-scale.png',
        {
          animations: 'disabled',
        }
      )
    }
  )

  test(
    'APP-THEME-SPACING-005: should validate visual rhythm between sections',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: section spacing with vertical padding
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            section: 'py-16 sm:py-20',
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

      // WHEN: spacing defines consistent section padding
      await page.goto('/')

      // THEN: it should validate visual rhythm between sections
      await expect(page.locator('[data-testid="section"]')).toHaveClass(/py-16/)
    }
  )

  test(
    'APP-THEME-SPACING-006: should validate hierarchical content width constraints',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: multiple container sizes (container, container-small, container-xsmall)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            container: 'max-w-7xl mx-auto px-4',
            'container-small': 'max-w-4xl mx-auto px-4',
            'container-xsmall': 'max-w-2xl mx-auto px-4',
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

      // WHEN: spacing includes different max-widths for various contexts
      await page.goto('/')

      // THEN: it should validate hierarchical content width constraints
      await expect(page.locator('[data-testid="container"]')).toHaveClass(/max-w-7xl/)
      await expect(page.locator('[data-testid="container-small"]')).toHaveClass(/max-w-4xl/)
      await expect(page.locator('[data-testid="container-xsmall"]')).toHaveClass(/max-w-2xl/)
    }
  )

  test(
    'APP-THEME-SPACING-007: should validate consistent internal component spacing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: padding variants (padding, padding-small, padding-large)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            'padding-small': '1rem',
            padding: '1.5rem',
            'padding-large': '2rem',
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
                  'data-testid': 'padding-scale',
                  className: 'flex gap-4 p-5',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      className: 'bg-blue-50 border-2 border-blue-500',
                      style: {
                        padding: 'var(--spacing-padding-small)',
                      },
                    },
                    children: ['Small'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-emerald-50 border-2 border-emerald-500',
                      style: {
                        padding: 'var(--spacing-padding)',
                      },
                    },
                    children: ['Medium'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-amber-50 border-2 border-amber-500',
                      style: {
                        padding: 'var(--spacing-padding-large)',
                      },
                    },
                    children: ['Large'],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: spacing system provides padding scale
      await page.goto('/')

      // THEN: it should validate consistent internal component spacing
      // 1. Verify CSS compilation contains spacing custom properties
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--spacing-padding-small: 1rem')
      expect(css).toContain('--spacing-padding: 1.5rem')
      expect(css).toContain('--spacing-padding-large: 2rem')

      // 2. Visual validation shows padding progression (small → medium → large)
      await expect(page.locator('[data-testid="padding-scale"]')).toHaveScreenshot(
        'spacing-007-padding-scale.png',
        {
          animations: 'disabled',
        }
      )
    }
  )

  test(
    'APP-THEME-SPACING-008: should validate consistent external component spacing',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: margin variants (margin, margin-small, margin-large)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            'margin-small': 'm-4',
            margin: 'm-6',
            'margin-large': 'm-8',
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
                  'data-testid': 'margin-scale',
                  className: 'flex gap-0 p-5',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      'data-testid': 'margin-small',
                      className: 'm-4 bg-blue-50 border-2 border-blue-500 p-2',
                    },
                    children: ['Small'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-emerald-50 border-2 border-emerald-500 p-2',
                    },
                    children: ['Medium'],
                  },
                  {
                    type: 'div',
                    props: {
                      'data-testid': 'margin-large',
                      className: 'm-8 bg-amber-50 border-2 border-amber-500 p-2',
                    },
                    children: ['Large'],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: spacing system provides margin scale
      await page.goto('/')

      // THEN: it should validate consistent external component spacing
      await expect(page.locator('[data-testid="margin-small"]')).toHaveClass(/m-4/)
      await expect(page.locator('[data-testid="margin-large"]')).toHaveClass(/m-8/)
    }
  )

  test(
    'APP-THEME-SPACING-009: should validate custom CSS spacing values',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: spacing using CSS values (2rem, 16px, 1.5em)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            section: '4rem',
            gap: '1rem',
            padding: '16px',
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

      // WHEN: spacing is defined with raw CSS instead of Tailwind
      await page.goto('/')

      // THEN: it should validate custom CSS spacing values
      // 1. Verify CSS compilation contains spacing custom properties
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--spacing-section: 4rem')
      expect(css).toContain('--spacing-gap: 1rem')
      expect(css).toContain('--spacing-padding: 16px')

      // 2. Visual validation
      const section = page.locator('[data-testid="section"]')
      await expect(section).toHaveScreenshot('spacing-009-custom-css.png')
    }
  )

  test(
    'APP-THEME-SPACING-010: should validate comprehensive spacing system',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a complete spacing system
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            section: 'py-16 sm:py-20',
            container: 'max-w-7xl mx-auto px-4',
            gap: 'gap-6',
            padding: 'p-6',
            margin: 'm-6',
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

      // WHEN: all spacing tokens are configured
      await page.goto('/')

      // THEN: it should validate comprehensive spacing system
      await expect(page.locator('[data-testid="section"]')).toHaveClass(/py-16/)
      await expect(page.locator('[data-testid="container"]')).toHaveClass(/max-w-7xl/)
    }
  )

  test(
    'APP-THEME-SPACING-011: should render with vertical padding creating rhythm',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: section spacing applied to page section
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            section: '4rem',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'section',
                content: 'Content',
              },
            ],
          },
        ],
      })

      // WHEN: section uses theme.spacing.section
      await page.goto('/')

      // THEN: it should render with vertical padding creating rhythm
      // 1. Verify CSS compilation contains spacing custom property
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--spacing-section: 4rem')

      // 2. Visual validation
      const section = page.locator('section')
      await expect(section).toHaveScreenshot('spacing-app-001-section-rhythm.png')
    }
  )

  test(
    'APP-THEME-SPACING-012: should render centered with max-width constraint',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: container spacing applied to content wrapper
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            container: '80rem',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'container',
                content: 'Content',
              },
            ],
          },
        ],
      })

      // WHEN: div uses theme.spacing.container
      await page.goto('/')

      // THEN: it should render centered with max-width constraint
      // 1. Verify CSS compilation contains spacing custom property
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--spacing-container: 80rem')

      // 2. Visual validation
      const container = page.locator('[data-testid="container"]')
      await expect(container).toHaveScreenshot('spacing-app-002-container-centered.png')
    }
  )

  test(
    'APP-THEME-SPACING-013: should render with spacing between flex items',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: gap spacing applied to flex container
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            gap: '1.5rem',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'flex',
                children: [
                  { type: 'div', content: 'Item 1' },
                  { type: 'div', content: 'Item 2' },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: flex container uses theme.spacing.gap
      await page.goto('/')

      // THEN: it should render with spacing between flex items
      // 1. Verify CSS compilation contains spacing custom property
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--spacing-gap: 1.5rem')

      // 2. Visual validation
      const flex = page.locator('[data-testid="flex"]')
      await expect(flex).toHaveScreenshot('spacing-app-003-flex-gap.png')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-THEME-SPACING-014: user can complete full spacing workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with comprehensive spacing system
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          spacing: {
            section: '4rem',
            gap: '1.5rem',
            padding: '2rem',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'spacing-system',
                  className: 'flex flex-col',
                  style: {
                    gap: 'var(--spacing-section)',
                  },
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      className: 'bg-gray-100 border-2 border-dashed border-gray-400',
                      style: {
                        padding: 'var(--spacing-section)',
                      },
                    },
                    children: ['Section with 4rem padding'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'flex bg-indigo-100 border-2 border-indigo-500',
                      style: {
                        gap: 'var(--spacing-gap)',
                        padding: 'var(--spacing-padding)',
                      },
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          className: 'p-5 bg-white',
                        },
                        children: ['Item 1'],
                      },
                      {
                        type: 'div',
                        props: {
                          className: 'p-5 bg-white',
                        },
                        children: ['Item 2'],
                      },
                      {
                        type: 'div',
                        props: {
                          className: 'p-5 bg-white',
                        },
                        children: ['Item 3'],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // 1. Verify CSS compilation contains spacing custom properties
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--spacing-section: 4rem')
      expect(css).toContain('--spacing-gap: 1.5rem')
      expect(css).toContain('--spacing-padding: 2rem')

      // 2. Structure validation (ARIA)
      // THEN: assertion
      await expect(page.locator('[data-testid="spacing-system"]')).toMatchAriaSnapshot(`
        - group:
          - group: Section with 4rem padding
          - group:
            - group: Item 1
            - group: Item 2
            - group: Item 3
      `)

      // 3. Visual validation (Screenshot) - captures all spacing rendering
      await expect(page.locator('[data-testid="spacing-system"]')).toHaveScreenshot(
        'spacing-regression-001-complete-system.png',
        {
          animations: 'disabled',
        }
      )

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
