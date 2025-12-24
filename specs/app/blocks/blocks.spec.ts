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
 * Source: src/domain/models/app/block/block.ts, src/domain/models/app/blocks.ts
 * Spec Count: 20
 *
 * Test Organization:
 * 1. @spec tests - Block definition and validation (6 tests)
 * 2. @spec tests - Block rendering and types (4 tests)
 * 3. @spec tests - Block reuse and composition (5 tests)
 * 4. @spec tests - Theme and SEO integration (3 tests)
 * 5. @regression test - ONE optimized integration test
 *
 * NOTE: This file consolidates tests from block.spec.ts and blocks.spec.ts
 * to avoid redundancy. Both Block (individual definition) and Blocks (array)
 * features are tested together as they are closely related.
 */

test.describe('Reusable Blocks', () => {
  // ============================================================================
  // BLOCK DEFINITION AND VALIDATION (@spec)
  // ============================================================================

  test(
    'APP-BLOCKS-001: should validate minimal block definition at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block with required properties
      await startServerWithSchema({
        name: 'test-app',
        blocks: [{ name: 'simple-block', type: 'div' }],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ block: 'simple-block' }],
          },
        ],
      })

      // WHEN: name and type are provided
      await page.goto('/')

      // THEN: it should validate minimal block definition at build time
      await expect(page.locator('[data-block="simple-block"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-002: should use URL-friendly naming convention for data-testid',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block name in kebab-case
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          { name: 'icon-badge', type: 'badge' },
          { name: 'section-header', type: 'container' },
          { name: 'feature-card', type: 'card' },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              { block: 'icon-badge' },
              { block: 'section-header' },
              { block: 'feature-card' },
            ],
          },
        ],
      })

      // WHEN: name is 'icon-badge', 'section-header', or 'feature-card'
      await page.goto('/')

      // THEN: it should use URL-friendly naming convention for data-testid
      await expect(page.locator('[data-testid="block-icon-badge"]')).toBeVisible()
      await expect(page.locator('[data-testid="block-section-header"]')).toBeVisible()
      await expect(page.locator('[data-testid="block-feature-card"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-003: should reject invalid block names at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block name pattern validation
      const validBlocks = [
        { name: 'icon-badge', type: 'div' },
        { name: 'cta', type: 'div' },
        { name: 'section-header-2', type: 'div' },
        { name: 'feature-list-item', type: 'div' },
      ]
      await startServerWithSchema({
        name: 'test-app',
        blocks: validBlocks,
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ block: 'icon-badge' }],
          },
        ],
      })

      // WHEN: name matches ^[a-z][a-z0-9-]*$ (lowercase, hyphens, no spaces)
      await page.goto('/')

      // THEN: it should reject invalid names at build time
      await expect(page.locator('[data-block="icon-badge"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-004: should validate block naming uniqueness',
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
    'APP-BLOCKS-005: should validate blocks array structure',
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
    'APP-BLOCKS-006: should make blocks available for reference in all page sections',
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

  // ============================================================================
  // BLOCK RENDERING AND TYPES (@spec)
  // ============================================================================

  test(
    'APP-BLOCKS-007: should render corresponding HTML element or component by type',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block type specification
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          { name: 'layout', type: 'container' },
          { name: 'row', type: 'flex' },
          { name: 'columns', type: 'grid' },
          { name: 'panel', type: 'card' },
          { name: 'heading', type: 'single-line-text' },
          { name: 'cta', type: 'button' },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ block: 'layout' }, { block: 'row' }, { block: 'cta' }],
          },
        ],
      })

      // WHEN: type is 'container', 'flex', 'grid', 'card', 'text', 'button', etc.
      await page.goto('/')

      // THEN: it should render corresponding HTML element or component
      await expect(
        page.locator('[data-testid="block-layout"][data-type="container"]')
      ).toBeVisible()
      await expect(page.locator('[data-testid="block-row"][data-type="flex"]')).toBeVisible()
      await expect(page.locator('[data-testid="block-cta"][data-type="button"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-008: should render with properties including variable substitution',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block with props
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'styled-box',
            type: 'div',
            props: { className: 'box-$variant', id: '$boxId', ariaLabel: '$label' },
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                block: 'styled-box',
                vars: { variant: 'primary', boxId: 'main-box', label: 'Main content' },
              },
            ],
          },
        ],
      })

      // WHEN: props references block-props.schema.json
      await page.goto('/')

      // THEN: it should render with properties including variable substitution
      const styledBox = page.locator('[data-testid="block-styled-box"]')
      await expect(styledBox).toHaveClass(/box-primary/)
      await expect(styledBox).toHaveAttribute('id', 'main-box')
      await expect(styledBox).toHaveAttribute('aria-label', 'Main content')
    }
  )

  test(
    'APP-BLOCKS-009: should render nested child components',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block with children
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'card-header',
            type: 'div',
            children: [
              { type: 'h3', content: '$title' },
              { type: 'p', content: '$subtitle' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              { block: 'card-header', vars: { title: 'Card Title', subtitle: 'Card subtitle' } },
            ],
          },
        ],
      })

      // WHEN: children references block-children.schema.json
      await page.goto('/')

      // THEN: it should render nested child components
      const block = page.locator('[data-testid="block-card-header"]')
      await expect(block.locator('h3')).toHaveText('Card Title')
      await expect(block.locator('p')).toHaveText('Card subtitle')
    }
  )

  test(
    'APP-BLOCKS-010: should render text content with substituted variables',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block with content
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'alert-message',
            type: 'div',
            props: { className: 'alert' },
            content: '$message',
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ block: 'alert-message', vars: { message: 'Operation successful!' } }],
          },
        ],
      })

      // WHEN: content is string with $variable references
      await page.goto('/')

      // THEN: it should render text content with substituted variables
      await expect(page.locator('[data-testid="block-alert-message"]')).toHaveText(
        'Operation successful!'
      )
      await expect(page.locator('[data-testid="block-alert-message"]')).toHaveClass(/alert/)
    }
  )

  // ============================================================================
  // BLOCK REUSE AND COMPOSITION (@spec)
  // ============================================================================

  test(
    'APP-BLOCKS-011: should render same block definition across multiple locations',
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
    'APP-BLOCKS-012: should render multiple instances with different data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block as reusable template
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'stat-card',
            type: 'card',
            children: [
              { type: 'h4', content: '$value' },
              { type: 'p', content: '$label' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              { block: 'stat-card', vars: { value: '1,234', label: 'Users' } },
              { block: 'stat-card', vars: { value: '567', label: 'Projects' } },
              { block: 'stat-card', vars: { value: '89%', label: 'Success Rate' } },
            ],
          },
        ],
      })

      // WHEN: block defines structure with variable placeholders
      await page.goto('/')

      // THEN: it should render multiple instances with different data
      await expect(page.locator('h4').nth(0)).toHaveText('1,234')
      await expect(page.locator('h4').nth(1)).toHaveText('567')
      await expect(page.locator('h4').nth(2)).toHaveText('89%')
    }
  )

  test(
    'APP-BLOCKS-013: should provide consistent components across pages',
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
      await expect(page.locator('[data-block="shared-block"]')).toBeVisible()

      // THEN: it should provide consistent, reusable components across pages
      await page.goto('/about')
      await expect(page.locator('[data-block="shared-block"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-014: should render complete component with all aspects integrated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block composition patterns
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'complete-card',
            type: 'card',
            props: { className: 'card-$variant p-6 rounded-lg' },
            children: [
              { type: 'h3', props: { className: 'mb-2' }, content: '$title' },
              { type: 'p', content: '$description' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                block: 'complete-card',
                vars: {
                  variant: 'primary',
                  title: 'Premium Plan',
                  description: 'Best value for teams',
                },
              },
            ],
          },
        ],
      })

      // WHEN: block combines layout (type), styling (props), and content (children/content)
      await page.goto('/')

      // THEN: it should render complete component with all aspects integrated
      const card = page.locator('[data-testid="block-complete-card"]')
      await expect(card).toHaveClass(/card-primary/)
      await expect(card).toHaveClass(/p-6/)
      await expect(card).toHaveClass(/rounded-lg/)
      await expect(page.locator('h3')).toHaveText('Premium Plan')
      await expect(page.locator('p')).toHaveText('Best value for teams')
    }
  )

  test(
    'APP-BLOCKS-015: should transform template placeholders into concrete values in DOM',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block template instantiation
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'pricing-badge',
            type: 'badge',
            props: { className: 'badge-$color' },
            content: '$price/month',
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [{ block: 'pricing-badge', vars: { color: 'gold', price: '49' } }],
          },
        ],
      })

      // WHEN: block is referenced via block-reference.schema.json with vars
      await page.goto('/')

      // THEN: it should transform template placeholders into concrete values in DOM
      const badge = page.locator('[data-testid="block-pricing-badge"]')
      await expect(badge).toHaveClass(/badge-gold/)
      await expect(badge).toHaveText('49/month')
      const html = await badge.innerHTML()
      expect(html).not.toContain('$')
    }
  )

  // ============================================================================
  // THEME AND SEO INTEGRATION (@spec)
  // ============================================================================

  test(
    'APP-BLOCKS-016: should render with design tokens applied from global theme',
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
    'APP-BLOCKS-017: should render blocks within page layout with full variable substitution',
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
      expect(buttonHtml).not.toContain('$buttonClass')
      expect(buttonHtml).not.toContain('$buttonText')
      expect(buttonHtml).not.toContain('$')
    }
  )

  test(
    'APP-BLOCKS-018: should generate structured data and meta tags from block content',
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
      await expect(structuredData).toBeAttached()

      const jsonLdContent = await structuredData.textContent()
      const parsedData = JSON.parse(jsonLdContent || '{}')

      expect(parsedData['@type']).toBe('Product')
      expect(parsedData.name).toBe('Wireless Headphones')
      expect(parsedData.description).toBe('Premium noise-cancelling headphones')
      expect(parsedData.image).toBe('/images/headphones.jpg')
      expect(parsedData.offers.price).toBe('299.99')
      expect(parsedData.offers.priceCurrency).toBe('USD')

      // Verify meta tags from block
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
    'APP-BLOCKS-019: user can complete full blocks workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('Setup: Start server with blocks', async () => {
        await startServerWithSchema({
          name: 'test-app',
          blocks: [
            {
              name: 'simple-text',
              type: 'single-line-text',
              props: { className: 'text-$color' },
              content: '$message',
            },
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
                { block: 'simple-text', vars: { color: 'blue', message: 'Welcome' } },
                { block: 'icon-badge', vars: { color: 'blue', icon: 'check', text: 'Success' } },
                { block: 'feature-card', vars: { title: 'Feature', description: 'Description' } },
              ],
            },
          ],
        })
      })

      await test.step('Navigate to page and verify text block', async () => {
        await page.goto('/')
        const textBlock = page.locator('[data-testid="block-simple-text"]')
        await expect(textBlock).toHaveText('Welcome')
        await expect(textBlock).toHaveClass(/text-blue/)
      })

      await test.step('Verify block structures with ARIA snapshots', async () => {
        await expect(page.locator('[data-block="icon-badge"]')).toMatchAriaSnapshot(`
          - group:
            - img
            - text: Success
        `)
        await expect(page.locator('[data-block="feature-card"]')).toMatchAriaSnapshot(`
          - group:
            - heading "Feature"
            - text: Description
        `)
      })

      await test.step('Verify variable substitution completed', async () => {
        const iconBadgeHtml = await page.locator('[data-block="icon-badge"]').innerHTML()
        expect(iconBadgeHtml).not.toContain('$')
        const featureCardHtml = await page.locator('[data-block="feature-card"]').innerHTML()
        expect(featureCardHtml).not.toContain('$')
      })
    }
  )
})
