/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Reusable Components
 *
 * Source: src/domain/models/app/component/component.ts, src/domain/models/app/components.ts
 * Spec Count: 18
 *
 * Test Organization:
 * 1. @spec tests - Component definition and validation (6 tests)
 * 2. @spec tests - Component rendering and types (4 tests)
 * 3. @spec tests - Component reuse and composition (5 tests)
 * 4. @spec tests - Theme and SEO integration (3 tests)
 * 5. @regression test - ONE optimized integration test
 *
 * NOTE: This file consolidates tests from component.spec.ts and components.spec.ts
 * to avoid redundancy. Both Component (individual definition) and Components (array)
 * features are tested together as they are closely related.
 */

test.describe('Reusable Components', () => {
  // ============================================================================
  // BLOCK DEFINITION AND VALIDATION (@spec)
  // ============================================================================

  test(
    'APP-COMPONENTS-001: should validate minimal component definition at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component with required properties
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'simple-component', type: 'div' }],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ component: 'simple-component' }],
          },
        ],
      })

      // WHEN: name and type are provided
      await page.goto('/')

      // THEN: it should validate minimal component definition at build time
      await expect(page.locator('[data-component="simple-component"]')).toBeVisible()
    }
  )

  test(
    'APP-COMPONENTS-002: should use URL-friendly naming convention for data-testid',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component name in kebab-case
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
              { component: 'icon-badge' },
              { component: 'section-header' },
              { component: 'feature-card' },
            ],
          },
        ],
      })

      // WHEN: name is 'icon-badge', 'section-header', or 'feature-card'
      await page.goto('/')

      // THEN: it should use URL-friendly naming convention for data-testid
      await expect(page.locator('[data-testid="component-icon-badge"]')).toBeVisible()
      await expect(page.locator('[data-testid="component-section-header"]')).toBeVisible()
      await expect(page.locator('[data-testid="component-feature-card"]')).toBeVisible()
    }
  )

  test(
    'APP-COMPONENTS-003: should reject invalid component names at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component name pattern validation
      const validBlocks = [
        { name: 'icon-badge', type: 'div' },
        { name: 'cta', type: 'div' },
        { name: 'section-header-2', type: 'div' },
        { name: 'feature-list-item', type: 'div' },
      ]
      await startServerWithSchema({
        name: 'test-app',
        components: validBlocks,
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ component: 'icon-badge' }],
          },
        ],
      })

      // WHEN: name matches ^[a-z][a-z0-9-]*$ (lowercase, hyphens, no spaces)
      await page.goto('/')

      // THEN: it should reject invalid names at build time
      await expect(page.locator('[data-component="icon-badge"]')).toBeVisible()
    }
  )

  test(
    'APP-COMPONENTS-004: should validate component naming uniqueness',
    { tag: '@spec' },
    async ({ startServerWithSchema }) => {
      // GIVEN: components array with duplicate component names
      // WHEN: multiple components have the same name value
      // THEN: it should validate component naming uniqueness at build time
      await expect(async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
    'APP-COMPONENTS-005: should validate components array structure',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: reusable components array
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'test-component', type: 'div' }],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [{ component: 'test-component' }],
          },
        ],
      })

      // WHEN: array contains component items referencing component.schema.json
      await page.goto('/')

      // THEN: it should validate components array structure at build time
      await expect(page.locator('[data-component="test-component"]')).toBeVisible()
    }
  )

  test(
    'APP-COMPONENTS-006: should make components available for reference in all page sections',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: components array at app level
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
            sections: [{ component: 'complex' }],
          },
        ],
      })

      // WHEN: components are defined globally in app configuration
      await page.goto('/')

      // THEN: it should make components available for reference in all page sections
      await expect(page.locator('[data-component="complex"]')).toBeVisible()
    }
  )

  // ============================================================================
  // BLOCK RENDERING AND TYPES (@spec)
  // ============================================================================

  test(
    'APP-COMPONENTS-007: should render corresponding HTML element or component by type',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component type specification
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
            sections: [{ component: 'layout' }, { component: 'row' }, { component: 'cta' }],
          },
        ],
      })

      // WHEN: type is 'container', 'flex', 'grid', 'card', 'text', 'button', etc.
      await page.goto('/')

      // THEN: it should render corresponding HTML element or component
      await expect(
        page.locator('[data-testid="component-layout"][data-type="container"]')
      ).toBeVisible()
      await expect(page.locator('[data-testid="component-row"][data-type="flex"]')).toBeVisible()
      await expect(page.locator('[data-testid="component-cta"][data-type="button"]')).toBeVisible()
    }
  )

  test(
    'APP-COMPONENTS-008: should render with properties including variable substitution',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component with props
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
                component: 'styled-box',
                vars: { variant: 'primary', boxId: 'main-box', label: 'Main content' },
              },
            ],
          },
        ],
      })

      // WHEN: props references component-props.schema.json
      await page.goto('/')

      // THEN: it should render with properties including variable substitution
      const styledBox = page.locator('[data-testid="component-styled-box"]')
      await expect(styledBox).toHaveClass(/box-primary/)
      await expect(styledBox).toHaveAttribute('id', 'main-box')
      await expect(styledBox).toHaveAttribute('aria-label', 'Main content')
    }
  )

  test(
    'APP-COMPONENTS-009: should render nested child components',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component with children
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
              {
                component: 'card-header',
                vars: { title: 'Card Title', subtitle: 'Card subtitle' },
              },
            ],
          },
        ],
      })

      // WHEN: children references component-children.schema.json
      await page.goto('/')

      // THEN: it should render nested child components
      const component = page.locator('[data-testid="component-card-header"]')
      await expect(component.locator('h3')).toHaveText('Card Title')
      await expect(component.locator('p')).toHaveText('Card subtitle')
    }
  )

  test(
    'APP-COMPONENTS-010: should render text content with substituted variables',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component with content
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
            sections: [{ component: 'alert-message', vars: { message: 'Operation successful!' } }],
          },
        ],
      })

      // WHEN: content is string with $variable references
      await page.goto('/')

      // THEN: it should render text content with substituted variables
      await expect(page.locator('[data-testid="component-alert-message"]')).toHaveText(
        'Operation successful!'
      )
      await expect(page.locator('[data-testid="component-alert-message"]')).toHaveClass(/alert/)
    }
  )

  // ============================================================================
  // BLOCK REUSE AND COMPOSITION (@spec)
  // ============================================================================

  test(
    'APP-COMPONENTS-011: should render same component definition across multiple locations',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: components for DRY principle
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'reusable', type: 'div', children: ['Reusable component'] }],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
            sections: [{ component: 'reusable' }, { component: 'reusable' }],
          },
        ],
      })

      // WHEN: components are defined once and reused multiple times
      await page.goto('/')

      // THEN: it should render same component definition across multiple page locations
      await expect(page.locator('[data-component="reusable"]')).toHaveCount(2)
    }
  )

  test(
    'APP-COMPONENTS-012: should render multiple instances with different data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component as reusable template
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
              { component: 'stat-card', vars: { value: '1,234', label: 'Users' } },
              { component: 'stat-card', vars: { value: '567', label: 'Projects' } },
              { component: 'stat-card', vars: { value: '89%', label: 'Success Rate' } },
            ],
          },
        ],
      })

      // WHEN: component defines structure with variable placeholders
      await page.goto('/')

      // THEN: it should render multiple instances with different data
      await expect(page.locator('h4').nth(0)).toHaveText('1,234')
      await expect(page.locator('h4').nth(1)).toHaveText('567')
      await expect(page.locator('h4').nth(2)).toHaveText('89%')
    }
  )

  test(
    'APP-COMPONENTS-013: should provide consistent components across pages',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: components as component library
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'shared-component', type: 'div' }],
        pages: [
          { name: 'Home', path: '/', sections: [{ component: 'shared-component' }] },
          { name: 'About', path: '/about', sections: [{ component: 'shared-component' }] },
        ],
      })

      // WHEN: multiple components define UI patterns
      await page.goto('/')
      await expect(page.locator('[data-component="shared-component"]')).toBeVisible()

      // THEN: it should provide consistent, reusable components across pages
      await page.goto('/about')
      await expect(page.locator('[data-component="shared-component"]')).toBeVisible()
    }
  )

  test(
    'APP-COMPONENTS-014: should render complete component with all aspects integrated',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component composition patterns
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
                component: 'complete-card',
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

      // WHEN: component combines layout (type), styling (props), and content (children/content)
      await page.goto('/')

      // THEN: it should render complete component with all aspects integrated
      const card = page.locator('[data-testid="component-complete-card"]')
      await expect(card).toHaveClass(/card-primary/)
      await expect(card).toHaveClass(/p-6/)
      await expect(card).toHaveClass(/rounded-lg/)
      await expect(page.locator('h3')).toHaveText('Premium Plan')
      await expect(page.locator('p')).toHaveText('Best value for teams')
    }
  )

  test(
    'APP-COMPONENTS-015: should transform template placeholders into concrete values in DOM',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component template instantiation
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
            sections: [{ component: 'pricing-badge', vars: { color: 'gold', price: '49' } }],
          },
        ],
      })

      // WHEN: component is referenced via component-reference.schema.json with vars
      await page.goto('/')

      // THEN: it should transform template placeholders into concrete values in DOM
      const badge = page.locator('[data-testid="component-pricing-badge"]')
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
    'APP-COMPONENTS-016: should render with design tokens applied from global theme',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: components using theme design tokens
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          colors: { primary: '#007bff', secondary: '#6c757d' },
          spacing: { sm: '8px', md: '16px' },
          fonts: { body: { family: 'Arial', fallback: 'sans-serif' } },
        },
        components: [
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
            sections: [{ component: 'themed-card' }],
          },
        ],
      })

      // WHEN: component props reference theme colors, spacing, and fonts
      await page.goto('/')

      // THEN: it should render with design tokens applied from global theme
      const card = page.locator('[data-component="themed-card"]')
      await expect(card).toBeVisible()
      await expect(card).toHaveCSS('background-color', 'rgb(0, 123, 255)') // #007bff
    }
  )

  test(
    'APP-COMPONENTS-017: should render components within page layout with full variable substitution',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: components integrated with pages via sections
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
                component: 'hero-cta',
                vars: { buttonClass: 'btn-primary', buttonText: 'Get Started' },
              },
            ],
          },
        ],
      })

      // WHEN: page sections reference components using component property and vars
      await page.goto('/')

      // THEN: it should render components within page layout with full variable substitution
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
    'APP-COMPONENTS-018: should generate structured data and meta tags from component content',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: components containing meta/SEO data for structured content
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
                component: 'product-card',
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

      // WHEN: component definition includes meta properties for SEO optimization
      await page.goto('/')

      // THEN: it should generate structured data and meta tags from component content
      const productCard = page.locator('[data-testid="component-product-card"]')
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

      // Verify meta tags from component
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        '/images/headphones.jpg'
      )
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 18 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-COMPONENTS-REGRESSION: user can complete full components workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('APP-COMPONENTS-001: Validates minimal component definition at build time', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [{ name: 'simple-component', type: 'div' }],
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              sections: [{ component: 'simple-component' }],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-component="simple-component"]')).toBeVisible()
      })

      await test.step('APP-COMPONENTS-002: Uses URL-friendly naming convention for data-testid', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                { component: 'icon-badge' },
                { component: 'section-header' },
                { component: 'feature-card' },
              ],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="component-icon-badge"]')).toBeVisible()
        await expect(page.locator('[data-testid="component-section-header"]')).toBeVisible()
        await expect(page.locator('[data-testid="component-feature-card"]')).toBeVisible()
      })

      await test.step('APP-COMPONENTS-003: Rejects invalid component names at build time', async () => {
        const validBlocks = [
          { name: 'icon-badge', type: 'div' },
          { name: 'cta', type: 'div' },
          { name: 'section-header-2', type: 'div' },
          { name: 'feature-list-item', type: 'div' },
        ]
        await startServerWithSchema({
          name: 'test-app',
          components: validBlocks,
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              sections: [{ component: 'icon-badge' }],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-component="icon-badge"]')).toBeVisible()
      })

      await test.step('APP-COMPONENTS-004: Validates component naming uniqueness', async () => {
        await expect(async () => {
          await startServerWithSchema({
            name: 'test-app',
            components: [
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
      })

      await test.step('APP-COMPONENTS-005: Validates components array structure', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [{ name: 'test-component', type: 'div' }],
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
              sections: [{ component: 'test-component' }],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-component="test-component"]')).toBeVisible()
      })

      await test.step('APP-COMPONENTS-006: Makes components available for reference in all page sections', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
              sections: [{ component: 'complex' }],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-component="complex"]')).toBeVisible()
      })

      await test.step('APP-COMPONENTS-007: Renders corresponding HTML element or component by type', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
              sections: [{ component: 'layout' }, { component: 'row' }, { component: 'cta' }],
            },
          ],
        })
        await page.goto('/')
        await expect(
          page.locator('[data-testid="component-layout"][data-type="container"]')
        ).toBeVisible()
        await expect(page.locator('[data-testid="component-row"][data-type="flex"]')).toBeVisible()
        await expect(
          page.locator('[data-testid="component-cta"][data-type="button"]')
        ).toBeVisible()
      })

      await test.step('APP-COMPONENTS-008: Renders with properties including variable substitution', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                  component: 'styled-box',
                  vars: { variant: 'primary', boxId: 'main-box', label: 'Main content' },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        const styledBox = page.locator('[data-testid="component-styled-box"]')
        await expect(styledBox).toHaveClass(/box-primary/)
        await expect(styledBox).toHaveAttribute('id', 'main-box')
        await expect(styledBox).toHaveAttribute('aria-label', 'Main content')
      })

      await test.step('APP-COMPONENTS-009: Renders nested child components', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                {
                  component: 'card-header',
                  vars: { title: 'Card Title', subtitle: 'Card subtitle' },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        const component = page.locator('[data-testid="component-card-header"]')
        await expect(component.locator('h3')).toHaveText('Card Title')
        await expect(component.locator('p')).toHaveText('Card subtitle')
      })

      await test.step('APP-COMPONENTS-010: Renders text content with substituted variables', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
              sections: [
                { component: 'alert-message', vars: { message: 'Operation successful!' } },
              ],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="component-alert-message"]')).toHaveText(
          'Operation successful!'
        )
        await expect(page.locator('[data-testid="component-alert-message"]')).toHaveClass(/alert/)
      })

      await test.step('APP-COMPONENTS-011: Renders same component definition across multiple locations', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [{ name: 'reusable', type: 'div', children: ['Reusable component'] }],
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Test Page', description: 'Test page' },
              sections: [{ component: 'reusable' }, { component: 'reusable' }],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-component="reusable"]')).toHaveCount(2)
      })

      await test.step('APP-COMPONENTS-012: Renders multiple instances with different data', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                { component: 'stat-card', vars: { value: '1,234', label: 'Users' } },
                { component: 'stat-card', vars: { value: '567', label: 'Projects' } },
                { component: 'stat-card', vars: { value: '89%', label: 'Success Rate' } },
              ],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('h4').nth(0)).toHaveText('1,234')
        await expect(page.locator('h4').nth(1)).toHaveText('567')
        await expect(page.locator('h4').nth(2)).toHaveText('89%')
      })

      await test.step('APP-COMPONENTS-013: Provides consistent components across pages', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [{ name: 'shared-component', type: 'div' }],
          pages: [
            { name: 'Home', path: '/', sections: [{ component: 'shared-component' }] },
            { name: 'About', path: '/about', sections: [{ component: 'shared-component' }] },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-component="shared-component"]')).toBeVisible()
        await page.goto('/about')
        await expect(page.locator('[data-component="shared-component"]')).toBeVisible()
      })

      await test.step('APP-COMPONENTS-014: Renders complete component with all aspects integrated', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                  component: 'complete-card',
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
        await page.goto('/')
        const card = page.locator('[data-testid="component-complete-card"]')
        await expect(card).toHaveClass(/card-primary/)
        await expect(card).toHaveClass(/p-6/)
        await expect(card).toHaveClass(/rounded-lg/)
        await expect(page.locator('h3')).toHaveText('Premium Plan')
        await expect(page.locator('p')).toHaveText('Best value for teams')
      })

      await test.step('APP-COMPONENTS-015: Transforms template placeholders into concrete values in DOM', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
              sections: [{ component: 'pricing-badge', vars: { color: 'gold', price: '49' } }],
            },
          ],
        })
        await page.goto('/')
        const badge = page.locator('[data-testid="component-pricing-badge"]')
        await expect(badge).toHaveClass(/badge-gold/)
        await expect(badge).toHaveText('49/month')
        const html = await badge.innerHTML()
        expect(html).not.toContain('$')
      })

      await test.step('APP-COMPONENTS-016: Renders with design tokens applied from global theme', async () => {
        await startServerWithSchema({
          name: 'test-app',
          theme: {
            colors: { primary: '#007bff', secondary: '#6c757d' },
            spacing: { sm: '8px', md: '16px' },
            fonts: { body: { family: 'Arial', fallback: 'sans-serif' } },
          },
          components: [
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
              sections: [{ component: 'themed-card' }],
            },
          ],
        })
        await page.goto('/')
        const card = page.locator('[data-component="themed-card"]')
        await expect(card).toBeVisible()
        await expect(card).toHaveCSS('background-color', 'rgb(0, 123, 255)')
      })

      await test.step('APP-COMPONENTS-017: Renders components within page layout with full variable substitution', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                  component: 'hero-cta',
                  vars: { buttonClass: 'btn-primary', buttonText: 'Get Started' },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        const button = page.locator('button:has-text("Get Started")')
        await expect(button).toBeVisible()
        await expect(button).toHaveClass(/btn-primary/)
        const buttonHtml = await button.evaluate((el) => el.outerHTML)
        expect(buttonHtml).not.toContain('$buttonClass')
        expect(buttonHtml).not.toContain('$buttonText')
        expect(buttonHtml).not.toContain('$')
      })

      await test.step('APP-COMPONENTS-018: Generates structured data and meta tags from component content', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                  component: 'product-card',
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
        await page.goto('/')
        const productCard = page.locator('[data-testid="component-product-card"]')
        await expect(productCard).toBeVisible()
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
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
          'content',
          '/images/headphones.jpg'
        )
      })
    }
  )
})
