/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for URL Path
 *
 * Source: src/domain/models/app/page/path.ts
 * Spec Count: 16
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (19 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 *
 * Routing Behavior (APP-PAGES-PATH-011 to APP-PAGES-PATH-015):
 * DefaultHomePage.tsx should ONLY be rendered when NO page exists at '/' path.
 * It should NOT render blocks - only app name, version, and description.
 * Bug: Lines 68-79 in DefaultHomePage.tsx incorrectly render app.blocks.
 *
 * Error Page Override Behavior (APP-PAGES-PATH-016 to APP-PAGES-PATH-019):
 * Users can override default error pages (404, 500) by defining pages at '/404' and '/500' paths.
 * If no custom error page exists, default NotFoundPage and ErrorPage components are rendered.
 */

test.describe('URL Path', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-PATH-001: should validate as homepage path',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a root path
      await startServerWithSchema({
        name: 'test-app',
        pages: [{ name: 'Home', path: '/', meta: { lang: 'en-US', title: 'Home' }, sections: [] }],
      })

      // WHEN: value is '/'
      await page.goto('/')

      // THEN: it should validate as homepage path
      await expect(page).toHaveURL('/')
      await expect(page.locator('[data-testid="page-home"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-PATH-002: should follow shared path pattern from common definitions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a path referencing common definition
      // WHEN: schema uses $ref to definitions.schema.json#/definitions/path
      // THEN: it should follow shared path pattern from common definitions
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          { name: 'About', path: '/about', meta: { lang: 'en-US', title: 'About' }, sections: [] },
        ],
      })
      // WHEN: user navigates to the page
      await page.goto('/about')
      // THEN: assertion
      await expect(page).toHaveURL('/about')
    }
  )

  test(
    'APP-PAGES-PATH-003: should accept paths with leading slash',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a single-level path
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          { name: 'About', path: '/about', meta: { lang: 'en-US', title: 'About' }, sections: [] },
          {
            name: 'Pricing',
            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing' },
            sections: [],
          },
          {
            name: 'Contact',
            path: '/contact',
            meta: { lang: 'en-US', title: 'Contact' },
            sections: [],
          },
        ],
      })

      // WHEN: value is '/about' or '/pricing'
      await page.goto('/about')
      // THEN: assertion
      await expect(page).toHaveURL('/about')
      // WHEN: user navigates to the page
      await page.goto('/pricing')
      // THEN: assertion
      await expect(page).toHaveURL('/pricing')

      // THEN: it should accept paths with leading slash
    }
  )

  test(
    'APP-PAGES-PATH-004: should accept multi-level URL paths',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a nested path
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Pricing',
            path: '/products/pricing',
            meta: { lang: 'en-US', title: 'Pricing' },
            sections: [],
          },
          {
            name: 'Article',
            path: '/blog/article',
            meta: { lang: 'en-US', title: 'Article' },
            sections: [],
          },
        ],
      })

      // WHEN: value is '/products/pricing' or '/blog/article'
      await page.goto('/products/pricing')
      // THEN: assertion
      await expect(page).toHaveURL('/products/pricing')
      // WHEN: user navigates to the page
      await page.goto('/blog/article')
      // THEN: assertion
      await expect(page).toHaveURL('/blog/article')

      // THEN: it should accept multi-level URL paths
    }
  )

  test(
    'APP-PAGES-PATH-005: should accept kebab-case URL segments',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a path with kebab-case segments
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Team',
            path: '/our-team',
            meta: { lang: 'en-US', title: 'Our Team' },
            sections: [],
          },
          {
            name: 'Contact',
            path: '/contact-us',
            meta: { lang: 'en-US', title: 'Contact Us' },
            sections: [],
          },
        ],
      })

      // WHEN: value is '/our-team' or '/contact-us'
      await page.goto('/our-team')
      // THEN: assertion
      await expect(page).toHaveURL('/our-team')
      // WHEN: user navigates to the page
      await page.goto('/contact-us')
      // THEN: assertion
      await expect(page).toHaveURL('/contact-us')

      // THEN: it should accept kebab-case URL segments
    }
  )

  test(
    'APP-PAGES-PATH-006: should provide examples for typical URL patterns',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: common website paths (/, /about, /pricing, /contact)
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          { name: 'Home', path: '/', meta: { lang: 'en-US', title: 'Home' }, sections: [] },
          { name: 'About', path: '/about', meta: { lang: 'en-US', title: 'About' }, sections: [] },
          {
            name: 'Pricing',
            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing' },
            sections: [],
          },
          {
            name: 'Contact',
            path: '/contact',
            meta: { lang: 'en-US', title: 'Contact' },
            sections: [],
          },
        ],
      })

      // WHEN: standard website pages are defined
      await page.goto('/')
      // THEN: assertion
      await expect(page).toHaveURL('/')
      // WHEN: user navigates to the page
      await page.goto('/about')
      // THEN: assertion
      await expect(page).toHaveURL('/about')

      // THEN: it should provide examples for typical URL patterns
    }
  )

  test(
    'APP-PAGES-PATH-007: should fail validation (path is required)',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: path as required field
      // WHEN: page is created without path
      // THEN: it should fail validation (path is required)
      // Note: This test validates build-time schema validation
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          // @ts-expect-error - Testing that missing path causes validation to fail
          pages: [{ name: 'About', meta: { lang: 'en-US', title: 'About' }, sections: [] }],
        })
      }).rejects.toThrow()
    }
  )

  test(
    'APP-PAGES-PATH-008: should ensure unique routing for all pages',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: paths across multiple pages
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          { name: 'Home', path: '/', meta: { lang: 'en-US', title: 'Home' }, sections: [] },
          { name: 'About', path: '/about', meta: { lang: 'en-US', title: 'About' }, sections: [] },
          {
            name: 'Pricing',
            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing' },
            sections: [],
          },
          {
            name: 'Contact',
            path: '/contact',
            meta: { lang: 'en-US', title: 'Contact' },
            sections: [],
          },
        ],
      })

      // WHEN: each page has unique path
      await page.goto('/')
      // THEN: assertion
      await expect(page.locator('[data-testid="page-home"]')).toBeVisible()
      // WHEN: user navigates to the page
      await page.goto('/about')
      // THEN: assertion
      await expect(page.locator('[data-testid="page-about"]')).toBeVisible()

      // THEN: it should ensure unique routing for all pages
    }
  )

  test(
    'APP-PAGES-PATH-009: should map URL to page configuration for rendering',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: path determining page accessibility
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Pricing',
            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing Plans' },
            sections: [],
          },
        ],
      })

      // WHEN: user navigates to path in browser
      await page.goto('/pricing')

      // THEN: it should map URL to page configuration for rendering
      await expect(page).toHaveURL('/pricing')
      await expect(page).toHaveTitle('Pricing Plans')
      await expect(page.locator('[data-testid="page-pricing"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-PATH-010: should support dynamic route parameters (if applicable)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: path with dynamic segments
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Blog Post',
            path: '/blog/:slug',
            meta: { lang: 'en-US', title: 'Blog' },
            sections: [],
          },
          {
            name: 'Product',
            path: '/products/:id',
            meta: { lang: 'en-US', title: 'Product' },
            sections: [],
          },
        ],
      })

      // WHEN: value is '/blog/:slug' or '/products/:id'
      await page.goto('/blog/hello-world')
      // THEN: assertion
      await expect(page).toHaveURL('/blog/hello-world')
      await expect(page.locator('[data-slug="hello-world"]')).toBeVisible()

      // WHEN: user navigates to the page
      await page.goto('/products/123')
      // THEN: assertion
      await expect(page).toHaveURL('/products/123')
      await expect(page.locator('[data-product-id="123"]')).toBeVisible()

      // THEN: it should support dynamic route parameters (if applicable)
    }
  )

  test(
    'APP-PAGES-PATH-011: DefaultHomePage displays app name, version, description (NO blocks)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app with NO pages array
      await startServerWithSchema({
        name: 'my-app',
        version: '1.0.0',
        description: 'My app description',
        blocks: [
          {
            name: 'hero',
            type: 'section',
            children: [{ type: 'h1', content: 'Hero Block' }],
          },
        ],
      })

      // WHEN: user navigates to '/'
      await page.goto('/')

      // THEN: DefaultHomePage displays app name, version, description (NO blocks)
      await expect(page.locator('[data-testid="app-name-heading"]')).toHaveText('my-app')
      await expect(page.locator('[data-testid="app-version-badge"]')).toHaveText('1.0.0')
      await expect(page.locator('[data-testid="app-description"]')).toHaveText('My app description')

      // CRITICAL: Blocks should NOT be rendered (bug fix verification)
      // THEN: assertion
      await expect(page.locator('[data-block="hero"]')).toBeHidden()
    }
  )

  test(
    'APP-PAGES-PATH-012: DefaultHomePage displays when pages exist but no "/" path',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app with pages=[{path: '/about'}] (no '/' page)
      await startServerWithSchema({
        name: 'my-app',
        pages: [
          {
            name: 'about',
            path: '/about',
            meta: { lang: 'en-US', title: 'About Us', description: 'About page' },
            sections: [{ type: 'section', children: [{ type: 'heading', content: 'About Us' }] }],
          },
        ],
      })

      // WHEN: user navigates to '/'
      await page.goto('/')

      // THEN: DefaultHomePage displays (fallback behavior)
      await expect(page.locator('[data-testid="app-name-heading"]')).toHaveText('my-app')

      // Verify /about route works
      // WHEN: user navigates to the page
      await page.goto('/about')
      // THEN: assertion
      await expect(page).toHaveTitle('About Us')
      await expect(page.locator('h1')).toHaveText('About Us')
    }
  )

  test(
    'APP-PAGES-PATH-013: Custom page renders when "/" path exists',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app with pages=[{path: '/', sections: [...]}]
      await startServerWithSchema({
        name: 'my-app',
        pages: [
          {
            name: 'custom_home',
            path: '/',
            meta: { lang: 'en-US', title: 'Custom Home', description: 'Custom home page' },
            sections: [
              {
                type: 'section',
                props: { id: 'hero' },
                children: [{ type: 'heading', content: 'Custom Homepage' }],
              },
            ],
          },
        ],
      })

      // WHEN: user navigates to '/'
      await page.goto('/')

      // THEN: custom page renders (NOT DefaultHomePage)
      await expect(page).toHaveTitle('Custom Home')
      await expect(page.locator('[data-testid="page-custom-home"]')).toBeVisible()
      await expect(page.locator('section#hero h1')).toHaveText('Custom Homepage')

      // Verify DefaultHomePage is NOT rendered
      // THEN: assertion
      await expect(page.locator('[data-testid="app-name-heading"]')).toBeHidden()
    }
  )

  test(
    'APP-PAGES-PATH-014: DefaultHomePage does NOT render blocks',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app with blocks=[...] and NO '/' page
      await startServerWithSchema({
        name: 'my-app',
        version: '1.0.0',
        description: 'App with blocks',
        blocks: [
          {
            name: 'hero',
            type: 'section',
            children: [{ type: 'h1', content: 'Hero Block' }],
          },
          {
            name: 'cta',
            type: 'section',
            children: [{ type: 'button', content: 'CTA Button' }],
          },
        ],
      })

      // WHEN: DefaultHomePage is rendered
      await page.goto('/')

      // THEN: blocks are NOT rendered (only name/version/description shown)
      await expect(page.locator('[data-testid="app-name-heading"]')).toHaveText('my-app')
      await expect(page.locator('[data-testid="app-version-badge"]')).toHaveText('1.0.0')
      await expect(page.locator('[data-testid="app-description"]')).toHaveText('App with blocks')

      // CRITICAL: Verify blocks are NOT rendered (bug fix)
      // THEN: assertion
      await expect(page.locator('[data-block="hero"]')).toBeHidden()
      await expect(page.locator('[data-block="cta"]')).toBeHidden()
      await expect(page.locator('h1').filter({ hasText: 'Hero Block' })).toBeHidden()
      await expect(page.locator('button').filter({ hasText: 'CTA Button' })).toBeHidden()
    }
  )

  test(
    'APP-PAGES-PATH-015: Custom "/" page renders blocks from sections',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app with pages=[{path: '/', sections: [{block: 'hero'}]}]
      await startServerWithSchema({
        name: 'my-app',
        blocks: [
          {
            name: 'hero',
            type: 'section',
            children: [{ type: 'heading', content: '$title' }],
          },
        ],
        pages: [
          {
            name: 'custom_home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [{ block: 'hero', vars: { title: 'Welcome Home' } }],
          },
        ],
      })

      // WHEN: user navigates to '/'
      await page.goto('/')

      // THEN: custom page renders blocks from sections
      await expect(page).toHaveTitle('Home')
      await expect(page.locator('[data-testid="page-custom-home"]')).toBeVisible()
      await expect(page.locator('h1')).toHaveText('Welcome Home')

      // Verify DefaultHomePage is NOT rendered
      // THEN: assertion
      await expect(page.locator('[data-testid="app-name-heading"]')).toBeHidden()

      // Verify block rendered via sections (NOT from DefaultHomePage)
      // THEN: assertion
      await expect(page.locator('[data-block="hero"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-PATH-016: Custom 404 page renders when user defines page at /404 path',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app with custom 404 page at path '/404'
      await startServerWithSchema({
        name: 'my-app',
        pages: [
          { name: 'Home', path: '/', meta: { lang: 'en-US', title: 'Home' }, sections: [] },
          {
            name: 'Custom404',
            path: '/404',
            meta: { lang: 'en-US', title: 'Custom Not Found' },
            sections: [
              {
                type: 'section',
                children: [{ type: 'heading', content: 'Custom 404 Page' }],
              },
            ],
          },
        ],
      })

      // WHEN: user navigates to non-existent page
      await page.goto('/nonexistent')

      // THEN: custom 404 page renders (NOT default NotFoundPage)
      await expect(page).toHaveTitle('Custom Not Found')
      await expect(page.locator('h1')).toHaveText('Custom 404 Page')
    }
  )

  test(
    'APP-PAGES-PATH-017: Default NotFoundPage renders when no custom 404 page exists',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app WITHOUT custom 404 page
      await startServerWithSchema({
        name: 'my-app',
        pages: [{ name: 'Home', path: '/', meta: { lang: 'en-US', title: 'Home' }, sections: [] }],
      })

      // WHEN: user navigates to non-existent page
      await page.goto('/nonexistent')

      // THEN: default NotFoundPage renders
      await expect(page).toHaveTitle('404 - Not Found')
      await expect(page.locator('h1')).toHaveText('404')
    }
  )

  test(
    'APP-PAGES-PATH-018: Custom 500 page renders when user defines page at /500 path',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app with custom 500 page at path '/500'
      await startServerWithSchema({
        name: 'my-app',
        pages: [
          { name: 'Home', path: '/', meta: { lang: 'en-US', title: 'Home' }, sections: [] },
          {
            name: 'Custom500',
            path: '/500',
            meta: { lang: 'en-US', title: 'Custom Server Error' },
            sections: [
              {
                type: 'section',
                children: [{ type: 'heading', content: 'Custom 500 Page' }],
              },
            ],
          },
        ],
      })

      // WHEN: user navigates to custom error page directly (test endpoint)
      await page.goto('/500')

      // THEN: custom 500 page renders
      await expect(page).toHaveTitle('Custom Server Error')
      await expect(page.locator('h1')).toHaveText('Custom 500 Page')
    }
  )

  test(
    'APP-PAGES-PATH-019: Default ErrorPage renders when no custom 500 page exists',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app WITHOUT custom 500 page
      await startServerWithSchema({
        name: 'my-app',
        pages: [{ name: 'Home', path: '/', meta: { lang: 'en-US', title: 'Home' }, sections: [] }],
      })

      // WHEN: server error occurs (access test error endpoint in dev mode)
      await page.goto('/test/error')

      // THEN: default ErrorPage renders
      await expect(page).toHaveTitle('500 - Internal Server Error')
      await expect(page.locator('h1')).toHaveText('500')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-PATH-020: user can complete full path workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with various path patterns
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          { name: 'Home', path: '/', meta: { lang: 'en-US', title: 'Home' }, sections: [] },
          { name: 'About', path: '/about', meta: { lang: 'en-US', title: 'About' }, sections: [] },
          {
            name: 'Pricing',
            path: '/products/pricing',
            meta: { lang: 'en-US', title: 'Pricing' },
            sections: [],
          },
          { name: 'Team', path: '/our-team', meta: { lang: 'en-US', title: 'Team' }, sections: [] },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')
      // THEN: assertion
      await expect(page).toHaveURL('/')

      // WHEN: user navigates to the page
      await page.goto('/about')
      // THEN: assertion
      await expect(page).toHaveURL('/about')

      // WHEN: user navigates to the page
      await page.goto('/products/pricing')
      // THEN: assertion
      await expect(page).toHaveURL('/products/pricing')

      // WHEN: user navigates to the page
      await page.goto('/our-team')
      // THEN: assertion
      await expect(page).toHaveURL('/our-team')

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
