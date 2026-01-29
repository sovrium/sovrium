/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Color Palette
 *
 * Source: src/domain/models/app/theme/index.ts
 * Spec Count: 15
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (15 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Color Palette', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-THEME-COLORS-001: should validate 6-digit hex colors at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a color palette with semantic colors (primary, secondary)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            primary: '#007bff',
            secondary: '#6c757d',
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
                  'data-testid': 'color-primary',
                  className: 'bg-primary text-secondary p-5',
                },
                children: ['Primary Color Text'],
              },
            ],
          },
        ],
      })

      // WHEN: colors are defined with hex values
      await page.goto('/')

      // THEN: it should validate 6-digit hex colors at build time

      // 1. Verify CSS compilation contains theme colors
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--color-primary: #007bff')
      expect(css).toContain('--color-secondary: #6c757d')

      // 2. Visual validation captures rendered output with CSS classes
      await expect(page.locator('[data-testid="color-primary"]')).toHaveScreenshot(
        'colors-001-hex-colors.png',
        {
          animations: 'disabled',
          threshold: 0.2, // Color tolerance
        }
      )

      // 3. Verify computed styles match theme colors
      const element = page.locator('[data-testid="color-primary"]')
      const bgColor = await element.evaluate((el) => window.getComputedStyle(el).backgroundColor)
      const textColor = await element.evaluate((el) => window.getComputedStyle(el).color)
      // THEN: assertion
      expect(bgColor).toBe('rgb(0, 123, 255)') // #007bff
      expect(textColor).toBe('rgb(108, 117, 125)') // #6c757d
    }
  )

  test(
    'APP-THEME-COLORS-002: should validate 8-digit hex colors with opacity at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a color with 8-digit hex value for transparency
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            'primary-transparent': '#007bff80',
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
                  'data-testid': 'color-primary-transparent',
                  className: 'bg-primary-transparent p-10 relative',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      className: 'absolute inset-x-0 top-0 h-1/2 bg-white -z-10',
                    },
                  },
                  'Transparent Background (50% opacity)',
                ],
              },
            ],
          },
        ],
      })

      // WHEN: color includes alpha channel
      await page.goto('/')

      // THEN: it should validate 8-digit hex colors with opacity at build time

      // 1. Verify CSS compilation contains theme color with opacity
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--color-primary-transparent: #007bff80')

      // 2. Visual validation captures transparency effect
      await expect(page.locator('[data-testid="color-primary-transparent"]')).toHaveScreenshot(
        'colors-002-hex-opacity.png',
        {
          animations: 'disabled',
          threshold: 0.2,
        }
      )
    }
  )

  test(
    'APP-THEME-COLORS-003: should validate rgb color format at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a color with rgb() format
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            danger: 'rgb(255, 0, 0)',
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
                  'data-testid': 'color-danger',
                  className: 'bg-danger text-white p-5',
                },
                children: ['Danger Color (RGB format)'],
              },
            ],
          },
        ],
      })

      // WHEN: color is defined as rgb(255, 0, 0)
      await page.goto('/')

      // THEN: it should validate rgb color format at build time

      // 1. Verify CSS compilation contains RGB color
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--color-danger: rgb(255, 0, 0)')

      // 2. Visual validation captures RGB color rendering
      await expect(page.locator('[data-testid="color-danger"]')).toHaveScreenshot(
        'colors-003-rgb-format.png',
        {
          animations: 'disabled',
          threshold: 0.2,
        }
      )

      // 3. Verify computed style matches RGB color
      const element = page.locator('[data-testid="color-danger"]')
      const bgColor = await element.evaluate((el) => window.getComputedStyle(el).backgroundColor)
      // THEN: assertion
      expect(bgColor).toBe('rgb(255, 0, 0)')
    }
  )

  test(
    'APP-THEME-COLORS-004: should validate rgba color format with alpha at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a color with rgba() format for transparency
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            'danger-semi': 'rgba(255, 0, 0, 0.5)',
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
                  'data-testid': 'color-danger-semi',
                  className: 'bg-danger-semi text-white p-10',
                },
                children: ['Danger Semi-transparent (RGBA)'],
              },
            ],
          },
        ],
      })

      // WHEN: color is defined as rgba(255, 0, 0, 0.5)
      await page.goto('/')

      // THEN: it should validate rgba color format with alpha at build time

      // 1. Verify CSS compilation contains RGBA color
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--color-danger-semi: rgba(255, 0, 0, 0.5)')

      // 2. Visual validation captures RGBA transparency
      await expect(page.locator('[data-testid="color-danger-semi"]')).toHaveScreenshot(
        'colors-004-rgba-format.png',
        {
          animations: 'disabled',
          threshold: 0.2,
        }
      )

      // 3. Verify computed style matches RGBA color
      const element = page.locator('[data-testid="color-danger-semi"]')
      const bgColor = await element.evaluate((el) => window.getComputedStyle(el).backgroundColor)
      // THEN: assertion
      expect(bgColor).toBe('rgba(255, 0, 0, 0.5)')
    }
  )

  test(
    'APP-THEME-COLORS-005: should validate hsl color format at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a color with hsl() format
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            primary: 'hsl(210, 100%, 50%)',
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
                  'data-testid': 'color-primary',
                  className: 'bg-primary text-white p-5',
                },
                children: ['Primary Color (HSL format)'],
              },
            ],
          },
        ],
      })

      // WHEN: color is defined as hsl(210, 100%, 50%)
      await page.goto('/')

      // THEN: it should validate hsl color format at build time

      // 1. Verify CSS compilation contains HSL color
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--color-primary: hsl(210, 100%, 50%)')

      // 2. Visual validation captures HSL color rendering
      await expect(page.locator('[data-testid="color-primary"]')).toHaveScreenshot(
        'colors-005-hsl-format.png',
        {
          animations: 'disabled',
          threshold: 0.2,
        }
      )

      // 3. Verify computed style matches HSL color
      const element = page.locator('[data-testid="color-primary"]')
      const bgColor = await element.evaluate((el) => window.getComputedStyle(el).backgroundColor)
      // THEN: assertion
      expect(bgColor).toBe('rgb(0, 128, 255)') // hsl(210, 100%, 50%) converts to this RGB
    }
  )

  test(
    'APP-THEME-COLORS-006: should validate hsla color format with alpha at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a color with hsla() format for transparency
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            'primary-overlay': 'hsla(210, 100%, 50%, 0.8)',
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
                  'data-testid': 'color-primary-overlay',
                  className: 'bg-primary-overlay text-white p-10',
                },
                children: ['Primary Overlay (HSLA)'],
              },
            ],
          },
        ],
      })

      // WHEN: color is defined as hsla(210, 100%, 50%, 0.8)
      await page.goto('/')

      // THEN: it should validate hsla color format with alpha at build time

      // 1. Verify CSS compilation contains HSLA color
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--color-primary-overlay: hsla(210, 100%, 50%, 0.8)')

      // 2. Visual validation captures HSLA transparency
      await expect(page.locator('[data-testid="color-primary-overlay"]')).toHaveScreenshot(
        'colors-006-hsla-format.png',
        {
          animations: 'disabled',
          threshold: 0.2,
        }
      )

      // 3. Verify computed style matches HSLA color
      const element = page.locator('[data-testid="color-primary-overlay"]')
      const bgColor = await element.evaluate((el) => window.getComputedStyle(el).backgroundColor)
      // THEN: assertion
      expect(bgColor).toBe('rgba(0, 128, 255, 0.8)')
    }
  )

  test(
    'APP-THEME-COLORS-007: should validate color variants for hover states and tints',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: color variants with suffixes (primary-hover, primary-light)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            primary: '#007bff',
            'primary-hover': '#0056b3',
            'primary-light': '#e7f1ff',
            'primary-dark': '#003d7a',
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
                  'data-testid': 'color-variants',
                  className: 'grid grid-cols-4 gap-4',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      className: 'bg-primary text-white p-5 text-center',
                    },
                    children: ['Primary'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-primary-hover text-white p-5 text-center',
                    },
                    children: ['Hover'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-primary-light text-black p-5 text-center',
                    },
                    children: ['Light'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-primary-dark text-white p-5 text-center',
                    },
                    children: ['Dark'],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: colors use kebab-case variant naming
      await page.goto('/')

      // THEN: it should validate color variants for hover states and tints

      // 1. Verify CSS compilation contains all color variants
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--color-primary: #007bff')
      expect(css).toContain('--color-primary-hover: #0056b3')
      expect(css).toContain('--color-primary-light: #e7f1ff')
      expect(css).toContain('--color-primary-dark: #003d7a')

      // 2. Visual validation shows all variants side-by-side
      await expect(page.locator('[data-testid="color-variants"]')).toHaveScreenshot(
        'colors-007-variants.png',
        {
          animations: 'disabled',
          threshold: 0.2,
        }
      )
    }
  )

  test(
    'APP-THEME-COLORS-008: should validate numbered color scales for systematic gradients',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: gray scale with numbered variants (gray-100 to gray-900)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            'gray-100': '#f8f9fa',
            'gray-300': '#dee2e6',
            'gray-500': '#adb5bd',
            'gray-700': '#495057',
            'gray-900': '#212529',
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
                  'data-testid': 'color-scale',
                  className: 'grid grid-cols-5 gap-2',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      className: 'bg-gray-100 text-black p-6 text-center',
                    },
                    children: ['100'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-gray-300 text-black p-6 text-center',
                    },
                    children: ['300'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-gray-500 text-white p-6 text-center',
                    },
                    children: ['500'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-gray-700 text-white p-6 text-center',
                    },
                    children: ['700'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-gray-900 text-white p-6 text-center',
                    },
                    children: ['900'],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: colors use numbered scale system
      await page.goto('/')

      // THEN: it should validate numbered color scales for systematic gradients

      // 1. Verify CSS compilation contains all gray scale colors
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--color-gray-100: #f8f9fa')
      expect(css).toContain('--color-gray-300: #dee2e6')
      expect(css).toContain('--color-gray-500: #adb5bd')
      expect(css).toContain('--color-gray-700: #495057')
      expect(css).toContain('--color-gray-900: #212529')

      // 2. Visual validation shows complete scale progression
      await expect(page.locator('[data-testid="color-scale"]')).toHaveScreenshot(
        'colors-008-numbered-scale.png',
        {
          animations: 'disabled',
          threshold: 0.2,
        }
      )
    }
  )

  test(
    'APP-THEME-COLORS-009: should validate comprehensive color system for all UI needs',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a complete color system with semantic, descriptive, and variant colors
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            primary: '#007bff',
            secondary: '#6c757d',
            success: '#28a745',
            danger: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8',
            light: '#f8f9fa',
            dark: '#343a40',
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
                  'data-testid': 'color-system',
                  className: 'grid grid-cols-4 gap-3',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      className: 'bg-primary text-white p-5 text-center',
                    },
                    children: ['Primary'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-secondary text-white p-5 text-center',
                    },
                    children: ['Secondary'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-success text-white p-5 text-center',
                    },
                    children: ['Success'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-danger text-white p-5 text-center',
                    },
                    children: ['Danger'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-warning text-black p-5 text-center',
                    },
                    children: ['Warning'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-info text-white p-5 text-center',
                    },
                    children: ['Info'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-light text-black p-5 text-center border border-gray-300',
                    },
                    children: ['Light'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-dark text-white p-5 text-center',
                    },
                    children: ['Dark'],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: palette includes primary, secondary, success, danger, warning, info, light, dark, grays
      await page.goto('/')

      // THEN: it should validate comprehensive color system for all UI needs

      // 1. Verify CSS compilation contains all semantic colors
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--color-primary: #007bff')
      expect(css).toContain('--color-secondary: #6c757d')
      expect(css).toContain('--color-success: #28a745')
      expect(css).toContain('--color-danger: #dc3545')
      expect(css).toContain('--color-warning: #ffc107')
      expect(css).toContain('--color-info: #17a2b8')
      expect(css).toContain('--color-light: #f8f9fa')
      expect(css).toContain('--color-dark: #343a40')

      // 2. Visual validation shows complete semantic color palette
      await expect(page.locator('[data-testid="color-system"]')).toHaveScreenshot(
        'colors-009-comprehensive-system.png',
        {
          animations: 'disabled',
          threshold: 0.2,
        }
      )
    }
  )

  test(
    'APP-THEME-COLORS-010: should validate kebab-case naming convention',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: color names in kebab-case (primary-color, background-primary)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            primary: '#007bff',
            'text-primary': '#212529',
            'background-light': '#f8f9fa',
            'border-subtle': '#dee2e6',
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
                  'data-testid': 'kebab-case-colors',
                  className: 'grid grid-cols-3 gap-3',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      className: 'text-text-primary p-5 text-center border-2 border-border-subtle',
                    },
                    children: ['text-primary'],
                  },
                  {
                    type: 'div',
                    props: {
                      className:
                        'bg-background-light p-5 text-center border-2 border-border-subtle',
                    },
                    children: ['background-light'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'bg-primary text-white p-5 text-center',
                    },
                    children: ['primary'],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: color names use multi-word kebab-case format
      await page.goto('/')

      // THEN: it should validate kebab-case naming convention

      // 1. Verify CSS compilation contains kebab-case color names
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--color-primary: #007bff')
      expect(css).toContain('--color-text-primary: #212529')
      expect(css).toContain('--color-background-light: #f8f9fa')
      expect(css).toContain('--color-border-subtle: #dee2e6')

      // 2. Visual validation shows kebab-case color application
      await expect(page.locator('[data-testid="kebab-case-colors"]')).toHaveScreenshot(
        'colors-010-kebab-case.png',
        {
          animations: 'disabled',
          threshold: 0.2,
        }
      )
    }
  )

  test(
    'APP-THEME-COLORS-011: should render button with primary background color',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: primary color used in button component
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            primary: '#007bff',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'button',
                content: 'Click me',
                props: {
                  'data-testid': 'cta-button',
                },
              },
            ],
          },
        ],
      })

      // WHEN: button applies theme.colors.primary
      await page.goto('/')

      // THEN: it should render button with primary background color
      const button = page.locator('[data-testid="cta-button"]')
      await expect(button).toHaveScreenshot('color-app-001-button-primary.png')
    }
  )

  test(
    'APP-THEME-COLORS-012: should render darker blue on hover',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: primary-hover color used on button:hover
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            primary: '#007bff',
            'primary-hover': '#0056b3',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'button',
                content: 'Hover me',
              },
            ],
          },
        ],
      })

      // WHEN: button hover state applies theme.colors.primary-hover
      await page.goto('/')

      // THEN: it should render darker blue on hover
      const button = page.locator('button')
      await button.hover()
      await expect(button).toHaveScreenshot('color-app-002-button-hover.png')
    }
  )

  test(
    'APP-THEME-COLORS-013: should render text with theme text color',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: text color used in typography
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            text: '#212529',
            'text-muted': '#6c757d',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'heading',
                content: 'Page Title',
              },
            ],
          },
        ],
      })

      // WHEN: heading applies theme.colors.text
      await page.goto('/')

      // THEN: it should render text with theme text color
      const heading = page.locator('h1')
      await expect(heading).toHaveScreenshot('color-app-003-heading-text.png')
    }
  )

  test(
    'APP-THEME-COLORS-014: should render green alert indicating success state',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: success color used in alert
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            success: '#28a745',
            'success-light': '#d4edda',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'alert',
                content: 'Success!',
                props: {
                  'data-testid': 'alert-success',
                  variant: 'success',
                },
              },
            ],
          },
        ],
      })

      // WHEN: alert applies theme.colors.success
      await page.goto('/')

      // THEN: it should render green alert indicating success state
      const alert = page.locator('[data-testid="alert-success"]')
      await expect(alert).toHaveScreenshot('color-app-004-alert-success.png')
    }
  )

  test(
    'APP-THEME-COLORS-015: should create visual hierarchy through tonal variation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: gray scale used in UI hierarchy
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: {
            'gray-100': '#f8f9fa',
            'gray-300': '#dee2e6',
            'gray-500': '#adb5bd',
            'gray-900': '#212529',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test Page',
              description: 'Test page for color hierarchy',
            },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'page-background',
                  className: 'bg-gray-100 p-5',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      'data-testid': 'card',
                      className: 'bg-white border border-gray-300 p-4',
                    },
                    children: [
                      {
                        type: 'heading',
                        content: 'Main Heading',
                        props: {
                          'data-testid': 'heading',
                          className: 'text-gray-900',
                        },
                      },
                      {
                        type: 'span',
                        children: ['Placeholder text'],
                        props: {
                          'data-testid': 'placeholder',
                          className: 'text-gray-500',
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: components use gray-100 to gray-900 for depth
      await page.goto('/')

      // THEN: it should create visual hierarchy through tonal variation

      // 1. Verify CSS compilation contains gray scale colors
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--color-gray-100: #f8f9fa')
      expect(css).toContain('--color-gray-300: #dee2e6')
      expect(css).toContain('--color-gray-500: #adb5bd')
      expect(css).toContain('--color-gray-900: #212529')

      // 2. Page background: gray-100 (#f8f9fa)
      const pageBackground = page.locator('[data-testid="page-background"]')
      const pageBgColor = await pageBackground.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      )
      // THEN: assertion
      expect(pageBgColor).toBe('rgb(248, 249, 250)') // gray-100

      // 3. Card border: gray-300 (#dee2e6)
      const card = page.locator('[data-testid="card"]')
      const cardBorderColor = await card.evaluate((el) => window.getComputedStyle(el).borderColor)
      // THEN: assertion
      expect(cardBorderColor).toBe('rgb(222, 226, 230)') // gray-300

      // 4. Placeholder text: gray-500 (#adb5bd)
      const placeholder = page.locator('[data-testid="placeholder"]')
      const placeholderColor = await placeholder.evaluate((el) => window.getComputedStyle(el).color)
      // THEN: assertion
      expect(placeholderColor).toBe('rgb(173, 181, 189)') // gray-500

      // 5. Heading text: gray-900 (#212529)
      const heading = page.locator('[data-testid="heading"]')
      const headingColor = await heading.evaluate((el) => window.getComputedStyle(el).color)
      // THEN: assertion
      expect(headingColor).toBe('rgb(33, 37, 41)') // gray-900
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 15 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-THEME-COLORS-REGRESSION: user can complete full colors workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // OPTIMIZATION: Consolidated from 15 startServerWithSchema calls to 2
      // Group 1: Tests 001-004, 006-015 - Hex colors (primary as #007bff)
      // Group 2: Test 005 - HSL format (primary as hsl() - CONFLICTING value)

      // Group 1: Comprehensive setup with hex-based colors
      await test.step('Setup: Start server with comprehensive hex-based color configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          theme: {
            colors: {
              // 001: 6-digit hex colors (primary, secondary)
              primary: '#007bff',
              secondary: '#6c757d',
              // 002: 8-digit hex with opacity
              'primary-transparent': '#007bff80',
              // 003: rgb format (using danger-rgb to not conflict)
              'danger-rgb': 'rgb(255, 0, 0)',
              // 004: rgba format
              'danger-semi': 'rgba(255, 0, 0, 0.5)',
              // 006: hsla format
              'primary-overlay': 'hsla(210, 100%, 50%, 0.8)',
              // 007: color variants
              'primary-hover': '#0056b3',
              'primary-light': '#e7f1ff',
              'primary-dark': '#003d7a',
              // 008: numbered gray scale
              'gray-100': '#f8f9fa',
              'gray-300': '#dee2e6',
              'gray-500': '#adb5bd',
              'gray-700': '#495057',
              'gray-900': '#212529',
              // 009: comprehensive semantic colors
              success: '#28a745',
              danger: '#dc3545',
              warning: '#ffc107',
              info: '#17a2b8',
              light: '#f8f9fa',
              dark: '#343a40',
              // 010: kebab-case naming
              'text-primary': '#212529',
              'background-light': '#f8f9fa',
              'border-subtle': '#dee2e6',
              // 013: text colors
              text: '#212529',
              'text-muted': '#6c757d',
              // 014: success variants
              'success-light': '#d4edda',
            },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              sections: [
                // 001: Primary color div
                {
                  type: 'div',
                  props: {
                    'data-testid': 'color-primary',
                    className: 'bg-primary text-secondary p-5',
                  },
                  children: ['Primary Color Text'],
                },
                // 002: Transparent color div
                {
                  type: 'div',
                  props: {
                    'data-testid': 'color-primary-transparent',
                    className: 'bg-primary-transparent p-10 relative',
                  },
                  children: ['Transparent Background (50% opacity)'],
                },
                // 003: RGB danger color div
                {
                  type: 'div',
                  props: {
                    'data-testid': 'color-danger-rgb',
                    className: 'bg-danger-rgb text-white p-5',
                  },
                  children: ['Danger Color (RGB format)'],
                },
                // 004: RGBA danger semi div
                {
                  type: 'div',
                  props: {
                    'data-testid': 'color-danger-semi',
                    className: 'bg-danger-semi text-white p-10',
                  },
                  children: ['Danger Semi-transparent (RGBA)'],
                },
                // 006: HSLA overlay div
                {
                  type: 'div',
                  props: {
                    'data-testid': 'color-primary-overlay',
                    className: 'bg-primary-overlay text-white p-10',
                  },
                  children: ['Primary Overlay (HSLA)'],
                },
                // 007: Color variants grid
                {
                  type: 'div',
                  props: {
                    'data-testid': 'color-variants',
                    className: 'grid grid-cols-4 gap-4',
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'bg-primary text-white p-5 text-center' },
                      children: ['Primary'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-primary-hover text-white p-5 text-center' },
                      children: ['Hover'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-primary-light text-black p-5 text-center' },
                      children: ['Light'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-primary-dark text-white p-5 text-center' },
                      children: ['Dark'],
                    },
                  ],
                },
                // 008: Gray scale grid
                {
                  type: 'div',
                  props: { 'data-testid': 'color-scale', className: 'grid grid-cols-5 gap-2' },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'bg-gray-100 text-black p-6 text-center' },
                      children: ['100'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-gray-500 text-white p-6 text-center' },
                      children: ['500'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-gray-900 text-white p-6 text-center' },
                      children: ['900'],
                    },
                  ],
                },
                // 009: Semantic color system grid
                {
                  type: 'div',
                  props: { 'data-testid': 'color-system', className: 'grid grid-cols-4 gap-3' },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'bg-primary text-white p-5 text-center' },
                      children: ['Primary'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-success text-white p-5 text-center' },
                      children: ['Success'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-danger text-white p-5 text-center' },
                      children: ['Danger'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-dark text-white p-5 text-center' },
                      children: ['Dark'],
                    },
                  ],
                },
                // 010: Kebab-case naming grid
                {
                  type: 'div',
                  props: {
                    'data-testid': 'kebab-case-colors',
                    className: 'grid grid-cols-3 gap-3',
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'text-text-primary p-5 text-center' },
                      children: ['text-primary'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-background-light p-5 text-center' },
                      children: ['background-light'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-primary text-white p-5 text-center' },
                      children: ['primary'],
                    },
                  ],
                },
                // 011: Button with primary background
                { type: 'button', content: 'Click me', props: { 'data-testid': 'cta-button' } },
                // 012: Button for hover test
                { type: 'button', content: 'Hover me', props: { 'data-testid': 'hover-button' } },
                // 013: Heading with text color
                { type: 'heading', content: 'Page Title' },
                // 014: Success alert
                {
                  type: 'alert',
                  content: 'Success!',
                  props: { 'data-testid': 'alert-success', variant: 'success' },
                },
                // 015: Visual hierarchy
                {
                  type: 'div',
                  props: { 'data-testid': 'page-background', className: 'bg-gray-100 p-5' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        'data-testid': 'card',
                        className: 'bg-white border border-gray-300 p-4',
                      },
                      children: [
                        {
                          type: 'heading',
                          content: 'Main Heading',
                          props: { 'data-testid': 'heading', className: 'text-gray-900' },
                        },
                        {
                          type: 'span',
                          children: ['Placeholder text'],
                          props: { 'data-testid': 'placeholder', className: 'text-gray-500' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-THEME-COLORS-001: Validate 6-digit hex colors at build time', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--color-primary: #007bff')
        expect(css).toContain('--color-secondary: #6c757d')
        await expect(page.locator('[data-testid="color-primary"]')).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-002: Validate 8-digit hex colors with opacity', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--color-primary-transparent: #007bff80')
        await expect(page.locator('[data-testid="color-primary-transparent"]')).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-003: Validate rgb color format', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--color-danger-rgb: rgb(255, 0, 0)')
        await expect(page.locator('[data-testid="color-danger-rgb"]')).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-004: Validate rgba color format with alpha', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--color-danger-semi: rgba(255, 0, 0, 0.5)')
        await expect(page.locator('[data-testid="color-danger-semi"]')).toBeVisible()
      })

      // Group 2: HSL format requires separate server setup (conflicts with hex primary)
      await test.step('Setup: Start server with HSL color format configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          theme: {
            colors: {
              primary: 'hsl(210, 100%, 50%)',
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
                    'data-testid': 'color-primary-hsl',
                    className: 'bg-primary text-white p-5',
                  },
                  children: ['Primary Color (HSL format)'],
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-THEME-COLORS-005: Validate hsl color format', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--color-primary: hsl(210, 100%, 50%)')
        await expect(page.locator('[data-testid="color-primary-hsl"]')).toBeVisible()
      })

      // Continue with Group 1 server setup (restore hex-based primary)
      await test.step('Setup: Restore hex-based color configuration for remaining tests', async () => {
        await startServerWithSchema({
          name: 'test-app',
          theme: {
            colors: {
              primary: '#007bff',
              secondary: '#6c757d',
              'primary-transparent': '#007bff80',
              'primary-overlay': 'hsla(210, 100%, 50%, 0.8)',
              'primary-hover': '#0056b3',
              'primary-light': '#e7f1ff',
              'primary-dark': '#003d7a',
              'gray-100': '#f8f9fa',
              'gray-300': '#dee2e6',
              'gray-500': '#adb5bd',
              'gray-700': '#495057',
              'gray-900': '#212529',
              success: '#28a745',
              danger: '#dc3545',
              warning: '#ffc107',
              info: '#17a2b8',
              light: '#f8f9fa',
              dark: '#343a40',
              'text-primary': '#212529',
              'background-light': '#f8f9fa',
              'border-subtle': '#dee2e6',
              text: '#212529',
              'text-muted': '#6c757d',
              'success-light': '#d4edda',
            },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              sections: [
                // 006: HSLA overlay div
                {
                  type: 'div',
                  props: {
                    'data-testid': 'color-primary-overlay',
                    className: 'bg-primary-overlay text-white p-10',
                  },
                  children: ['Primary Overlay (HSLA)'],
                },
                // 007: Color variants grid
                {
                  type: 'div',
                  props: {
                    'data-testid': 'color-variants',
                    className: 'grid grid-cols-4 gap-4',
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'bg-primary text-white p-5 text-center' },
                      children: ['Primary'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-primary-hover text-white p-5 text-center' },
                      children: ['Hover'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-primary-light text-black p-5 text-center' },
                      children: ['Light'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-primary-dark text-white p-5 text-center' },
                      children: ['Dark'],
                    },
                  ],
                },
                // 008: Gray scale grid
                {
                  type: 'div',
                  props: { 'data-testid': 'color-scale', className: 'grid grid-cols-5 gap-2' },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'bg-gray-100 text-black p-6 text-center' },
                      children: ['100'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-gray-500 text-white p-6 text-center' },
                      children: ['500'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-gray-900 text-white p-6 text-center' },
                      children: ['900'],
                    },
                  ],
                },
                // 009: Semantic color system grid
                {
                  type: 'div',
                  props: { 'data-testid': 'color-system', className: 'grid grid-cols-4 gap-3' },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'bg-primary text-white p-5 text-center' },
                      children: ['Primary'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-success text-white p-5 text-center' },
                      children: ['Success'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-danger text-white p-5 text-center' },
                      children: ['Danger'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-dark text-white p-5 text-center' },
                      children: ['Dark'],
                    },
                  ],
                },
                // 010: Kebab-case naming grid
                {
                  type: 'div',
                  props: {
                    'data-testid': 'kebab-case-colors',
                    className: 'grid grid-cols-3 gap-3',
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'text-text-primary p-5 text-center' },
                      children: ['text-primary'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-background-light p-5 text-center' },
                      children: ['background-light'],
                    },
                    {
                      type: 'div',
                      props: { className: 'bg-primary text-white p-5 text-center' },
                      children: ['primary'],
                    },
                  ],
                },
                // 011: Button with primary background
                { type: 'button', content: 'Click me', props: { 'data-testid': 'cta-button' } },
                // 012: Button for hover test
                { type: 'button', content: 'Hover me', props: { 'data-testid': 'hover-button' } },
                // 013: Heading with text color
                { type: 'heading', content: 'Page Title' },
                // 014: Success alert
                {
                  type: 'alert',
                  content: 'Success!',
                  props: { 'data-testid': 'alert-success', variant: 'success' },
                },
                // 015: Visual hierarchy
                {
                  type: 'div',
                  props: { 'data-testid': 'page-background', className: 'bg-gray-100 p-5' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        'data-testid': 'card',
                        className: 'bg-white border border-gray-300 p-4',
                      },
                      children: [
                        {
                          type: 'heading',
                          content: 'Main Heading',
                          props: { 'data-testid': 'heading', className: 'text-gray-900' },
                        },
                        {
                          type: 'span',
                          children: ['Placeholder text'],
                          props: { 'data-testid': 'placeholder', className: 'text-gray-500' },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-THEME-COLORS-006: Validate hsla color format with alpha', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--color-primary-overlay: hsla(210, 100%, 50%, 0.8)')
        await expect(page.locator('[data-testid="color-primary-overlay"]')).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-007: Validate color variants for hover states', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--color-primary: #007bff')
        expect(css).toContain('--color-primary-hover: #0056b3')
        expect(css).toContain('--color-primary-light: #e7f1ff')
        expect(css).toContain('--color-primary-dark: #003d7a')
        await expect(page.locator('[data-testid="color-variants"]')).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-008: Validate numbered color scales', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--color-gray-100: #f8f9fa')
        expect(css).toContain('--color-gray-500: #adb5bd')
        expect(css).toContain('--color-gray-900: #212529')
        await expect(page.locator('[data-testid="color-scale"]')).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-009: Validate comprehensive color system', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--color-primary: #007bff')
        expect(css).toContain('--color-success: #28a745')
        expect(css).toContain('--color-danger: #dc3545')
        expect(css).toContain('--color-dark: #343a40')
        await expect(page.locator('[data-testid="color-system"]')).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-010: Validate kebab-case naming convention', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--color-primary: #007bff')
        expect(css).toContain('--color-text-primary: #212529')
        expect(css).toContain('--color-background-light: #f8f9fa')
        expect(css).toContain('--color-border-subtle: #dee2e6')
        await expect(page.locator('[data-testid="kebab-case-colors"]')).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-011: Render button with primary background', async () => {
        const button = page.locator('[data-testid="cta-button"]')
        await expect(button).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-012: Render darker blue on hover', async () => {
        const button = page.locator('[data-testid="hover-button"]')
        await button.hover()
        await expect(button).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-013: Render text with theme text color', async () => {
        const heading = page.locator('h1').first()
        await expect(heading).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-014: Render green alert indicating success', async () => {
        const alert = page.locator('[data-testid="alert-success"]')
        await expect(alert).toBeVisible()
      })

      await test.step('APP-THEME-COLORS-015: Create visual hierarchy through tonal variation', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--color-gray-100: #f8f9fa')
        expect(css).toContain('--color-gray-300: #dee2e6')
        expect(css).toContain('--color-gray-500: #adb5bd')
        expect(css).toContain('--color-gray-900: #212529')
        await expect(page.locator('[data-testid="page-background"]')).toBeVisible()
        await expect(page.locator('[data-testid="card"]')).toBeVisible()
      })
    }
  )
})
