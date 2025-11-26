/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Navigation Configuration
 *
 * Source: specs/app/pages/layout/navigation/navigation.schema.json
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Navigation Configuration', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-NAV-001: should display logo image',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a navigation with logo
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            layout: { navigation: { logo: './public/logo.svg' } },
            sections: [],
          },
        ],
      })

      // WHEN: logo is './public/logo.svg'
      await page.goto('/')

      // THEN: it should display logo image
      await expect(page.locator('[data-testid="nav-logo"]')).toHaveAttribute(
        'src',
        './public/logo.svg'
      )
      // THEN: assertion
      await expect(page.locator('[data-testid="nav-logo-link"]')).toHaveAttribute('href', '/')
    }
  )

  test(
    'APP-PAGES-NAV-002: should use alternative logo for mobile devices',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a navigation with logoMobile
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: { logo: './public/logo.svg', logoMobile: './public/logo-mobile.svg' },
            },
            sections: [],
          },
        ],
      })

      // WHEN: logoMobile is './public/logo-mobile.svg'
      await page.goto('/')

      // THEN: it should use alternative logo for mobile devices
      await page.setViewportSize({ width: 375, height: 667 })
      await expect(page.locator('[data-testid="nav-logo-mobile"]')).toHaveAttribute(
        'src',
        './public/logo-mobile.svg'
      )
      await page.setViewportSize({ width: 1024, height: 768 })
      // THEN: assertion
      await expect(page.locator('[data-testid="nav-logo"]')).toHaveAttribute(
        'src',
        './public/logo.svg'
      )
    }
  )

  test(
    'APP-PAGES-NAV-003: should provide accessible alt text for logo',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a navigation with logoAlt
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: { logo: './public/logo.svg', logoAlt: 'Acme Inc - Building the Future' },
            },
            sections: [],
          },
        ],
      })

      // WHEN: logoAlt is 'Company Logo'
      await page.goto('/')

      // THEN: it should provide accessible alt text for logo
      await expect(page.locator('[data-testid="nav-logo"]')).toHaveAttribute(
        'alt',
        'Acme Inc - Building the Future'
      )
    }
  )

  test(
    'APP-PAGES-NAV-004: should stick to top on scroll',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sticky navigation
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: {
                logo: './public/logo.svg',
                sticky: true,
                links: { desktop: [{ label: 'Products', href: '/products' }] },
              },
            },
            sections: [{ type: 'div', props: { style: 'height: 2000px' }, children: ['Content'] }],
          },
        ],
      })

      // WHEN: sticky is true
      await page.goto('/')

      // THEN: it should stick to top on scroll
      const nav = page.locator('[data-testid="navigation"]')
      await expect(nav).toHaveCSS('position', 'sticky')
      await page.evaluate(() => window.scrollTo(0, 1000))
      // THEN: assertion
      await expect(nav).toBeInViewport()
    }
  )

  test(
    'APP-PAGES-NAV-005: should have transparent background (becomes opaque on scroll)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a transparent navigation
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: {
                logo: './public/logo.svg',
                transparent: true,
                sticky: true,
                links: { desktop: [{ label: 'Features', href: '/features' }] },
              },
            },
            sections: [{ type: 'div', props: { style: 'height: 2000px' }, children: ['Content'] }],
          },
        ],
      })

      // WHEN: transparent is true initially
      await page.goto('/')

      // THEN: it should have transparent background (becomes opaque on scroll)
      const nav = page.locator('[data-testid="navigation"]')
      const initialBg = await nav.evaluate((el) => window.getComputedStyle(el).backgroundColor)
      expect(initialBg).toMatch(/rgba?\(.*,\s*0\)|transparent/)
      await page.evaluate(() => window.scrollTo(0, 150))
      await page.waitForTimeout(100)
      const scrolledBg = await nav.evaluate((el) => window.getComputedStyle(el).backgroundColor)
      // THEN: assertion
      expect(scrolledBg).not.toMatch(/rgba?\(.*,\s*0\)|transparent/)
    }
  )

  test(
    'APP-PAGES-NAV-006: should render desktop navigation menu',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: navigation with desktop links
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: {
                logo: './public/logo.svg',
                links: {
                  desktop: [
                    { label: 'Products', href: '/products' },
                    { label: 'Pricing', href: '/pricing' },
                    { label: 'About', href: '/about' },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: links.desktop is array of nav-links
      await page.goto('/')

      // THEN: it should render desktop navigation menu
      // ARIA snapshot validates structure and accessibility
      await expect(page.locator('[data-testid="navigation"]')).toMatchAriaSnapshot(`
        - navigation "Main navigation":
          - link:
            - img "Logo"
          - link "Products"
          - link "Pricing"
          - link "About"
      `)
    }
  )

  test(
    'APP-PAGES-NAV-007: should render different links for mobile menu',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: navigation with mobile links
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: {
                logo: './public/logo.svg',
                links: {
                  desktop: [
                    { label: 'Products', href: '/products' },
                    { label: 'Pricing', href: '/pricing' },
                    { label: 'About', href: '/about' },
                  ],
                  mobile: [
                    { label: 'Home', href: '/' },
                    { label: 'Products', href: '/products' },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: links.mobile differs from desktop
      await page.goto('/')

      // THEN: it should render different links for mobile menu
      await page.setViewportSize({ width: 375, height: 667 })
      await page.click('[data-testid="mobile-menu-toggle"]')
      const mobileLinks = page.locator('[data-testid="mobile-menu"] a')
      // THEN: assertion
      await expect(mobileLinks).toHaveCount(2)
      await expect(mobileLinks.nth(0)).toContainText('Home')
      await expect(mobileLinks.nth(1)).toContainText('Products')
    }
  )

  test(
    'APP-PAGES-NAV-008: should render prominent call-to-action button',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: navigation with CTA button
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: {
                logo: './public/logo.svg',
                links: {
                  desktop: [
                    { label: 'Features', href: '/features' },
                    { label: 'Pricing', href: '/pricing' },
                  ],
                },
                cta: { text: 'Get Started', href: '/signup', variant: 'primary' },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: cta has text 'Get Started' and href '/signup'
      await page.goto('/')

      // THEN: it should render prominent call-to-action button
      const cta = page.locator('[data-testid="nav-cta"]')
      await expect(cta).toContainText('Get Started')
      await expect(cta).toHaveAttribute('href', '/signup')
      await expect(cta).toHaveClass(/btn-primary/)
    }
  )

  test(
    'APP-PAGES-NAV-009: should display search input in navigation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: navigation with search enabled
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: {
                logo: './public/logo.svg',
                links: { desktop: [{ label: 'Docs', href: '/docs' }] },
                search: { enabled: true, placeholder: 'Search documentation...' },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: search.enabled is true with placeholder 'Search...'
      await page.goto('/')

      // THEN: it should display search input in navigation
      const search = page.locator('[data-testid="nav-search"] input')
      await expect(search).toBeVisible()
      await expect(search).toHaveAttribute('placeholder', 'Search documentation...')
    }
  )

  test(
    'APP-PAGES-NAV-010: should show user account menu with login/signup links',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: navigation with user menu enabled
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: {
                logo: './public/logo.svg',
                links: { desktop: [{ label: 'Features', href: '/features' }] },
                user: { enabled: true, loginUrl: '/login', signupUrl: '/signup' },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: user.enabled is true with loginUrl and signupUrl
      await page.goto('/')

      // THEN: it should show user account menu with login/signup links
      await expect(page.locator('[data-testid="login-link"]')).toHaveAttribute('href', '/login')
      await expect(page.locator('[data-testid="signup-link"]')).toHaveAttribute('href', '/signup')
    }
  )

  test(
    'APP-PAGES-NAV-011: should render minimal navigation with logo',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: navigation with required logo only
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: { navigation: { logo: './public/logo.svg' } },
            sections: [],
          },
        ],
      })

      // WHEN: all other properties are optional
      await page.goto('/')

      // THEN: it should render minimal navigation with logo
      await expect(page.locator('[data-testid="navigation"]')).toBeVisible()
      await expect(page.locator('[data-testid="nav-logo"]')).toBeVisible()
      await expect(page.locator('[data-testid="nav-link"]')).toHaveCount(0)
    }
  )

  test(
    'APP-PAGES-NAV-012: should compose navigation from modular schemas',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: navigation referencing sub-schemas
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            layout: {
              navigation: {
                logo: './public/logo.svg',
                links: { desktop: [{ label: 'Products', href: '/products' }] },
                cta: { text: 'Get Started', href: '/signup', variant: 'primary' },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: nav-links and cta-button use $ref
      await page.goto('/')

      // THEN: it should compose navigation from modular schemas
      await expect(page.locator('[data-testid="nav-link"]')).toContainText('Products')
      await expect(page.locator('[data-testid="nav-cta"]')).toContainText('Get Started')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-LAYOUT-NAVIGATION-REGRESSION-001: user can complete full navigation workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app configuration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home' },
            layout: {
              navigation: {
                logo: './public/logo.svg',
                logoAlt: 'Acme Inc',
                sticky: true,
                transparent: true,
                links: {
                  desktop: [
                    { label: 'Features', href: '/features' },
                    { label: 'Pricing', href: '/pricing' },
                  ],
                },
                cta: { text: 'Get Started', href: '/signup', variant: 'primary' },
                search: { enabled: true, placeholder: 'Search...' },
                user: { enabled: true, loginUrl: '/login', signupUrl: '/signup' },
              },
            },
            sections: [
              { type: 'div', props: { style: { height: '2000px' } }, children: ['Content'] },
            ],
          },
        ],
      })

      // WHEN: user navigates to the page
      await page.goto('/')

      // 1. Structure and accessibility validation (ARIA)
      // THEN: assertion
      await expect(page.locator('[data-testid="navigation"]')).toMatchAriaSnapshot(`
        - navigation "Main navigation":
          - link:
            - img "Acme Inc"
          - link "Features"
          - link "Pricing"
          - button "Get Started"
          - searchbox "Search..."
          - link "Login"
          - link "Sign Up"
      `)

      // 2. Visual validation - sticky transparent state (before scroll)
      await expect(page.locator('[data-testid="navigation"]')).toHaveScreenshot(
        'navigation-regression-001-transparent.png',
        {
          animations: 'disabled',
        }
      )

      // 3. Visual validation - sticky opaque state (after scroll)
      await page.evaluate(() => window.scrollTo(0, 150))
      await expect(page.locator('[data-testid="navigation"]')).toHaveScreenshot(
        'navigation-regression-001-scrolled.png',
        {
          animations: 'disabled',
        }
      )
    }
  )
})
