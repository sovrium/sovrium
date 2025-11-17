/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Border Radius
 *
 * Source: specs/app/theme/border-radius/border-radius.schema.json
 * Spec Count: 14 (13 @spec + 1 @regression)
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (13 tests: 6 validation + 8 application) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Border Radius', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-THEME-RADIUS-001: should validate radius tokens from 0 to 1.5rem',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: border-radius scale from none to 3xl
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            none: '0',
            sm: '0.125rem',
            md: '0.375rem',
            lg: '0.5rem',
            xl: '0.75rem',
            '2xl': '1rem',
            '3xl': '1.5rem',
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
                  'data-testid': 'radius-scale',
                  className: 'grid grid-cols-4 gap-4 p-5',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      className: 'w-20 h-20 bg-blue-500 rounded-none',
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'w-20 h-20 bg-blue-500 rounded-sm',
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'w-20 h-20 bg-blue-500 rounded-md',
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'w-20 h-20 bg-blue-500 rounded-lg',
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'w-20 h-20 bg-blue-500 rounded-xl',
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'w-20 h-20 bg-blue-500 rounded-2xl',
                    },
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'w-20 h-20 bg-blue-500 rounded-3xl',
                    },
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: radius system defines progressive rounding
      await page.goto('/')

      // THEN: it should validate radius tokens from 0 to 1.5rem
      // 1. Verify CSS compilation contains radius definitions
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      expect(css).toContain('--radius-none: 0')
      expect(css).toContain('--radius-sm: 0.125rem')
      expect(css).toContain('--radius-md: 0.375rem')
      expect(css).toContain('--radius-lg: 0.5rem')
      expect(css).toContain('--radius-xl: 0.75rem')
      expect(css).toContain('--radius-2xl: 1rem')
      expect(css).toContain('--radius-3xl: 1.5rem')

      // 2. Visual validation shows complete radius scale progression
      await expect(page.locator('[data-testid="radius-scale"]')).toHaveScreenshot(
        'radius-001-scale-progression.png',
        {
          animations: 'disabled',
        }
      )
    }
  )

  test.fixme(
    'APP-THEME-RADIUS-002: should validate no rounding',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: border-radius 'none' with value '0'
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            none: '0',
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

      // WHEN: sharp corners are needed
      await page.goto('/')

      // THEN: it should validate no rounding
      const element = page.locator('[data-testid="radius-none"]')
      await expect(element).toHaveScreenshot('radius-002-none.png')
    }
  )

  test.fixme(
    'APP-THEME-RADIUS-003: should validate fully rounded elements',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: border-radius 'full' with value '9999px'
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            full: '9999px',
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

      // WHEN: perfect circles or pills are needed
      await page.goto('/')

      // THEN: it should validate fully rounded elements
      const element = page.locator('[data-testid="radius-full"]')
      await expect(element).toHaveScreenshot('radius-003-full.png')
    }
  )

  test(
    'APP-THEME-RADIUS-004: should validate rem-based radius values',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: border-radius using rem units
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            sm: '0.125rem',
            md: '0.375rem',
            lg: '0.5rem',
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
                  'data-testid': 'rem-radius',
                  className: 'flex gap-4 p-5',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      className:
                        'w-20 h-20 bg-green-500 rounded-sm flex items-center justify-center text-white text-xs',
                    },
                    children: ['0.125rem'],
                  },
                  {
                    type: 'div',
                    props: {
                      className:
                        'w-20 h-20 bg-green-500 rounded-md flex items-center justify-center text-white text-xs',
                    },
                    children: ['0.375rem'],
                  },
                  {
                    type: 'div',
                    props: {
                      className:
                        'w-20 h-20 bg-green-500 rounded-lg flex items-center justify-center text-white text-xs',
                    },
                    children: ['0.5rem'],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: radius scales with font size
      await page.goto('/')

      // THEN: it should validate rem-based radius values
      // 1. Verify CSS compilation contains rem-based radius definitions
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      expect(css).toContain('--radius-sm: 0.125rem')
      expect(css).toContain('--radius-md: 0.375rem')
      expect(css).toContain('--radius-lg: 0.5rem')

      // 2. Visual validation shows rem-based radius progression
      await expect(page.locator('[data-testid="rem-radius"]')).toHaveScreenshot(
        'radius-004-rem-values.png',
        {
          animations: 'disabled',
        }
      )
    }
  )

  test.fixme(
    'APP-THEME-RADIUS-005: should validate kebab-case convention',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: border-radius with kebab-case naming
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            'button-radius': '0.5rem',
            'card-radius': '1rem',
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

      // WHEN: radius uses multi-word names
      await page.goto('/')

      // THEN: it should validate kebab-case convention
      await expect(page.locator('[data-testid="radius-button-radius"]')).toBeVisible()
      await expect(page.locator('[data-testid="radius-card-radius"]')).toBeVisible()
    }
  )

  test.fixme(
    'APP-THEME-RADIUS-006: should validate complete rounding system',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: complete radius system (none, sm, md, lg, xl, 2xl, 3xl, full)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            none: '0',
            sm: '0.125rem',
            md: '0.375rem',
            lg: '0.5rem',
            xl: '0.75rem',
            '2xl': '1rem',
            '3xl': '1.5rem',
            full: '9999px',
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

      // WHEN: all radius tokens are defined
      await page.goto('/')

      // THEN: it should validate complete rounding system
      await expect(page.locator('[data-testid="radius-none"]')).toBeVisible()
      await expect(page.locator('[data-testid="radius-full"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-RADIUS-APPLICATION-001: should render button with 0.375rem border-radius creating soft corners',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: md radius applied to button component
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            md: '0.375rem',
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
                  'data-testid': 'primary-button',
                },
              },
            ],
          },
        ],
      })

      // WHEN: button uses theme.borderRadius.md for moderate rounding
      await page.goto('/')

      // THEN: it should render button with 0.375rem border-radius creating soft corners
      // 1. Verify CSS compilation contains radius definition
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      expect(css).toContain('--radius-md: 0.375rem')

      // 2. Visual validation
      const button = page.locator('[data-testid="primary-button"]')
      await expect(button).toHaveScreenshot('radius-app-001-button-soft-corners.png')

      // 3. Verify computed border-radius
      const borderRadius = await button.evaluate((el) => window.getComputedStyle(el).borderRadius)
      expect(borderRadius).toBe('6px') // 0.375rem × 16px = 6px
    }
  )

  test.fixme(
    'APP-THEME-RADIUS-APPLICATION-002: should render image as circle with 9999px border-radius',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: full radius applied to avatar image
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            full: '9999px',
          },
        },
        pages: [
          {
            name: 'home',

            path: '/',
            sections: [
              {
                type: 'avatar',
                props: {
                  'data-testid': 'user-avatar',
                  src: 'avatar.jpg',
                  alt: 'User',
                },
              },
            ],
          },
        ],
      })

      // WHEN: avatar uses theme.borderRadius.full for perfect circle
      await page.goto('/')

      // THEN: it should render image as circle with 9999px border-radius
      const avatar = page.locator('[data-testid="user-avatar"]')
      await expect(avatar).toHaveScreenshot('radius-app-002-avatar-circle.png')
    }
  )

  test(
    'APP-THEME-RADIUS-APPLICATION-003: should render card with 0.5rem border-radius creating soft edges',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: lg radius applied to card component
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            lg: '0.5rem',
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
                  'data-testid': 'content-card',
                },
              },
            ],
          },
        ],
      })

      // WHEN: card uses theme.borderRadius.lg for noticeable rounding
      await page.goto('/')

      // THEN: it should render card with 0.5rem border-radius creating soft edges
      // 1. Verify CSS compilation contains radius definition
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      expect(css).toContain('--radius-lg: 0.5rem')

      // 2. Visual validation
      const card = page.locator('[data-testid="content-card"]')
      await expect(card).toHaveScreenshot('radius-app-003-card-soft-edges.png')

      // 3. Verify computed border-radius
      const borderRadius = await card.evaluate((el) => window.getComputedStyle(el).borderRadius)
      expect(borderRadius).toBe('8px') // 0.5rem × 16px = 8px
    }
  )

  test(
    'APP-THEME-RADIUS-APPLICATION-004: should apply smaller radius on mobile for better touch targets and larger radius on desktop for visual polish',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: responsive border-radius varying by breakpoint
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            sm: '0.125rem',
            lg: '0.5rem',
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
                  'data-testid': 'responsive-button',
                },
              },
            ],
          },
        ],
      })

      // WHEN: mobile uses sm radius and desktop uses lg radius for touch vs visual optimization
      await page.goto('/')

      // THEN: it should apply smaller radius on mobile for better touch targets and larger radius on desktop for visual polish
      // 1. Verify CSS compilation contains radius definitions
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      expect(css).toContain('--radius-sm: 0.125rem')
      expect(css).toContain('--radius-lg: 0.5rem')

      // 2. Visual validation - Mobile: sm radius (0.125rem / 2px) for precise touch targets
      const button = page.locator('[data-testid="responsive-button"]')
      await expect(button).toHaveScreenshot('radius-app-004-responsive-mobile.png')

      // 3. Visual validation - Desktop: lg radius (0.5rem / 8px) for visual polish
      await page.setViewportSize({ width: 1024, height: 768 })
      await expect(button).toHaveScreenshot('radius-app-004-responsive-desktop.png')
    }
  )

  test.fixme(
    'APP-THEME-RADIUS-APPLICATION-005: should render element with custom radius on each corner creating arrow-like shape',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: per-corner border-radius for complex shapes
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            md: '0.375rem',
            none: '0',
          },
        },
        pages: [
          {
            name: 'home',

            path: '/',
            sections: [
              {
                type: 'speech-bubble',
                content: 'Hello!',
                props: {
                  'data-testid': 'message-bubble',
                },
              },
            ],
          },
        ],
      })

      // WHEN: speech bubble uses different radius per corner for directional indicator
      await page.goto('/')

      // THEN: it should render element with custom radius on each corner creating arrow-like shape
      const bubble = page.locator('[data-testid="message-bubble"]')
      await expect(bubble).toBeVisible()
      // Per-corner control: top-left, top-right, bottom-right rounded; bottom-left sharp
      const borderRadius = await bubble.evaluate((el) => window.getComputedStyle(el).borderRadius)
      expect(borderRadius).toBeTruthy()
    }
  )

  test(
    'APP-THEME-RADIUS-APPLICATION-006: should render badge as pill with fully rounded left and right edges',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: full radius for badge and pill-shaped components
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            full: '9999px',
          },
        },
        pages: [
          {
            name: 'home',

            path: '/',
            sections: [
              {
                type: 'badge',
                content: 'New',
                props: {
                  'data-testid': 'status-badge',
                },
              },
            ],
          },
        ],
      })

      // WHEN: badge uses theme.borderRadius.full for pill shape
      await page.goto('/')

      // THEN: it should render badge as pill with fully rounded left and right edges
      // 1. Verify CSS compilation contains full radius definition
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      expect(css).toContain('--radius-full: 9999px')

      // 2. Visual validation - Radius token: theme.borderRadius.full = '9999px'
      const badge = page.locator('[data-testid="status-badge"]')
      await expect(badge).toHaveScreenshot('radius-app-006-badge-pill.png')

      // 3. Verify computed border-radius is a very large value
      const borderRadius = await badge.evaluate((el) => window.getComputedStyle(el).borderRadius)
      expect(borderRadius).toBe('9999px')
    }
  )

  test.fixme(
    'APP-THEME-RADIUS-APPLICATION-007: should apply appropriate radius for each image context',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: radius patterns for image components (avatar vs thumbnail vs hero)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            full: '9999px',
            md: '0.375rem',
            lg: '0.5rem',
            none: '0',
          },
        },
        pages: [
          {
            name: 'home',

            path: '/',
            sections: [
              {
                type: 'avatar',
                props: {
                  'data-testid': 'user-avatar',
                  src: 'avatar.jpg',
                  alt: 'User',
                },
              },
              {
                type: 'thumbnail',
                props: {
                  'data-testid': 'post-thumbnail',
                  src: 'thumbnail.jpg',
                  alt: 'Post',
                },
              },
              {
                type: 'hero-image',
                props: {
                  'data-testid': 'hero-image',
                  src: 'hero.jpg',
                  alt: 'Hero',
                },
              },
            ],
          },
        ],
      })

      // WHEN: different image types require different rounding approaches
      await page.goto('/')

      // THEN: it should apply appropriate radius for each image context
      // Visual validation shows different radius treatments for different image contexts
      const pageSnapshot = page.locator('body')
      await expect(pageSnapshot).toHaveScreenshot('radius-app-007-image-contexts.png')

      // Avatar: full radius (circle) - square dimensions become perfect circle
      const avatar = page.locator('[data-testid="user-avatar"]')
      await expect(avatar).toHaveScreenshot('radius-app-007-avatar.png')

      // Thumbnail: md radius (moderate rounding) - preserves image aspect ratio
      const thumbnail = page.locator('[data-testid="post-thumbnail"]')
      await expect(thumbnail).toHaveScreenshot('radius-app-007-thumbnail.png')

      // Hero: top-lg radius (rounded top only) - integrates with card below
      const hero = page.locator('[data-testid="hero-image"]')
      await expect(hero).toHaveScreenshot('radius-app-007-hero.png')
    }
  )

  test.fixme(
    'APP-THEME-RADIUS-APPLICATION-008: should apply radius to create cohesive nested component design',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: card component hierarchy with coordinated border-radius across parent and children
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            lg: '0.5rem',
            md: '0.375rem',
            none: '0',
          },
        },
        pages: [
          {
            name: 'home',

            path: '/',
            sections: [
              {
                type: 'card-with-header',
                props: {
                  'data-testid': 'product-card',
                },
                children: [
                  {
                    type: 'card-header',
                    content: 'Header',
                    props: {
                      'data-testid': 'card-header',
                    },
                  },
                  {
                    type: 'card-body',
                    content: 'Content',
                    props: {
                      'data-testid': 'card-body',
                    },
                  },
                  {
                    type: 'card-footer',
                    content: 'Footer',
                    props: {
                      'data-testid': 'card-footer',
                    },
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: card contains header, body, and footer with nested rounding
      await page.goto('/')

      // THEN: it should apply radius to create cohesive nested component design
      // Visual validation shows coordinated border-radius hierarchy
      const card = page.locator('[data-testid="product-card"]')
      await expect(card).toHaveScreenshot('radius-app-008-card-hierarchy.png')

      // Individual components show proper radius coordination
      const header = page.locator('[data-testid="card-header"]')
      await expect(header).toHaveScreenshot('radius-app-008-header.png')

      const footer = page.locator('[data-testid="card-footer"]')
      await expect(footer).toHaveScreenshot('radius-app-008-footer.png')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-THEME-BORDER-RADIUS-REGRESSION-001: user can complete full border-radius workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with comprehensive border-radius system
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          borderRadius: {
            none: '0',
            md: '0.375rem',
            lg: '0.5rem',
            full: '9999px',
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
                  'data-testid': 'radius-system',
                  className: 'flex flex-col gap-6 p-5',
                },
                children: [
                  {
                    type: 'button',
                    props: {
                      className: 'rounded-md py-3 px-6 bg-blue-500 text-white border-none',
                    },
                    children: ['Button with md radius'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'rounded-lg p-6 bg-gray-100 border border-gray-300',
                    },
                    children: ['Card with lg radius'],
                  },
                  {
                    type: 'div',
                    props: {
                      className:
                        'w-16 h-16 rounded-full bg-green-500 flex items-center justify-center text-white',
                    },
                    children: ['Avatar'],
                  },
                  {
                    type: 'div',
                    props: {
                      className: 'w-[100px] h-[100px] rounded-none bg-red-500',
                    },
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // 1. Verify CSS compilation contains all radius definitions
      const cssResponse = await page.request.get('/assets/output.css')
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      expect(css).toContain('--radius-none: 0')
      expect(css).toContain('--radius-md: 0.375rem')
      expect(css).toContain('--radius-lg: 0.5rem')
      expect(css).toContain('--radius-full: 9999px')

      // 2. Structure validation (ARIA)
      await expect(page.locator('[data-testid="radius-system"]')).toMatchAriaSnapshot(`
        - group:
          - button "Button with md radius"
          - group: Card with lg radius
          - group: Avatar
      `)

      // 3. Visual validation (Screenshot) - captures all border-radius rendering
      await expect(page.locator('[data-testid="radius-system"]')).toHaveScreenshot(
        'radius-regression-001-complete-system.png',
        {
          animations: 'disabled',
        }
      )

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
