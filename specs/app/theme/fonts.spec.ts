/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Font Configuration
 *
 * Source: specs/app/theme/fonts/fonts.schema.json
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Font Configuration', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-THEME-FONTS-001: should validate font family as the only required property',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a font with only family defined
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            body: {
              family: 'Inter',
            },
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

      // WHEN: font uses minimal configuration
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains font family
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-body: Inter')

      // 2. Visual validation captures font rendering
      const body = page.locator('body')
      await expect(body).toHaveScreenshot('font-001-family-required.png')

      // 3. Verify base layer applies font-sans to body
      const fontFamily = await body.evaluate((el) => window.getComputedStyle(el).fontFamily)
      // THEN: assertion
      expect(fontFamily).toContain('Inter')
    }
  )

  test(
    'APP-THEME-FONTS-002: should validate graceful fallback for missing fonts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a font with family and fallback stack
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            body: {
              family: 'Inter',
              fallback: 'system-ui, sans-serif',
            },
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

      // WHEN: font includes fallback fonts (e.g., 'Inter', 'system-ui, sans-serif')
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains font family with fallback
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-body: Inter, system-ui, sans-serif')

      // 2. Visual validation captures font rendering
      const body = page.locator('body')
      await expect(body).toHaveScreenshot('font-002-fallback.png')

      // 3. Verify computed font stack includes fallback
      const fontFamily = await body.evaluate((el) => window.getComputedStyle(el).fontFamily)
      // THEN: assertion
      expect(fontFamily).toMatch(/Inter|system-ui|sans-serif/)
    }
  )

  test(
    'APP-THEME-FONTS-003: should validate weight values from 100-900 in increments of 100',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a font with multiple weights [300, 400, 500, 600, 700]
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            body: {
              family: 'Inter',
              fallback: 'sans-serif',
              weights: [300, 400, 500, 600, 700],
            },
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
                  'data-testid': 'font-weights',
                  className: 'flex flex-col gap-4 p-5',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      className: 'font-body font-light text-lg',
                    },
                    children: ['Font Weight 300 - Light'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'font-body font-normal text-lg',
                    },
                    children: ['Font Weight 400 - Regular'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'font-body font-medium text-lg',
                    },
                    children: ['Font Weight 500 - Medium'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'font-body font-semibold text-lg',
                    },
                    children: ['Font Weight 600 - Semibold'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'font-body font-bold text-lg',
                    },
                    children: ['Font Weight 700 - Bold'],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: font supports various weight options
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains font family
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-body: Inter, sans-serif')

      // 2. Visual validation shows weight progression
      await expect(page.locator('[data-testid="font-weights"]')).toHaveScreenshot(
        'font-003-weights.png',
        {
          animations: 'disabled',
        }
      )

      // 3. Verify computed font weights
      const light = page.locator('[data-testid="font-weights"] > div').nth(0)
      const bold = page.locator('[data-testid="font-weights"] > div').nth(4)
      const lightWeight = await light.evaluate((el) => window.getComputedStyle(el).fontWeight)
      const boldWeight = await bold.evaluate((el) => window.getComputedStyle(el).fontWeight)
      // THEN: assertion
      expect(lightWeight).toBe('300')
      expect(boldWeight).toBe('700')
    }
  )

  test(
    'APP-THEME-FONTS-004: should validate normal, italic, or oblique styles',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a font with style set to 'italic'
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            title: {
              family: 'Georgia',
              style: 'italic',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'h1',
                props: {},
                children: ['Italic Heading'],
              },
            ],
          },
        ],
      })

      // WHEN: font uses italic style
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains font family
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-title: Georgia')

      // 2. Visual validation captures italic style
      const heading = page.locator('h1')
      await expect(heading).toHaveScreenshot('font-004-italic-style.png')

      // 3. Verify computed font style
      const fontStyle = await heading.evaluate((el) => window.getComputedStyle(el).fontStyle)
      // THEN: assertion
      expect(fontStyle).toBe('italic')
    }
  )

  test(
    'APP-THEME-FONTS-005: should validate typography metrics for body text',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a font with size '16px' and lineHeight '1.5'
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            body: {
              family: 'Inter',
              size: '16px',
              lineHeight: '1.5',
            },
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

      // WHEN: font defines default size and line spacing
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains font definition
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-body: Inter')

      // 2. Visual validation captures typography metrics
      const body = page.locator('body')
      await expect(body).toHaveScreenshot('font-005-metrics.png')

      // 3. Verify computed font metrics
      const fontSize = await body.evaluate((el) => window.getComputedStyle(el).fontSize)
      const lineHeight = await body.evaluate((el) => window.getComputedStyle(el).lineHeight)
      // THEN: assertion
      expect(fontSize).toBe('16px')
      expect(lineHeight).toBe('24px') // 16px * 1.5 = 24px
    }
  )

  test(
    'APP-THEME-FONTS-006: should validate character spacing for readability',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a font with letterSpacing '0.05em'
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            title: {
              family: 'Bely Display',
              fallback: 'Georgia, serif',
              letterSpacing: '0.05em',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'h1',
                props: {},
                children: ['Display Heading'],
              },
            ],
          },
        ],
      })

      // WHEN: font includes letter spacing for display text
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains font definition
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-title: Bely Display, Georgia, serif')

      // 2. Visual validation captures letter spacing
      const heading = page.locator('h1')
      await expect(heading).toHaveScreenshot('font-006-letter-spacing.png')

      // 3. Verify computed letter spacing
      const letterSpacing = await heading.evaluate(
        (el) => window.getComputedStyle(el).letterSpacing
      )
      // THEN: assertion
      expect(letterSpacing).not.toBe('normal')
      expect(letterSpacing).not.toBe('0px')
    }
  )

  test(
    'APP-THEME-FONTS-007: should validate none, uppercase, lowercase, or capitalize',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a font with transform 'uppercase'
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            label: {
              family: 'Inter',
              fallback: 'sans-serif',
              transform: 'uppercase',
            },
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
                  'data-testid': 'label',
                  className: 'font-label text-sm p-2 uppercase',
                },
                children: ['Label Text'],
              },
            ],
          },
        ],
      })

      // WHEN: font uses text transformation
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains font definition
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-label: Inter, sans-serif')

      // 2. Visual validation captures text transform
      const label = page.locator('[data-testid="label"]')
      await expect(label).toHaveScreenshot('font-007-text-transform.png')

      // 3. Verify computed text transform
      const textTransform = await label.evaluate((el) => window.getComputedStyle(el).textTransform)
      // THEN: assertion
      expect(textTransform).toBe('uppercase')
    }
  )

  test(
    'APP-THEME-FONTS-008: should validate font URL for remote loading',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a font with Google Fonts URL
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            body: {
              family: 'Inter',
              url: 'https://fonts.googleapis.com/css2?family=Inter:wght@300..700',
            },
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

      // WHEN: font is loaded from external source
      await page.goto('/')

      // THEN: it should validate font URL for remote loading
      const linkTag = page.locator('link[href*="fonts.googleapis.com"]')
      await expect(linkTag).toHaveAttribute('rel', 'stylesheet')
    }
  )

  test(
    'APP-THEME-FONTS-009: should validate comprehensive typography settings',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a complete font config with all properties
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            body: {
              family: 'Inter',
              fallback: 'system-ui, sans-serif',
              weights: [400, 700],
              style: 'normal',
              size: '16px',
              lineHeight: '1.5',
              letterSpacing: '0',
              transform: 'none',
              url: 'https://fonts.googleapis.com/css2?family=Inter',
            },
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

      // WHEN: font is fully configured
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains font family with fallback
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-body: Inter, system-ui, sans-serif')

      // 2. Visual validation captures comprehensive typography
      const body = page.locator('body')
      await expect(body).toHaveScreenshot('font-009-comprehensive.png')

      // 3. Verify font URL is loaded
      const linkTag = page.locator('link[href*="fonts.googleapis.com"]')
      // THEN: assertion
      await expect(linkTag).toHaveAttribute('rel', 'stylesheet')
    }
  )

  test(
    'APP-THEME-FONTS-010: should validate semantic font system for all UI contexts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a theme with multiple font categories (title, body, mono)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            title: {
              family: 'Bely Display',
              fallback: 'Georgia, serif',
            },
            body: {
              family: 'Inter',
              fallback: 'system-ui, sans-serif',
            },
            mono: {
              family: 'JetBrains Mono',
              fallback: 'monospace',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'h1',
                props: {},
                children: ['Typography System'],
              },
              {
                type: 'paragraph',
                props: {},
                children: ['Body text using Inter font family'],
              },
            ],
          },
        ],
      })

      // WHEN: different fonts are defined for headings, body text, and code
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains all font categories
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-title: Bely Display, Georgia, serif')
      expect(css).toContain('--font-body: Inter, system-ui, sans-serif')
      expect(css).toContain('--font-mono: JetBrains Mono, monospace')

      // 2. Visual validation captures semantic font system
      const heading = page.locator('h1')
      const body = page.locator('body')
      await expect(heading).toHaveScreenshot('font-010-title.png')
      await expect(body).toHaveScreenshot('font-010-body.png')

      // 3. Verify computed font families for different contexts
      const headingFont = await heading.evaluate((el) => window.getComputedStyle(el).fontFamily)
      const bodyFont = await body.evaluate((el) => window.getComputedStyle(el).fontFamily)
      // THEN: assertion
      expect(headingFont).toMatch(/Bely Display|Georgia/)
      expect(bodyFont).toMatch(/Inter|system-ui/)
    }
  )

  test(
    'APP-THEME-FONTS-011: should render with body font family and metrics',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: body font applied to paragraph
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            body: {
              family: 'Inter',
              fallback: 'sans-serif',
              size: '16px',
              lineHeight: '1.5',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'paragraph',
                content: 'Body text',
              },
            ],
          },
        ],
      })

      // WHEN: paragraph uses theme.fonts.body
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains body font
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-body: Inter, sans-serif')

      // 2. Visual validation captures paragraph rendering
      const paragraph = page.locator('p')
      await expect(paragraph).toHaveScreenshot('font-app-001-paragraph.png')

      // 3. Verify computed font properties on paragraph
      const fontFamily = await paragraph.evaluate((el) => window.getComputedStyle(el).fontFamily)
      const fontSize = await paragraph.evaluate((el) => window.getComputedStyle(el).fontSize)
      // THEN: assertion
      expect(fontFamily).toContain('Inter')
      expect(fontSize).toBe('16px')
    }
  )

  test(
    'APP-THEME-FONTS-012: should render with title font and text transformation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: title font applied to heading
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            title: {
              family: 'Bely Display',
              fallback: 'Georgia, serif',
              transform: 'lowercase',
              letterSpacing: '0.05em',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'heading',
                content: 'Our Mission',
              },
            ],
          },
        ],
      })

      // WHEN: heading uses theme.fonts.title with transform
      await page.goto('/')

      // THEN: Three-step validation

      // 1. Verify CSS compilation contains title font
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-title: Bely Display, Georgia, serif')

      // 2. Visual validation captures heading with transform
      const heading = page.locator('h1')
      await expect(heading).toHaveScreenshot('font-app-002-heading-transform.png')

      // 3. Verify computed text transform and letter spacing
      const textTransform = await heading.evaluate(
        (el) => window.getComputedStyle(el).textTransform
      )
      const letterSpacing = await heading.evaluate(
        (el) => window.getComputedStyle(el).letterSpacing
      )
      // THEN: assertion
      expect(textTransform).toBe('lowercase')
      expect(letterSpacing).not.toBe('normal')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-THEME-FONTS-013: user can complete full fonts workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with comprehensive font system
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          fonts: {
            title: {
              family: 'Bely Display',
              fallback: 'Georgia, serif',
              size: '32px',
            },
            body: {
              family: 'Inter',
              fallback: 'sans-serif',
              size: '16px',
              lineHeight: '1.5',
            },
            mono: {
              family: 'JetBrains Mono',
              fallback: 'monospace',
              size: '14px',
            },
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
                  'data-testid': 'font-system',
                  className: 'flex flex-col gap-6 p-5',
                },
                children: [
                  {
                    type: 'h1',
                    props: {
                      className: 'font-title text-3xl',
                    },
                    children: ['Welcome to Sovrium'],
                  },
                  {
                    type: 'p',
                    props: {
                      className: 'font-body text-base',
                    },
                    children: [
                      'This is body text using Inter font family with 16px size and 1.5 line-height for optimal readability.',
                    ],
                  },
                  {
                    type: 'code',
                    props: {
                      className: 'font-mono text-sm block p-3 bg-gray-100',
                    },
                    children: ['console.log("Hello, World!")'],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // 1. Verify CSS compilation contains all font categories
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // THEN: assertion
      expect(css).toContain('--font-title: Bely Display, Georgia, serif')
      expect(css).toContain('--font-body: Inter, sans-serif')
      expect(css).toContain('--font-mono: JetBrains Mono, monospace')

      // 2. Structure validation (ARIA)
      // THEN: assertion
      await expect(page.locator('[data-testid="font-system"]')).toMatchAriaSnapshot(`
        - group:
          - heading "Welcome to Sovrium" [level=1]
          - paragraph: "This is body text using Inter font family with 16px size and 1.5 line-height for optimal readability."
          - code: "console.log(\\"Hello, World!\\")"
      `)

      // 3. Visual validation (Screenshot) - captures all typography rendering
      await expect(page.locator('[data-testid="font-system"]')).toHaveScreenshot(
        'font-regression-001-complete-system.png',
        {
          animations: 'disabled',
        }
      )

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
