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
 * Source: specs/app/pages/pages.schema.json
 * Spec Count: 17
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (17 tests) - Exhaustive acceptance criteria
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
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Welcome', description: 'Welcome page' },
            layout: { navigation: { logo: '/logo.svg' } },
            sections: [],
            scripts: { features: { analytics: true } },
          },
        ],
      })

      // WHEN: page includes id, layout, and scripts
      await page.goto('/')

      // THEN: it should accept complete page configuration
      await expect(page.locator('[data-page-id="homepage"]')).toBeVisible()
      await expect(page.locator('[data-testid="navigation"]')).toBeVisible()
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
            name: 'products_pricing',

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
            name: 'simple',

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
    'APP-PAGES-007: should support block references with $variable syntax',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with sections containing block references
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
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
            name: 'landing',

            path: '/landing',
            meta: { lang: 'en-US', title: 'Landing', description: 'Landing page' },
            sections: [{ block: 'hero', vars: { title: 'Welcome to Our Platform' } }],
          },
        ],
      })

      // WHEN: sections references blocks with variable substitution
      await page.goto('/landing')

      // THEN: it should support block references with $variable syntax
      await expect(page.locator('section#hero h1')).toHaveText('Welcome to Our Platform')
    }
  )

  test(
    'APP-PAGES-008: should orchestrate global layout components',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with layout configuration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'full_layout',
            name: 'full',

            path: '/full',
            meta: { lang: 'en-US', title: 'Full Layout', description: 'Full layout page' },
            layout: {
              banner: { message: 'New feature available!' },
              navigation: { logo: '/logo.svg' },
              footer: { copyright: '© 2025 Company' },
              sidebar: { position: 'left' },
            },
            sections: [],
          },
        ],
      })

      // WHEN: layout includes navigation, banner, footer, and sidebar
      await page.goto('/full')

      // THEN: it should orchestrate global layout components
      // ARIA snapshot validates complete page structure
      await expect(page.locator('body')).toMatchAriaSnapshot(`
        - banner:
          - paragraph: New feature available!
        - navigation:
          - link "Logo":
            - /url: /
            - img "Logo"
        - complementary
        - main
        - contentinfo: © 2025 Company
      `)
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
            name: 'interactive',

            path: '/interactive',
            meta: { lang: 'en-US', title: 'Interactive', description: 'Interactive page' },
            scripts: {
              features: { analytics: true, chatWidget: true },
              external: [{ src: 'https://cdn.example.com/script.js', async: true }],
              config: { apiKey: 'abc123' },
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
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [],
          },
          {
            name: 'about',
            name: 'about',

            path: '/about',
            meta: { lang: 'en-US', title: 'About', description: 'About page' },
            sections: [],
          },
          {
            name: 'pricing',
            name: 'pricing',

            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing page' },
            sections: [],
          },
          {
            name: 'contact',
            name: 'contact',

            path: '/contact',
            meta: { lang: 'en-US', title: 'Contact', description: 'Contact page' },
            sections: [],
          },
        ],
      })

      // WHEN: pages array contains [homepage, about, pricing, contact]
      await page.goto('/')
      await expect(page).toHaveTitle('Home')
      await page.goto('/about')
      await expect(page).toHaveTitle('About')
      await page.goto('/pricing')
      await expect(page).toHaveTitle('Pricing')

      // THEN: it should support multiple page configurations
    }
  )

  test(
    'APP-PAGES-011: should enable block reusability across pages via $ref',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page supporting reusable blocks
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          { name: 'cta', type: 'section', children: [{ type: 'button', children: ['$label'] }] },
        ],
        pages: [
          {
            name: 'home',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [{ block: 'cta', vars: { label: 'Get Started' } }],
          },
          {
            name: 'pricing',
            name: 'pricing',

            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing page' },
            sections: [{ block: 'cta', vars: { label: 'Buy Now' } }],
          },
        ],
      })

      // WHEN: blocks are defined at app level and referenced in sections
      await page.goto('/')
      await expect(page.locator('button')).toHaveText('Get Started')
      await page.goto('/pricing')
      await expect(page.locator('button')).toHaveText('Buy Now')

      // THEN: it should enable block reusability across pages via $ref
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
            name: 'product',

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
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image'
      )
    }
  )

  test(
    'APP-PAGES-INTEGRATION-001: should apply global theme to page elements without page-level theme config',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with theme integration
      await startServerWithSchema({
        name: 'test-app',
        theme: { colors: { primary: '#3B82F6', secondary: '#10B981' } },
        pages: [
          {
            name: 'home',
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
    'APP-PAGES-INTEGRATION-002: should adapt page content based on selected language without page-level translations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with language integration
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', label: 'English' },
            { code: 'fr', label: 'Français' },
          ],
          translations: { en: { 'hero.title': 'Welcome' }, fr: { 'hero.title': 'Bienvenue' } },
        },
        pages: [
          {
            name: 'home',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [{ type: 'h1', children: ['$t:hero.title'] }],
          },
          {
            name: 'home_french',
            name: 'fr',

            path: '/fr',
            meta: { lang: 'fr-FR', title: 'Accueil', description: 'Page accueil' },
            sections: [{ type: 'h1', children: ['$t:hero.title'] }],
          },
        ],
      })

      // WHEN: page uses app.languages for i18n with meta.lang and locale-specific content
      await page.goto('/')
      await expect(page.locator('h1')).toHaveText('Welcome')
      await page.goto('/fr')
      await expect(page.locator('h1')).toHaveText('Bienvenue')

      // THEN: it should adapt page content based on selected language without page-level translations
    }
  )

  test(
    'APP-PAGES-INTEGRATION-003: should compose pages from reusable blocks without duplicating block definitions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with blocks integration
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
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
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [{ block: 'hero', vars: { title: 'Welcome', cta: 'Get Started' } }],
          },
          {
            name: 'pricing',
            name: 'pricing',

            path: '/pricing',
            meta: { lang: 'en-US', title: 'Pricing', description: 'Pricing page' },
            sections: [{ block: 'hero', vars: { title: 'Pricing', cta: 'Buy Now' } }],
          },
        ],
      })

      // WHEN: page sections reference app.blocks[] via $ref with $vars substitution
      await page.goto('/')
      await expect(page.locator('h1')).toHaveText('Welcome')
      await expect(page.locator('button')).toHaveText('Get Started')
      await page.goto('/pricing')
      await expect(page.locator('h1')).toHaveText('Pricing')
      await expect(page.locator('button')).toHaveText('Buy Now')

      // THEN: it should compose pages from reusable blocks without duplicating block definitions
    }
  )

  test(
    'APP-PAGES-INTEGRATION-004: should support responsive design via className utilities without separate mobile pages',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a page with responsive integration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'responsive',
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

      // WHEN: page layout adapts across mobile, tablet, and desktop viewports
      await page.goto('/responsive')

      // THEN: it should support responsive design via className utilities without separate mobile pages
      const section = page.locator('section')
      await expect(section).toHaveClass(/grid/)
      await expect(section).toHaveClass(/grid-cols-1/)
      await expect(section).toHaveClass(/md:grid-cols-2/)
    }
  )

  test(
    'APP-PAGES-INTEGRATION-005: should demonstrate end-to-end integration of all page-building features',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a complete app with pages, theme, blocks, languages, and responsive
      await startServerWithSchema({
        name: 'test-app',
        theme: { colors: { primary: '#3B82F6', secondary: '#10B981' } },
        languages: {
          default: 'en',
          supported: [
            { code: 'en', label: 'English' },
            { code: 'fr', label: 'Français' },
          ],
          translations: { en: { 'hero.title': 'Welcome' }, fr: { 'hero.title': 'Bienvenue' } },
        },
        blocks: [
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
            name: 'home',

            path: '/',
            meta: { lang: 'en', title: 'Home', description: 'Home page' },
            sections: [{ block: 'hero', vars: { title: '$t:hero.title' } }],
          },
          {
            name: 'home_french',
            name: 'fr',

            path: '/fr',
            meta: { lang: 'fr', title: 'Accueil', description: 'Page accueil' },
            sections: [{ block: 'hero', vars: { title: '$t:hero.title' } }],
          },
        ],
      })

      // WHEN: all systems work together in a full-stack configuration
      await page.goto('/')
      await expect(page.locator('section')).toHaveClass(/bg-primary/)
      await expect(page.locator('h1')).toHaveText('Welcome')
      await page.goto('/fr')
      await expect(page.locator('h1')).toHaveText('Bienvenue')

      // THEN: it should demonstrate end-to-end integration of all page-building features
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-REGRESSION-001: user can complete full pages workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with complete page system
      await startServerWithSchema({
        name: 'test-app',
        theme: { colors: { primary: '#3B82F6' } },
        blocks: [
          { name: 'cta', type: 'section', children: [{ type: 'button', children: ['$label'] }] },
        ],
        pages: [
          {
            name: 'home',
            name: 'home',

            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            sections: [{ block: 'cta', vars: { label: 'Get Started' } }],
          },
          {
            name: 'about',
            name: 'about',

            path: '/about',
            meta: { lang: 'en-US', title: 'About', description: 'About page' },
            layout: { navigation: { logo: '/logo.svg' } },
            sections: [],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points

      // 1. Home page structure validation
      await page.goto('/')

      await expect(page.locator('body')).toMatchAriaSnapshot(`
        - main:
          - region:
            - button "Get Started"
      `)

      await expect(page).toHaveTitle('Home')

      // 2. About page with navigation
      await page.goto('/about')

      await expect(page.locator('body')).toMatchAriaSnapshot(`
        - navigation:
          - link:
            - img "Logo"
        - main
      `)

      await expect(page).toHaveTitle('About')

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
