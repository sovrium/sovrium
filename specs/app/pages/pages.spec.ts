/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Pages
 *
 * Source: src/domain/models/app/pages.ts
 * Spec Count: 16
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (16 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Pages', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-001: should validate as pages array with minimum 1 item',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a pages array with single page
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home Page', description: 'Home page description' },
            sections: [],
          },
        ],
      })

      // WHEN: array contains one complete page configuration
      await page.goto('/')

      // THEN: it should validate as pages array with minimum 1 item
      await expect(page.locator('[data-testid="page-home"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-002: should validate with minimal configuration',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with required properties only
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'about',
            path: '/about',
            meta: { lang: 'en-US', title: 'About Us', description: 'About us page' },
            sections: [],
          },
        ],
      })

      // WHEN: page has name, path, meta, and sections
      await page.goto('/about')

      // THEN: it should validate with minimal configuration
      await expect(page).toHaveTitle('About Us')
      await expect(page.locator('[data-testid="page-about"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-003: should accept complete page configuration',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with all optional properties
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            id: 'homepage',
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Welcome', description: 'Welcome page' },
            sections: [],
            scripts: { features: { analytics: true } },
          },
        ],
      })

      // WHEN: page includes id and scripts
      await page.goto('/')

      // THEN: it should accept complete page configuration
      await expect(page.locator('[data-page-id="homepage"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-004: should accept root path for homepage',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with home path
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [],
          },
        ],
      })

      // WHEN: path is '/'
      await page.goto('/')

      // THEN: it should accept root path for homepage
      await expect(page).toHaveURL(/\/$/)
      await expect(page).toHaveTitle('Home')
    }
  )

  test(
    'APP-PAGES-005: should accept nested URL paths',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with nested path
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'pricing',
            path: '/products/pricing',
            meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing page' },
            sections: [],
          },
        ],
      })

      // WHEN: path is '/products/pricing'
      await page.goto('/products/pricing')

      // THEN: it should accept nested URL paths
      await expect(page).toHaveURL(/\/products\/pricing/)
      await expect(page).toHaveTitle('Pricing')
    }
  )

  test(
    'APP-PAGES-006: should support direct component definitions in sections',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with sections containing direct components
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'simple_page',
            path: '/simple',
            meta: { lang: 'en-US', title: 'Simple', description: 'Simple page' },
            sections: [
              {
                type: 'section',
                props: { id: 'hero' },
                children: [{ type: 'h1', props: {}, children: ['Welcome'] }],
              },
            ],
          },
        ],
      })

      // WHEN: sections has type, props, and children
      await page.goto('/simple')

      // THEN: it should support direct component definitions in sections
      await expect(page.locator('section#hero h1')).toHaveText('Welcome')
    }
  )

  test(
    'APP-PAGES-007: should support component references with $variable syntax',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with sections containing component references
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'hero',
            type: 'section',
            props: { id: 'hero' },
            children: [{ type: 'h1', children: ['$title'] }],
          },
        ],
        pages: [
          {
            name: 'landing',
            path: '/landing',
            meta: { lang: 'en-US', title: 'Landing', description: 'Landing page' },
            sections: [{ component: 'hero', vars: { title: 'Welcome to Our Platform' } }],
          },
        ],
      })

      // WHEN: sections references components with variable substitution
      await page.goto('/landing')

      // THEN: it should support component references with $variable syntax
      await expect(page.locator('section#hero h1')).toHaveText('Welcome to Our Platform')
    }
  )

  test(
    'APP-PAGES-009: should manage client-side scripts and features',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with scripts configuration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'interactive',
            path: '/interactive',
            meta: { lang: 'en-US', title: 'Interactive', description: 'Interactive page' },
            scripts: {
              features: { analytics: true, chatWidget: true },
              external: [{ src: 'https://cdn.example.com/script.js', async: true }],
            },
            sections: [],
          },
        ],
      })

      // WHEN: scripts includes features, external scripts, and config
      await page.goto('/interactive')

      // THEN: it should manage client-side scripts and features
      await expect(page.locator('script[src="https://cdn.example.com/script.js"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-010: should support multiple page configurations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: multiple pages in array
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [],
          },
          {
            name: 'about',
            path: '/about',
            meta: { lang: 'en-US', title: 'About', description: 'About page' },
            sections: [],
          },
          {
            name: 'pricing',
            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing page' },
            sections: [],
          },
          {
            name: 'contact',
            path: '/contact',
            meta: { lang: 'en-US', title: 'Contact', description: 'Contact page' },
            sections: [],
          },
        ],
      })

      // WHEN: pages array contains [homepage, about, pricing, contact]
      await page.goto('/')
      // THEN: assertion
      await expect(page).toHaveTitle('Home')
      // WHEN: user navigates to the page
      await page.goto('/about')
      // THEN: assertion
      await expect(page).toHaveTitle('About')
      // WHEN: user navigates to the page
      await page.goto('/pricing')
      // THEN: assertion
      await expect(page).toHaveTitle('Pricing')

      // THEN: it should support multiple page configurations
    }
  )

  test(
    'APP-PAGES-011: should enable component reusability across pages via $ref',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page supporting reusable components
      await startServerWithSchema({
        name: 'test-app',
        components: [
          { name: 'cta', type: 'section', children: [{ type: 'button', children: ['$label'] }] },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [{ component: 'cta', vars: { label: 'Get Started' } }],
          },
          {
            name: 'pricing',
            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing page' },
            sections: [{ component: 'cta', vars: { label: 'Buy Now' } }],
          },
        ],
      })

      // WHEN: components are defined at app level and referenced in sections
      await page.goto('/')
      // THEN: assertion
      await expect(page.locator('button')).toHaveText('Get Started')
      // WHEN: user navigates to the page
      await page.goto('/pricing')
      // THEN: assertion
      await expect(page.locator('button')).toHaveText('Buy Now')

      // THEN: it should enable component reusability across pages via $ref
    }
  )

  test(
    'APP-PAGES-012: should support complete metadata configuration beyond basic SEO',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with comprehensive metadata
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'product_page',
            path: '/product',
            meta: {
              lang: 'en-US',
              title: 'Amazing Product',
              description: 'The best product ever',
              openGraph: {
                title: 'Amazing Product',
                image: 'https://example.com/og-image.jpg',
              },
              twitterCard: {
                card: 'summary_large_image',
                image: 'https://example.com/twitter-image.jpg',
              },
              structuredData: {
                '@type': 'Product',
                name: 'Amazing Product',
                offers: { price: '99.99', priceCurrency: 'USD' },
              },
              analytics: { googleAnalytics: { id: 'G-XXXXXXXXXX' } },
            },
            sections: [],
          },
        ],
      })

      // WHEN: meta includes SEO, social, structured data, and analytics
      await page.goto('/product')

      // THEN: it should support complete metadata configuration beyond basic SEO
      await expect(page).toHaveTitle('Amazing Product')
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        'content',
        'Amazing Product'
      )
      // THEN: assertion
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image'
      )
    }
  )

  test(
    'APP-PAGES-013: should apply global theme to page elements without page-level theme config',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with theme integration
      await startServerWithSchema({
        name: 'test-app',
        theme: { colors: { primary: '#3B82F6', secondary: '#10B981' } },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [
              {
                type: 'section',
                props: { className: 'bg-primary text-white' },
                children: [
                  { type: 'h1', props: { className: 'font-sans' }, children: ['Welcome'] },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: page sections use app.theme colors, typography, and spacing via className
      await page.goto('/')

      // THEN: it should apply global theme to page elements without page-level theme config
      const section = page.locator('section')
      await expect(section).toHaveClass(/bg-primary/)
      await expect(section).toHaveCSS('background-color', 'rgb(59, 130, 246)')
    }
  )

  test(
    'APP-PAGES-014: should adapt page content based on selected language without page-level translations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with language integration
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', locale: 'en-US', label: 'English' },
            { code: 'fr', locale: 'fr-FR', label: 'Français' },
          ],
          translations: { en: { 'hero.title': 'Welcome' }, fr: { 'hero.title': 'Bienvenue' } },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [{ type: 'h1', children: ['$t:hero.title'] }],
          },
          {
            name: 'home_french',
            path: '/fr',
            meta: { lang: 'fr-FR', title: 'Accueil', description: 'Page accueil' },
            sections: [{ type: 'h1', children: ['$t:hero.title'] }],
          },
        ],
      })

      // WHEN: page uses app.languages for i18n with meta.lang and locale-specific content
      await page.goto('/')
      // THEN: assertion
      await expect(page.locator('h1')).toHaveText('Welcome')
      // WHEN: user navigates to the page
      await page.goto('/fr')
      // THEN: assertion
      await expect(page.locator('h1')).toHaveText('Bienvenue')

      // THEN: it should adapt page content based on selected language without page-level translations
    }
  )

  test(
    'APP-PAGES-015: should compose pages from reusable components without duplicating component definitions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with components integration
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'hero',
            type: 'section',
            children: [
              { type: 'h1', children: ['$title'] },
              { type: 'button', children: ['$cta'] },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [{ component: 'hero', vars: { title: 'Welcome', cta: 'Get Started' } }],
          },
          {
            name: 'pricing',
            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing page' },
            sections: [{ component: 'hero', vars: { title: 'Pricing', cta: 'Buy Now' } }],
          },
        ],
      })

      // WHEN: page sections reference app.components[] via $ref with $vars substitution
      await page.goto('/')
      // THEN: assertion
      await expect(page.locator('h1')).toHaveText('Welcome')
      await expect(page.locator('button')).toHaveText('Get Started')
      // WHEN: user navigates to the page
      await page.goto('/pricing')
      // THEN: assertion
      await expect(page.locator('h1')).toHaveText('Pricing')
      await expect(page.locator('button')).toHaveText('Buy Now')

      // THEN: it should compose pages from reusable components without duplicating component definitions
    }
  )

  test(
    'APP-PAGES-016: should support responsive design via className utilities without separate mobile pages',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with responsive integration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'responsive',
            path: '/responsive',
            meta: { lang: 'en-US', title: 'Responsive', description: 'Responsive page' },
            sections: [
              {
                type: 'section',
                props: { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
                children: [
                  {
                    type: 'div',
                    props: { className: 'text-sm md:text-base lg:text-lg' },
                    children: ['Responsive Text'],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: page adapts across mobile, tablet, and desktop viewports
      await page.goto('/responsive')

      // THEN: it should support responsive design via className utilities without separate mobile pages
      const section = page.locator('section')
      await expect(section).toHaveClass(/grid/)
      await expect(section).toHaveClass(/grid-cols-1/)
      await expect(section).toHaveClass(/md:grid-cols-2/)
    }
  )

  test(
    'APP-PAGES-017: should demonstrate end-to-end integration of all page-building features',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a complete app with pages, theme, components, languages, and responsive
      await startServerWithSchema({
        name: 'test-app',
        theme: { colors: { primary: '#3B82F6', secondary: '#10B981' } },
        languages: {
          default: 'en',
          supported: [
            { code: 'en', locale: 'en-US', label: 'English' },
            { code: 'fr', locale: 'fr-FR', label: 'Français' },
          ],
          translations: { en: { 'hero.title': 'Welcome' }, fr: { 'hero.title': 'Bienvenue' } },
        },
        components: [
          {
            name: 'hero',
            type: 'section',
            props: { className: 'bg-primary text-white py-12 md:py-20' },
            children: [
              {
                type: 'h1',
                props: { className: 'font-sans text-2xl md:text-4xl' },
                children: ['$title'],
              },
            ],
          },
        ],
        pages: [
          {
            name: 'home_english',
            path: '/',
            meta: { lang: 'en', title: 'Home', description: 'Home page' },
            sections: [{ component: 'hero', vars: { title: '$t:hero.title' } }],
          },
          {
            name: 'home_french',
            path: '/fr',
            meta: { lang: 'fr', title: 'Accueil', description: 'Page accueil' },
            sections: [{ component: 'hero', vars: { title: '$t:hero.title' } }],
          },
        ],
      })

      // WHEN: all systems work together in a full-stack configuration
      await page.goto('/')
      // THEN: assertion
      await expect(page.locator('section')).toHaveClass(/bg-primary/)
      await expect(page.locator('h1')).toHaveText('Welcome')
      // WHEN: user navigates to the page
      await page.goto('/fr')
      // THEN: assertion
      await expect(page.locator('h1')).toHaveText('Bienvenue')

      // THEN: it should demonstrate end-to-end integration of all page-building features
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-REGRESSION: user can complete full pages workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // OPTIMIZATION: Consolidated from 17 startServerWithSchema calls to 3
      // Group 1: Comprehensive multi-page with scripts, metadata - covers 001-006, 009-010, 012, 016
      // Group 2: Components with multiple pages - covers 007, 011, 015
      // Group 3: Theme + Languages + Components (integration) - covers 013, 014, 017

      // ============================================================================
      // GROUP 1: Comprehensive multi-page configuration
      // Covers tests: 001, 002, 003, 004, 005, 006, 009, 010, 012, 016
      // ============================================================================
      await test.step('Setup: Start server with comprehensive multi-page configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            // 001, 004, 010: home page (root path)
            {
              id: 'homepage',
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Home', description: 'Home page description' },
              sections: [],
              scripts: { features: { analytics: true } },
            },
            // 002, 010: about page
            {
              name: 'about',
              path: '/about',
              meta: { lang: 'en-US', title: 'About Us', description: 'About us page' },
              sections: [],
            },
            // 005: nested path
            {
              name: 'pricing',
              path: '/products/pricing',
              meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing page' },
              sections: [],
            },
            // 010: contact page
            {
              name: 'contact',
              path: '/contact',
              meta: { lang: 'en-US', title: 'Contact', description: 'Contact page' },
              sections: [],
            },
            // 006: direct sections with section#hero h1
            {
              name: 'simple_page',
              path: '/simple',
              meta: { lang: 'en-US', title: 'Simple', description: 'Simple page' },
              sections: [
                {
                  type: 'section',
                  props: { id: 'hero' },
                  children: [{ type: 'h1', props: {}, children: ['Welcome'] }],
                },
              ],
            },
            // 009: scripts (external)
            {
              name: 'interactive',
              path: '/interactive',
              meta: { lang: 'en-US', title: 'Interactive', description: 'Interactive page' },
              scripts: {
                features: { analytics: true, chatWidget: true },
                external: [{ src: 'https://cdn.example.com/script.js', async: true }],
              },
              sections: [],
            },
            // 012: complete metadata
            {
              name: 'product_page',
              path: '/product',
              meta: {
                lang: 'en-US',
                title: 'Amazing Product',
                description: 'The best product ever',
                openGraph: {
                  title: 'Amazing Product',
                  image: 'https://example.com/og-image.jpg',
                },
                twitterCard: {
                  card: 'summary_large_image',
                  image: 'https://example.com/twitter-image.jpg',
                },
                structuredData: {
                  '@type': 'Product',
                  name: 'Amazing Product',
                  offers: { price: '99.99', priceCurrency: 'USD' },
                },
                analytics: { googleAnalytics: { id: 'G-XXXXXXXXXX' } },
              },
              sections: [],
            },
            // 016: responsive design
            {
              name: 'responsive',
              path: '/responsive',
              meta: { lang: 'en-US', title: 'Responsive', description: 'Responsive page' },
              sections: [
                {
                  type: 'section',
                  props: { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'text-sm md:text-base lg:text-lg' },
                      children: ['Responsive Text'],
                    },
                  ],
                },
              ],
            },
          ],
        })
      })

      await test.step('APP-PAGES-001: Validates as pages array with minimum 1 item', async () => {
        await page.goto('/')
        await expect(page.locator('[data-testid="page-home"]')).toBeVisible()
      })

      await test.step('APP-PAGES-002: Validates with minimal configuration', async () => {
        await page.goto('/about')
        await expect(page).toHaveTitle('About Us')
        await expect(page.locator('[data-testid="page-about"]')).toBeVisible()
      })

      await test.step('APP-PAGES-003: Accepts complete page configuration', async () => {
        await page.goto('/')
        await expect(page.locator('[data-page-id="homepage"]')).toBeVisible()
      })

      await test.step('APP-PAGES-004: Accepts root path for homepage', async () => {
        await page.goto('/')
        await expect(page).toHaveURL(/\/$/)
        await expect(page).toHaveTitle('Home')
      })

      await test.step('APP-PAGES-005: Accepts nested URL paths', async () => {
        await page.goto('/products/pricing')
        await expect(page).toHaveURL(/\/products\/pricing/)
        await expect(page).toHaveTitle('Pricing')
      })

      await test.step('APP-PAGES-006: Supports direct component definitions in sections', async () => {
        await page.goto('/simple')
        await expect(page.locator('section#hero h1')).toHaveText('Welcome')
      })

      await test.step('APP-PAGES-009: Manages client-side scripts and features', async () => {
        await page.goto('/interactive')
        await expect(page.locator('script[src="https://cdn.example.com/script.js"]')).toBeAttached()
      })

      await test.step('APP-PAGES-010: Supports multiple page configurations', async () => {
        await page.goto('/')
        await expect(page).toHaveTitle('Home')
        await page.goto('/about')
        await expect(page).toHaveTitle('About Us')
        await page.goto('/products/pricing')
        await expect(page).toHaveTitle('Pricing')
      })

      await test.step('APP-PAGES-012: Supports complete metadata configuration beyond basic SEO', async () => {
        await page.goto('/product')
        await expect(page).toHaveTitle('Amazing Product')
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
          'content',
          'Amazing Product'
        )
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
          'content',
          'summary_large_image'
        )
      })

      await test.step('APP-PAGES-016: Supports responsive design via className utilities', async () => {
        await page.goto('/responsive')
        const section = page.locator('section')
        await expect(section).toHaveClass(/grid/)
        await expect(section).toHaveClass(/grid-cols-1/)
        await expect(section).toHaveClass(/md:grid-cols-2/)
      })

      // ============================================================================
      // GROUP 2: Components with multiple pages
      // Covers tests: 007, 011, 015
      // ============================================================================
      await test.step('Setup: Start server with components configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            // 007: hero component with $variable
            {
              name: 'hero',
              type: 'section',
              props: { id: 'hero' },
              children: [
                { type: 'h1', children: ['$title'] },
                { type: 'button', children: ['$cta'] },
              ],
            },
            // 011: cta component
            {
              name: 'cta',
              type: 'section',
              children: [{ type: 'button', children: ['$label'] }],
            },
          ],
          pages: [
            // 007: landing page with hero component
            {
              name: 'landing',
              path: '/landing',
              meta: { lang: 'en-US', title: 'Landing', description: 'Landing page' },
              sections: [
                {
                  component: 'hero',
                  vars: { title: 'Welcome to Our Platform', cta: 'Get Started' },
                },
              ],
            },
            // 011, 015: home with cta/hero components
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
              sections: [
                { component: 'cta', vars: { label: 'Get Started' } },
                { component: 'hero', vars: { title: 'Welcome', cta: 'Get Started' } },
              ],
            },
            // 011, 015: pricing with cta/hero components
            {
              name: 'pricing',
              path: '/pricing',
              meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing page' },
              sections: [
                { component: 'cta', vars: { label: 'Buy Now' } },
                { component: 'hero', vars: { title: 'Pricing', cta: 'Buy Now' } },
              ],
            },
          ],
        })
      })

      await test.step('APP-PAGES-007: Supports component references with $variable syntax', async () => {
        await page.goto('/landing')
        await expect(page.locator('section#hero h1')).toHaveText('Welcome to Our Platform')
      })

      await test.step('APP-PAGES-011: Enables component reusability across pages via $ref', async () => {
        await page.goto('/')
        await expect(page.locator('button').first()).toHaveText('Get Started')
        await page.goto('/pricing')
        await expect(page.locator('button').first()).toHaveText('Buy Now')
      })

      await test.step('APP-PAGES-015: Composes pages from reusable components', async () => {
        await page.goto('/')
        await expect(page.locator('h1')).toHaveText('Welcome')
        await expect(page.locator('button').last()).toHaveText('Get Started')
        await page.goto('/pricing')
        await expect(page.locator('h1')).toHaveText('Pricing')
        await expect(page.locator('button').last()).toHaveText('Buy Now')
      })

      // ============================================================================
      // GROUP 3: Theme + Languages + Components (integration test)
      // Covers tests: 013, 014, 017
      // ============================================================================
      await test.step('Setup: Start server with theme, languages, and components', async () => {
        await startServerWithSchema({
          name: 'test-app',
          theme: { colors: { primary: '#3B82F6', secondary: '#10B981' } },
          languages: {
            default: 'en',
            supported: [
              { code: 'en', locale: 'en-US', label: 'English' },
              { code: 'fr', locale: 'fr-FR', label: 'Français' },
            ],
            translations: { en: { 'hero.title': 'Welcome' }, fr: { 'hero.title': 'Bienvenue' } },
          },
          components: [
            {
              name: 'hero',
              type: 'section',
              props: { className: 'bg-primary text-white py-12 md:py-20' },
              children: [
                {
                  type: 'h1',
                  props: { className: 'font-sans text-2xl md:text-4xl' },
                  children: ['$title'],
                },
              ],
            },
          ],
          pages: [
            // 013: theme colors - page with bg-primary section
            {
              name: 'themed_home',
              path: '/themed',
              meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
              sections: [
                {
                  type: 'section',
                  props: { className: 'bg-primary text-white' },
                  children: [
                    { type: 'h1', props: { className: 'font-sans' }, children: ['Welcome'] },
                  ],
                },
              ],
            },
            // 014, 017: English home with translation
            {
              name: 'home_english',
              path: '/',
              meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
              sections: [{ component: 'hero', vars: { title: '$t:hero.title' } }],
            },
            // 014, 017: French home with translation
            {
              name: 'home_french',
              path: '/fr',
              meta: { lang: 'fr-FR', title: 'Accueil', description: 'Page accueil' },
              sections: [{ component: 'hero', vars: { title: '$t:hero.title' } }],
            },
          ],
        })
      })

      await test.step('APP-PAGES-013: Applies global theme to page elements', async () => {
        await page.goto('/themed')
        const section = page.locator('section')
        await expect(section).toHaveClass(/bg-primary/)
        await expect(section).toHaveCSS('background-color', 'rgb(59, 130, 246)')
      })

      await test.step('APP-PAGES-014: Adapts page content based on selected language', async () => {
        await page.goto('/')
        await expect(page.locator('h1')).toHaveText('Welcome')
        await page.goto('/fr')
        await expect(page.locator('h1')).toHaveText('Bienvenue')
      })

      await test.step('APP-PAGES-017: Demonstrates end-to-end integration of all page-building features', async () => {
        await page.goto('/')
        await expect(page.locator('section')).toHaveClass(/bg-primary/)
        await expect(page.locator('h1')).toHaveText('Welcome')
        await page.goto('/fr')
        await expect(page.locator('h1')).toHaveText('Bienvenue')
      })
    }
  )
})
