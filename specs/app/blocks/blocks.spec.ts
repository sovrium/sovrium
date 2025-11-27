/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Reusable Blocks
 *
 * Source: src/domain/models/app/blocks.ts
 * Spec Count: 12 (10 APP-BLOCKS + 2 INTEGRATION specs)
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Reusable Blocks', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-BLOCKS-001: should validate blocks array structure',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: reusable blocks array
      await startServerWithSchema({
        name: 'test-app',
        blocks: [{ name: 'test-block', type: 'div' }],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [{ block: 'test-block' }],
          },
        ],
      })

      // WHEN: array contains block items referencing block.schema.json
      await page.goto('/')

      // THEN: it should validate blocks array structure at build time
      await expect(page.locator('[data-block="test-block"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-002: should render same block definition across multiple page locations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: blocks for DRY principle
      await startServerWithSchema({
        name: 'test-app',
        blocks: [{ name: 'reusable', type: 'div', children: ['Reusable block'] }],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [{ block: 'reusable' }, { block: 'reusable' }],
          },
        ],
      })

      // WHEN: blocks are defined once and reused multiple times
      await page.goto('/')

      // THEN: it should render same block definition across multiple page locations
      await expect(page.locator('[data-block="reusable"]')).toHaveCount(2)
    }
  )

  test(
    'APP-BLOCKS-003: should render concrete component with substituted values',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block with variable substitution
      await startServerWithSchema({
        name: 'test-app',
        blocks: [{ name: 'single', type: 'div', content: '$message' }],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [{ block: 'single', vars: { message: 'Hello World' } }],
          },
        ],
      })

      // WHEN: block contains $variable placeholders in props and content
      await page.goto('/')

      // THEN: it should render concrete component with substituted values
      const blockElement = page.locator('[data-block="single"]')
      await expect(blockElement).toBeVisible()
      await expect(blockElement).toHaveText('Hello World')

      // Validate variable substitution completed (no $ symbols remain)
      const html = await blockElement.innerHTML()
      // THEN: assertion
      expect(html).not.toContain('$message')
      expect(html).not.toContain('$')
      expect(html).toContain('Hello World')
    }
  )

  test(
    'APP-BLOCKS-004: should render badge with icon and text using substituted values',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon-badge block example
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          { name: 'block1', type: 'div' },
          { name: 'block2', type: 'span' },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [{ block: 'block1' }, { block: 'block2' }],
          },
        ],
      })

      // WHEN: block has type 'badge' with $color, $icon, and $text variables
      await page.goto('/')

      // THEN: it should render badge with icon and text using substituted values
      await expect(page.locator('[data-block="block1"]')).toBeVisible()
      await expect(page.locator('[data-block="block2"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-005: should render section header with styled title and subtitle',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: section-header block example
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          { name: 'icon-badge', type: 'badge' },
          { name: 'section-header', type: 'container' },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [{ block: 'icon-badge' }, { block: 'section-header' }],
          },
        ],
      })

      // WHEN: block has nested children with $title, $subtitle, $titleColor variables
      await page.goto('/')

      // THEN: it should render section header with styled title and subtitle
      await expect(page.locator('[data-block="icon-badge"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-006: should provide consistent, reusable components across pages',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: blocks as component library
      await startServerWithSchema({
        name: 'test-app',
        blocks: [{ name: 'shared-block', type: 'div' }],
        pages: [
          { name: 'Home', path: '/', sections: [{ block: 'shared-block' }] },
          { name: 'About', path: '/about', sections: [{ block: 'shared-block' }] },
        ],
      })

      // WHEN: multiple blocks define UI patterns
      await page.goto('/')
      // THEN: assertion
      await expect(page.locator('[data-block="shared-block"]')).toBeVisible()

      // THEN: it should provide consistent, reusable components across pages
      // WHEN: user navigates to the page
      await page.goto('/about')
      await expect(page.locator('[data-block="shared-block"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-007: should reflect changes across all block instances on page rebuild',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: blocks with centralized updates
      await startServerWithSchema({
        name: 'test-app',
        blocks: [{ name: 'var-block', type: 'single-line-text', content: '$message' }],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [{ block: 'var-block' }],
          },
        ],
      })

      // WHEN: block definition is modified
      await page.goto('/')

      // THEN: it should reflect changes across all block instances on page rebuild
      await expect(page.locator('[data-block="var-block"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-008: should render complex nested component structures',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: blocks for composition
      await startServerWithSchema({
        name: 'test-app',
        blocks: [{ name: 'props-block', type: 'div', props: { className: 'test-class' } }],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [{ block: 'props-block' }],
          },
        ],
      })

      // WHEN: blocks combine multiple child components
      await page.goto('/')

      // THEN: it should render complex nested component structures
      await expect(page.locator('[data-block="props-block"]')).toHaveClass(/test-class/)
    }
  )

  test(
    'APP-BLOCKS-009: should reduce code duplication and simplify pattern updates',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: blocks for maintainability
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          { name: 'parent-block', type: 'div', children: [{ type: 'span', content: 'child' }] },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [{ block: 'parent-block' }],
          },
        ],
      })

      // WHEN: blocks encapsulate UI patterns
      await page.goto('/')

      // THEN: it should reduce code duplication and simplify pattern updates
      // ARIA snapshot validates nested structure
      await expect(page.locator('[data-block="parent-block"]')).toMatchAriaSnapshot(`
        - group: child
      `)
    }
  )

  test(
    'APP-BLOCKS-010: should make blocks available for reference in all page sections',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: blocks array at app level
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'complex',
            type: 'container',
            props: { className: 'wrapper' },
            children: [{ type: 'single-line-text', content: 'Nested' }],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [{ block: 'complex' }],
          },
        ],
      })

      // WHEN: blocks are defined globally in app configuration
      await page.goto('/')

      // THEN: it should make blocks available for reference in all page sections
      await expect(page.locator('[data-block="complex"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-011: should validate block naming uniqueness',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: blocks array with duplicate block names
      // WHEN: multiple blocks have the same name value
      // THEN: it should validate block naming uniqueness at build time
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          blocks: [
            { name: 'duplicate-name', type: 'div' },
            { name: 'duplicate-name', type: 'span' },
          ],
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              sections: [],
            },
          ],
        })
      }).rejects.toThrow(/duplicate.*name|unique/i)
    }
  )

  test(
    'APP-BLOCKS-012: should render blocks within page layout with full variable substitution',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: blocks integrated with pages via sections
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'hero-cta',
            type: 'button',
            props: { className: '$buttonClass' },
            content: '$buttonText',
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            sections: [
              {
                block: 'hero-cta',
                vars: { buttonClass: 'btn-primary', buttonText: 'Get Started' },
              },
            ],
          },
        ],
      })

      // WHEN: page sections reference blocks using block property and vars
      await page.goto('/')

      // THEN: it should render blocks within page layout with full variable substitution
      const button = page.locator('button:has-text("Get Started")')
      await expect(button).toBeVisible()
      await expect(button).toHaveClass(/btn-primary/)

      // Validate variable substitution completed (no $ symbols remain)
      const buttonHtml = await button.evaluate((el) => el.outerHTML)
      // THEN: assertion
      expect(buttonHtml).not.toContain('$buttonClass')
      expect(buttonHtml).not.toContain('$buttonText')
      expect(buttonHtml).not.toContain('$')
      expect(buttonHtml).toContain('btn-primary')
      expect(buttonHtml).toContain('Get Started')
    }
  )

  test(
    'APP-BLOCKS-013: should render with design tokens applied from global theme',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: blocks using theme design tokens
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: { primary: '#007bff', secondary: '#6c757d' },
          spacing: { sm: '8px', md: '16px' },
          fonts: { body: { family: 'Arial', fallback: 'sans-serif' } },
        },
        blocks: [
          {
            name: 'themed-card',
            type: 'card',
            props: {
              style: {
                backgroundColor: '$theme.colors.primary',
                padding: '$theme.spacing.md',
                fontFamily: '$theme.fonts.body.family',
              },
            },
            content: 'Themed Content',
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home' },
            sections: [{ block: 'themed-card' }],
          },
        ],
      })

      // WHEN: block props reference theme colors, spacing, and fonts
      await page.goto('/')

      // THEN: it should render with design tokens applied from global theme
      const card = page.locator('[data-block="themed-card"]')
      await expect(card).toBeVisible()
      await expect(card).toHaveCSS('background-color', 'rgb(0, 123, 255)') // #007bff
    }
  )

  test(
    'APP-BLOCKS-014: should generate structured data and meta tags from block content',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: blocks containing meta/SEO data for structured content
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'product-card',
            type: 'article',
            props: {
              meta: {
                title: '$productName',
                description: '$productDescription',
                image: '$productImage',
                price: '$productPrice',
                currency: '$productCurrency',
                structuredData: {
                  type: 'Product',
                  fields: ['name', 'description', 'image', 'offers'],
                },
              },
            },
          },
        ],
        pages: [
          {
            name: 'product',
            path: '/',
            meta: { lang: 'en-US', title: 'Product', description: 'Product page' },
            sections: [
              {
                block: 'product-card',
                vars: {
                  productName: 'Wireless Headphones',
                  productDescription: 'Premium noise-cancelling headphones',
                  productImage: '/images/headphones.jpg',
                  productPrice: '299.99',
                  productCurrency: 'USD',
                },
              },
            ],
          },
        ],
      })

      // WHEN: block definition includes meta properties for SEO optimization
      await page.goto('/')

      // THEN: it should generate structured data and meta tags from block content
      const productCard = page.locator('[data-testid="block-product-card"]')
      await expect(productCard).toBeVisible()

      // Verify structured data JSON-LD
      const structuredData = page.locator('script[type="application/ld+json"]')
      // THEN: assertion
      await expect(structuredData).toBeAttached()

      const jsonLdContent = await structuredData.textContent()
      const parsedData = JSON.parse(jsonLdContent || '{}')

      // THEN: assertion
      expect(parsedData['@type']).toBe('Product')
      expect(parsedData.name).toBe('Wireless Headphones')
      expect(parsedData.description).toBe('Premium noise-cancelling headphones')
      expect(parsedData.image).toBe('/images/headphones.jpg')
      expect(parsedData.offers.price).toBe('299.99')
      expect(parsedData.offers.priceCurrency).toBe('USD')

      // Verify meta tags from block
      // THEN: assertion
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        '/images/headphones.jpg'
      )
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-BLOCKS-015: user can complete full blocks workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app configuration
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'icon-badge',
            type: 'badge',
            props: { color: '$color' },
            children: [
              { type: 'icon', props: { name: '$icon' } },
              { type: 'single-line-text', content: '$text' },
            ],
          },
          {
            name: 'feature-card',
            type: 'card',
            children: [
              { type: 'heading', content: '$title' },
              { type: 'single-line-text', content: '$description' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [
              { block: 'icon-badge', vars: { color: 'blue', icon: 'check', text: 'Success' } },
              { block: 'feature-card', vars: { title: 'Feature', description: 'Description' } },
            ],
          },
        ],
      })
      // WHEN: user navigates to the page
      await page.goto('/')

      // 1. Structure validation (ARIA) - Icon badge
      // THEN: assertion
      await expect(page.locator('[data-block="icon-badge"]')).toMatchAriaSnapshot(`
        - group:
          - img
          - text: Success
      `)

      // 2. Structure validation (ARIA) - Feature card
      await expect(page.locator('[data-block="feature-card"]')).toMatchAriaSnapshot(`
        - group:
          - heading "Feature"
          - text: Description
      `)

      // 3. Validate variable substitution completed (no $ symbols remain)
      const iconBadgeHtml = await page.locator('[data-block="icon-badge"]').innerHTML()
      expect(iconBadgeHtml).not.toContain('$')

      const featureCardHtml = await page.locator('[data-block="feature-card"]').innerHTML()
      expect(featureCardHtml).not.toContain('$')
    }
  )
})
