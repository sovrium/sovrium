/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Shadows
 *
 * Source: src/domain/models/app/theme/index.ts
 * Spec Count: 16 (16 @spec + 1 @regression)
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (16 tests: 6 validation + 10 application) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Shadows', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-THEME-SHADOWS-001: should validate elevation system from subtle to dramatic',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: shadow scale from sm to 2xl
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
            '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
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
                  'data-testid': 'shadow-sm',
                  className: 'shadow-sm w-[50px] h-[50px] bg-white',
                },
              },
              {
                type: 'div',
                props: {
                  'data-testid': 'shadow-2xl',
                  className: 'shadow-2xl w-[50px] h-[50px] bg-white',
                },
              },
            ],
          },
        ],
      })

      // WHEN: shadows increase in depth and blur
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow definitions
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)')
      expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
      expect(css).toContain('--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)')
      expect(css).toContain('--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1)')
      expect(css).toContain('--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25)')

      // 2. Visual validation captures shadow rendering
      // THEN: assertion
      await expect(page.locator('[data-testid="shadow-sm"]')).toBeVisible()
      await expect(page.locator('[data-testid="shadow-2xl"]')).toBeVisible()

      // 3. Verify computed box shadows
      const sm = page.locator('[data-testid="shadow-sm"]')
      const xl2 = page.locator('[data-testid="shadow-2xl"]')
      const smShadow = await sm.evaluate((el) => window.getComputedStyle(el).boxShadow)
      const xl2Shadow = await xl2.evaluate((el) => window.getComputedStyle(el).boxShadow)
      // THEN: assertion
      expect(smShadow).not.toBe('none')
      expect(xl2Shadow).not.toBe('none')
    }
  )

  test(
    'APP-THEME-SHADOWS-002: should validate rgb(0 0 0 / 0.1) format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: shadow with rgb color and opacity
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
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
                  'data-testid': 'shadow-md',
                  className: 'shadow-md w-[100px] h-[100px] bg-white',
                },
              },
            ],
          },
        ],
      })

      // WHEN: shadow uses modern CSS color syntax
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow with rgb format
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')

      // 2. Visual validation captures shadow rendering
      const element = page.locator('[data-testid="shadow-md"]')
      await expect(element).toHaveScreenshot('shadow-002-rgb-format.png')

      // 3. Verify computed box shadow
      const boxShadow = await element.evaluate((el) => window.getComputedStyle(el).boxShadow)
      // THEN: assertion
      expect(boxShadow).toContain('rgba(0, 0, 0, 0.1)')
    }
  )

  test(
    'APP-THEME-SHADOWS-003: should validate inset box-shadow',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: inner shadow for inset effects
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
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
                  'data-testid': 'shadow-inner',
                  className: 'shadow-inner w-[50px] h-[50px] bg-white',
                },
              },
            ],
          },
        ],
      })

      // WHEN: shadow creates depth inside element
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains inset shadow
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05)')

      // 2. Visual validation captures inset shadow
      const element = page.locator('[data-testid="shadow-inner"]')
      await expect(element).toHaveScreenshot('shadow-003-inset-box-shadow.png')

      // 3. Verify computed box shadow contains inset
      const boxShadow = await element.evaluate((el) => window.getComputedStyle(el).boxShadow)
      // THEN: assertion
      expect(boxShadow).toContain('inset')
    }
  )

  test(
    'APP-THEME-SHADOWS-004: should validate shadow removal',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: shadow 'none' to remove shadows
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            none: '0 0 #0000',
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
                  'data-testid': 'shadow-none',
                  className: 'shadow-none w-[50px] h-[50px] bg-white border border-gray-300',
                },
              },
            ],
          },
        ],
      })

      // WHEN: flat design with no elevation is needed
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow removal
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-none: 0 0 #0000')

      // 2. Visual validation captures no shadow
      const element = page.locator('[data-testid="shadow-none"]')
      await expect(element).toHaveScreenshot('shadow-004-none.png')

      // 3. Verify computed box shadow is none
      const boxShadow = await element.evaluate((el) => window.getComputedStyle(el).boxShadow)
      // THEN: assertion
      expect(boxShadow).toBe('none')
    }
  )

  test(
    'APP-THEME-SHADOWS-005: should validate kebab-case convention',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: shadows with kebab-case naming
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            'drop-shadow': '0 4px 6px rgb(0 0 0 / 0.1)',
            'card-shadow': '0 2px 4px rgb(0 0 0 / 0.05)',
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
                  'data-testid': 'shadow-drop-shadow',
                  className: 'shadow-drop-shadow w-[50px] h-[50px] bg-white',
                },
              },
              {
                type: 'div',
                props: {
                  'data-testid': 'shadow-card-shadow',
                  className: 'shadow-card-shadow w-[50px] h-[50px] bg-white',
                },
              },
            ],
          },
        ],
      })

      // WHEN: shadow uses multi-word names
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains kebab-case shadow definitions
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-drop-shadow: 0 4px 6px rgb(0 0 0 / 0.1)')
      expect(css).toContain('--shadow-card-shadow: 0 2px 4px rgb(0 0 0 / 0.05)')

      // 2. Visual validation captures shadow rendering
      // THEN: assertion
      await expect(page.locator('[data-testid="shadow-drop-shadow"]')).toBeVisible()
      await expect(page.locator('[data-testid="shadow-card-shadow"]')).toBeVisible()

      // 3. Verify computed box shadows
      const dropShadow = page.locator('[data-testid="shadow-drop-shadow"]')
      const cardShadow = page.locator('[data-testid="shadow-card-shadow"]')
      const dropShadowBox = await dropShadow.evaluate((el) => window.getComputedStyle(el).boxShadow)
      const cardShadowBox = await cardShadow.evaluate((el) => window.getComputedStyle(el).boxShadow)
      // THEN: assertion
      expect(dropShadowBox).not.toBe('none')
      expect(cardShadowBox).not.toBe('none')
    }
  )

  test(
    'APP-THEME-SHADOWS-006: should validate complete shadow system',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: complete shadow system (sm, md, lg, xl, 2xl, inner, none)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            sm: '0 1px 2px',
            md: '0 4px 6px',
            lg: '0 10px 15px',
            xl: '0 20px 25px',
            '2xl': '0 25px 50px',
            inner: 'inset 0 2px 4px',
            none: '0 0 #0000',
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
                  'data-testid': 'shadow-sm',
                  className: 'shadow-sm w-[50px] h-[50px] bg-white',
                },
              },
              {
                type: 'div',
                props: {
                  'data-testid': 'shadow-none',
                  className: 'shadow-none w-[50px] h-[50px] bg-white border border-gray-300',
                },
              },
            ],
          },
        ],
      })

      // WHEN: all elevation tokens are defined
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains all shadow definitions
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-sm: 0 1px 2px')
      expect(css).toContain('--shadow-md: 0 4px 6px')
      expect(css).toContain('--shadow-lg: 0 10px 15px')
      expect(css).toContain('--shadow-xl: 0 20px 25px')
      expect(css).toContain('--shadow-2xl: 0 25px 50px')
      expect(css).toContain('--shadow-inner: inset 0 2px 4px')
      expect(css).toContain('--shadow-none: 0 0 #0000')

      // 2. Visual validation captures shadow rendering
      // THEN: assertion
      await expect(page.locator('[data-testid="shadow-sm"]')).toBeVisible()
      await expect(page.locator('[data-testid="shadow-none"]')).toBeVisible()

      // 3. Verify computed box shadows
      const sm = page.locator('[data-testid="shadow-sm"]')
      const none = page.locator('[data-testid="shadow-none"]')
      const smShadow = await sm.evaluate((el) => window.getComputedStyle(el).boxShadow)
      const noneShadow = await none.evaluate((el) => window.getComputedStyle(el).boxShadow)
      // THEN: assertion
      expect(smShadow).not.toBe('none')
      expect(noneShadow).toBe('none')
    }
  )

  test(
    'APP-THEME-SHADOWS-007: should render card with medium box-shadow creating depth',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: md shadow applied to card component
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'card',
                content: 'Card content',
                props: {
                  'data-testid': 'product-card',
                },
              },
            ],
          },
        ],
      })

      // WHEN: card uses theme.shadows.md for moderate elevation
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow definition
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')

      // 2. Visual validation captures card with shadow depth
      const card = page.locator('[data-testid="product-card"]')
      await expect(card).toHaveScreenshot('shadow-app-001-card-depth.png')
    }
  )

  test(
    'APP-THEME-SHADOWS-008: should render modal with dramatic shadow emphasizing importance',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: xl shadow applied to modal overlay
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'modal',
                content: 'Modal content',
                props: {
                  'data-testid': 'confirmation-modal',
                },
              },
            ],
          },
        ],
      })

      // WHEN: modal uses theme.shadows.xl for high elevation above content
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow definition
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1)')

      // 2. Visual validation captures modal with dramatic shadow
      const modal = page.locator('[data-testid="confirmation-modal"]')
      await expect(modal).toHaveScreenshot('shadow-app-002-modal-dramatic.png')
    }
  )

  test(
    'APP-THEME-SHADOWS-009: should render input with inset shadow creating depth inward',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: inner shadow applied to input field
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'input',
                props: {
                  'data-testid': 'text-input',
                },
              },
            ],
          },
        ],
      })

      // WHEN: input uses theme.shadows.inner for recessed appearance
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow definition
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05)')

      // 2. Visual validation captures input with inset shadow
      const input = page.locator('[data-testid="text-input"]')
      await expect(input).toHaveScreenshot('shadow-app-003-input-inset.png')
    }
  )

  test(
    'APP-THEME-SHADOWS-010: should render button with smooth shadow transition creating lift effect',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: shadow transition on button hover interaction
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
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
                props: {
                  'data-testid': 'elevated-button',
                },
              },
            ],
          },
        ],
      })

      // WHEN: button hover state increases shadow elevation from md to lg
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow definitions
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
      expect(css).toContain('--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)')

      // 2. Visual validation captures button hover with lift effect
      const button = page.locator('[data-testid="elevated-button"]')
      await button.hover()
      await expect(button).toHaveScreenshot('shadow-app-004-button-lift.png')
    }
  )

  test(
    'APP-THEME-SHADOWS-011: should render button with colored shadow matching brand identity',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: colored shadow for brand accent
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            brand: '0 4px 14px 0 rgb(59 130 246 / 0.4)',
          },
          colors: {
            primary: '#3b82f6',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'button',
                content: 'Get Started',
                props: {
                  'data-testid': 'brand-button',
                },
              },
            ],
          },
        ],
      })

      // WHEN: button uses custom shadow with brand color tint
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow definition
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-brand: 0 4px 14px 0 rgb(59 130 246 / 0.4)')

      // 2. Visual validation captures button with brand colored shadow
      const button = page.locator('[data-testid="brand-button"]')
      await expect(button).toHaveScreenshot('shadow-app-005-brand-colored.png')
    }
  )

  test(
    'APP-THEME-SHADOWS-012: should render element with multi-layered shadow creating subtle 3D effect',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: layered shadows for enhanced depth (neumorphism)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            neumorphic: '8px 8px 16px rgb(0 0 0 / 0.1), -8px -8px 16px rgb(255 255 255 / 0.5)',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'card',
                content: 'Neumorphic design',
                props: {
                  'data-testid': 'neumorphic-card',
                },
              },
            ],
          },
        ],
      })

      // WHEN: element combines multiple shadow values for soft depth
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow definition
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain(
        '--shadow-neumorphic: 8px 8px 16px rgb(0 0 0 / 0.1), -8px -8px 16px rgb(255 255 255 / 0.5)'
      )

      // 2. Visual validation captures card with neumorphic shadow
      const card = page.locator('[data-testid="neumorphic-card"]')
      await expect(card).toHaveScreenshot('shadow-app-006-neumorphic.png')
    }
  )

  test(
    'APP-THEME-SHADOWS-013: should render input with prominent focus shadow for keyboard navigation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: focus ring shadow for accessibility
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            focus: '0 0 0 3px rgb(59 130 246 / 0.5)',
          },
          colors: {
            primary: '#3b82f6',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'input',
                props: {
                  'data-testid': 'text-input',
                  type: 'single-line-text',
                },
              },
            ],
          },
        ],
      })

      // WHEN: input focus state combines border and shadow for clear focus indicator
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow definition
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-focus: 0 0 0 3px rgb(59 130 246 / 0.5)')

      // 2. Visual validation captures input with focus ring shadow
      const input = page.locator('[data-testid="text-input"]')
      await input.focus()
      await expect(input).toHaveScreenshot('shadow-app-007-focus-ring.png')
    }
  )

  test(
    'APP-THEME-SHADOWS-014: should render card with appropriate shadow depth per device',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: responsive shadow scaling for mobile vs desktop
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'card',
                content: 'Card content',
                props: {
                  'data-testid': 'responsive-card',
                },
              },
            ],
          },
        ],
      })

      // WHEN: card uses larger shadow on desktop, smaller on mobile for touch interfaces
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow definitions
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)')
      expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')

      // 2. Visual validation captures card with responsive shadow
      const card = page.locator('[data-testid="responsive-card"]')
      await expect(card).toHaveScreenshot('shadow-app-008-responsive.png')
    }
  )

  test(
    'APP-THEME-SHADOWS-015: should render components with consistent elevation scale',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: shadow elevation hierarchy in component system
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
            xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
            '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'list-item',
                content: 'Item',
                props: {
                  'data-testid': 'list-item',
                },
              },
              {
                type: 'card',
                content: 'Card',
                props: {
                  'data-testid': 'card',
                },
              },
              {
                type: 'dropdown',
                content: 'Menu',
                props: {
                  'data-testid': 'dropdown',
                },
              },
              {
                type: 'modal',
                content: 'Modal',
                props: {
                  'data-testid': 'modal',
                },
              },
            ],
          },
        ],
      })

      // WHEN: app uses shadows to convey information hierarchy (sm→md→lg→xl→2xl)
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains all shadow definitions
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)')
      expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
      expect(css).toContain('--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)')
      expect(css).toContain('--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1)')
      expect(css).toContain('--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25)')

      // 2. Visual validation captures components with elevation hierarchy
      // THEN: assertion
      await expect(page.locator('[data-testid="list-item"]')).toBeVisible()
      await expect(page.locator('[data-testid="card"]')).toBeVisible()
      await expect(page.locator('[data-testid="dropdown"]')).toBeVisible()
      await expect(page.locator('[data-testid="modal"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-SHADOWS-016: should render button with reduced shadow creating pressed-in effect',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: active/pressed shadow state for buttons
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          shadows: {
            md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'button',
                content: 'Press me',
                props: {
                  'data-testid': 'pressable-button',
                },
              },
            ],
          },
        ],
      })

      // WHEN: button active state reduces shadow to simulate press depth
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains shadow definitions
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
      expect(css).toContain('--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)')

      // 2. Visual validation captures button pressed state
      const button = page.locator('[data-testid="pressable-button"]')
      await button.click()
      await expect(button).toHaveScreenshot('shadow-app-010-pressed.png')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 16 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-THEME-SHADOWS-REGRESSION: user can complete full shadows workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // OPTIMIZATION: Consolidated from 16 startServerWithSchema calls to 1
      // All shadow names are unique and can be combined: sm, md, lg, xl, 2xl, inner, none,
      // drop-shadow, card-shadow, brand, neumorphic, focus

      await test.step('Setup: Start server with comprehensive shadow configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          theme: {
            shadows: {
              // Standard elevation scale (tests 001, 006, 014, 015, 016)
              sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
              '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
              // Inset shadow (tests 003, 009)
              inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
              // No shadow (test 004)
              none: '0 0 #0000',
              // Kebab-case shadows (test 005)
              'drop-shadow': '0 4px 6px rgb(0 0 0 / 0.1)',
              'card-shadow': '0 2px 4px rgb(0 0 0 / 0.05)',
              // Brand shadow (test 011)
              brand: '0 4px 14px 0 rgb(59 130 246 / 0.4)',
              // Neumorphic shadow (test 012)
              neumorphic: '8px 8px 16px rgb(0 0 0 / 0.1), -8px -8px 16px rgb(255 255 255 / 0.5)',
              // Focus shadow (test 013)
              focus: '0 0 0 3px rgb(59 130 246 / 0.5)',
            },
            colors: {
              primary: '#3b82f6',
            },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              sections: [
                // Elevation scale elements (tests 001, 006, 015)
                {
                  type: 'div',
                  props: {
                    'data-testid': 'shadow-sm',
                    className: 'shadow-sm w-[50px] h-[50px] bg-white',
                  },
                },
                {
                  type: 'div',
                  props: {
                    'data-testid': 'shadow-md',
                    className: 'shadow-md w-[100px] h-[100px] bg-white',
                  },
                },
                {
                  type: 'div',
                  props: {
                    'data-testid': 'shadow-2xl',
                    className: 'shadow-2xl w-[50px] h-[50px] bg-white',
                  },
                },
                // Inset shadow (test 003)
                {
                  type: 'div',
                  props: {
                    'data-testid': 'shadow-inner',
                    className: 'shadow-inner w-[50px] h-[50px] bg-white',
                  },
                },
                // No shadow (test 004)
                {
                  type: 'div',
                  props: {
                    'data-testid': 'shadow-none',
                    className: 'shadow-none w-[50px] h-[50px] bg-white border border-gray-300',
                  },
                },
                // Kebab-case shadows (test 005)
                {
                  type: 'div',
                  props: {
                    'data-testid': 'shadow-drop-shadow',
                    className: 'shadow-drop-shadow w-[50px] h-[50px] bg-white',
                  },
                },
                {
                  type: 'div',
                  props: {
                    'data-testid': 'shadow-card-shadow',
                    className: 'shadow-card-shadow w-[50px] h-[50px] bg-white',
                  },
                },
                // Card components (tests 007, 012, 014)
                {
                  type: 'card',
                  content: 'Card content',
                  props: { 'data-testid': 'product-card' },
                },
                {
                  type: 'card',
                  content: 'Neumorphic design',
                  props: { 'data-testid': 'neumorphic-card' },
                },
                {
                  type: 'card',
                  content: 'Card content',
                  props: { 'data-testid': 'responsive-card' },
                },
                // Modal (test 008)
                {
                  type: 'modal',
                  content: 'Modal content',
                  props: { 'data-testid': 'confirmation-modal' },
                },
                // Input elements (tests 009, 013)
                {
                  type: 'input',
                  props: { 'data-testid': 'text-input', type: 'single-line-text' },
                },
                // Button elements (tests 010, 011, 016)
                {
                  type: 'button',
                  content: 'Hover me',
                  props: { 'data-testid': 'elevated-button' },
                },
                {
                  type: 'button',
                  content: 'Get Started',
                  props: { 'data-testid': 'brand-button' },
                },
                {
                  type: 'button',
                  content: 'Press me',
                  props: { 'data-testid': 'pressable-button' },
                },
                // Elevation hierarchy components (test 015)
                {
                  type: 'list-item',
                  content: 'Item',
                  props: { 'data-testid': 'list-item' },
                },
                {
                  type: 'card',
                  content: 'Card',
                  props: { 'data-testid': 'card' },
                },
                {
                  type: 'dropdown',
                  content: 'Menu',
                  props: { 'data-testid': 'dropdown' },
                },
                {
                  type: 'modal',
                  content: 'Modal',
                  props: { 'data-testid': 'modal' },
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-THEME-SHADOWS-001: Validate elevation system from subtle to dramatic', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)')
        expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25)')
        await expect(page.locator('[data-testid="shadow-sm"]')).toBeVisible()
        await expect(page.locator('[data-testid="shadow-2xl"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-002: Validate rgb(0 0 0 / 0.1) format', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
        await expect(page.locator('[data-testid="shadow-md"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-003: Validate inset box-shadow', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05)')
        await expect(page.locator('[data-testid="shadow-inner"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-004: Validate shadow removal', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-none: 0 0 #0000')
        await expect(page.locator('[data-testid="shadow-none"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-005: Validate kebab-case convention', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-drop-shadow: 0 4px 6px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-card-shadow: 0 2px 4px rgb(0 0 0 / 0.05)')
        await expect(page.locator('[data-testid="shadow-drop-shadow"]')).toBeVisible()
        await expect(page.locator('[data-testid="shadow-card-shadow"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-006: Validate complete shadow system', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)')
        expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25)')
        expect(css).toContain('--shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05)')
        expect(css).toContain('--shadow-none: 0 0 #0000')
        await expect(page.locator('[data-testid="shadow-sm"]')).toBeVisible()
        await expect(page.locator('[data-testid="shadow-none"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-007: Render card with medium box-shadow creating depth', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
        await expect(page.locator('[data-testid="product-card"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-008: Render modal with dramatic shadow', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1)')
        await expect(page.locator('[data-testid="confirmation-modal"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-009: Render input with inset shadow', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-inner: inset 0 2px 4px 0 rgb(0 0 0 / 0.05)')
        await expect(page.locator('[data-testid="text-input"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-010: Render button with smooth shadow transition', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)')
        await expect(page.locator('[data-testid="elevated-button"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-011: Render button with colored shadow', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-brand: 0 4px 14px 0 rgb(59 130 246 / 0.4)')
        await expect(page.locator('[data-testid="brand-button"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-012: Render element with multi-layered shadow', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain(
          '--shadow-neumorphic: 8px 8px 16px rgb(0 0 0 / 0.1), -8px -8px 16px rgb(255 255 255 / 0.5)'
        )
        await expect(page.locator('[data-testid="neumorphic-card"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-013: Render input with prominent focus shadow', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-focus: 0 0 0 3px rgb(59 130 246 / 0.5)')
        await expect(page.locator('[data-testid="text-input"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-014: Render card with appropriate shadow depth', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)')
        expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
        await expect(page.locator('[data-testid="responsive-card"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-015: Render components with consistent elevation scale', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)')
        expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25)')
        await expect(page.locator('[data-testid="list-item"]')).toBeVisible()
        await expect(page.locator('[data-testid="card"]')).toBeVisible()
        await expect(page.locator('[data-testid="dropdown"]')).toBeVisible()
        await expect(page.locator('[data-testid="modal"]')).toBeVisible()
      })

      await test.step('APP-THEME-SHADOWS-016: Render button with reduced shadow', async () => {
        const cssResponse = await page.request.get('/assets/output.css')
        expect(cssResponse.ok()).toBeTruthy()
        const css = await cssResponse.text()
        expect(css).toContain('--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)')
        expect(css).toContain('--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)')
        await expect(page.locator('[data-testid="pressable-button"]')).toBeVisible()
      })
    }
  )
})
