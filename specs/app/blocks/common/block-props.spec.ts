/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Block Props
 *
 * Source: specs/app/blocks/common/block-props.schema.json
 * Spec Count: 14
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (14 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Block Props', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-BLOCKS-PROPS-001: should validate any valid JavaScript property name at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props as dynamic object
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'props-block',
            type: 'div',
            props: {
              className: 'text-blue',
              id: 'main',
              ariaLabel: 'Main content',
              dataTestId: 'component-1',
            },
          },
        ],
        pages: [{ name: 'Home', path: '/', sections: [{ block: 'props-block', vars: {} }] }],
      })

      // WHEN: props uses patternProperties for flexible property names
      await page.goto('/')

      // THEN: it should validate any valid JavaScript property name at build time
      const block = page.locator('[data-testid="block-props-block"]')
      await expect(block).toHaveClass(/text-blue/)
      await expect(block).toHaveAttribute('id', 'main')
      await expect(block).toHaveAttribute('aria-label', 'Main content')
    }
  )

  test(
    'APP-BLOCKS-PROPS-002: should render as HTML attributes following camelCase convention',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: property names in camelCase
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'custom-button',
            type: 'button',
            props: { className: 'btn-primary', ariaLabel: 'Click me', dataTestId: 'submit-btn' },
          },
        ],
        pages: [{ name: 'Home', path: '/', sections: [{ block: 'custom-button', vars: {} }] }],
      })

      // WHEN: property names match ^[a-zA-Z][a-zA-Z0-9]*$ pattern
      await page.goto('/')

      // THEN: it should render as HTML attributes following camelCase convention
      const button = page.locator('[data-testid="block-custom-button"]')
      await expect(button).toHaveClass(/btn-primary/)
      await expect(button).toHaveAttribute('aria-label', 'Click me')
      await expect(button).toHaveAttribute('data-test-id', 'submit-btn')
    }
  )

  test(
    'APP-BLOCKS-PROPS-003: should render string value with variable substitution',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: property value as string
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'styled-div',
            type: 'div',
            props: { className: 'text-$color', id: '$elementId', title: '$tooltipText' },
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                block: 'styled-div',
                vars: { color: 'blue', elementId: 'main-content', tooltipText: 'Hover for info' },
              },
            ],
          },
        ],
      })

      // WHEN: value is string (may contain $variable)
      await page.goto('/')

      // THEN: it should render string value with variable substitution
      const div = page.locator('[data-testid="block-styled-div"]')
      await expect(div).toHaveClass(/text-blue/)
      await expect(div).toHaveAttribute('id', 'main-content')
      await expect(div).toHaveAttribute('title', 'Hover for info')
    }
  )

  test(
    'APP-BLOCKS-PROPS-004: should render numeric value as HTML attribute',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: property value as number
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'grid-layout',
            type: 'div',
            props: { columns: 3, gap: 4, maxWidth: 1200 },
          },
        ],
        pages: [{ name: 'Home', path: '/', sections: [{ block: 'grid-layout', vars: {} }] }],
      })

      // WHEN: value is number like 4, 12, 300
      await page.goto('/')

      // THEN: it should render numeric value as HTML attribute
      const grid = page.locator('[data-testid="block-grid-layout"]')
      await expect(grid).toHaveAttribute('data-columns', '3')
      await expect(grid).toHaveAttribute('data-gap', '4')
      await expect(grid).toHaveAttribute('data-max-width', '1200')
    }
  )

  test(
    'APP-BLOCKS-PROPS-005: should render boolean as HTML boolean attribute',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: property value as boolean
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'form-input',
            type: 'input',
            props: { disabled: true, required: true, hidden: false },
          },
        ],
        pages: [{ name: 'Home', path: '/', sections: [{ block: 'form-input', vars: {} }] }],
      })

      // WHEN: value is true or false
      await page.goto('/')

      // THEN: it should render boolean as HTML boolean attribute
      const input = page.locator('[data-testid="block-form-input"]')
      await expect(input).toHaveAttribute('disabled', '')
      await expect(input).toHaveAttribute('required', '')
      await expect(input).not.toHaveAttribute('hidden')
    }
  )

  test(
    'APP-BLOCKS-PROPS-006: should render object as JSON data attribute',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: property value as object
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'chart-widget',
            type: 'div',
            props: {
              chartConfig: {
                type: 'bar',
                data: [10, 20, 30],
                colors: { primary: 'blue', secondary: 'green' },
              },
            },
          },
        ],
        pages: [{ name: 'Home', path: '/', sections: [{ block: 'chart-widget', vars: {} }] }],
      })

      // WHEN: value is nested object
      await page.goto('/')

      // THEN: it should render object as JSON data attribute
      const widget = page.locator('[data-testid="block-chart-widget"]')
      await expect(widget).toHaveAttribute('data-chart-config')
      const configAttr = await widget.getAttribute('data-chart-config')
      const config = JSON.parse(configAttr!)
      expect(config.type).toBe('bar')
      expect(config.data).toEqual([10, 20, 30])
    }
  )

  test.fixme(
    'APP-BLOCKS-PROPS-007: should render array as JSON data attribute',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: property value as array
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'tag-list',
            type: 'div',
            props: { tags: ['react', 'typescript', 'tailwind'] },
          },
        ],
        pages: [{ name: 'Home', path: '/', sections: [{ block: 'tag-list', vars: {} }] }],
      })

      // WHEN: value is array of items
      await page.goto('/')

      // THEN: it should render array as JSON data attribute
      const list = page.locator('[data-testid="block-tag-list"]')
      await expect(list).toHaveAttribute('data-tags')
      const tagsAttr = await list.getAttribute('data-tags')
      const tags = JSON.parse(tagsAttr!)
      expect(tags).toEqual(['react', 'typescript', 'tailwind'])
    }
  )

  test(
    'APP-BLOCKS-PROPS-008: should render with all variables substituted in className',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: className with multiple variables
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'multi-var-box',
            type: 'div',
            props: { className: 'text-$color bg-$bgColor border-$borderColor' },
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                block: 'multi-var-box',
                vars: { color: 'blue', bgColor: 'gray-100', borderColor: 'gray-300' },
              },
            ],
          },
        ],
      })

      // WHEN: className is 'text-$color bg-$bgColor'
      await page.goto('/')

      // THEN: it should render with all variables substituted in className
      const box = page.locator('[data-testid="block-multi-var-box"]')
      await expect(box).toHaveClass(/text-blue/)
      await expect(box).toHaveClass(/bg-gray-100/)
      await expect(box).toHaveClass(/border-gray-300/)
    }
  )

  test(
    'APP-BLOCKS-PROPS-009: should render combined static and dynamic className parts',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props mixing variables and literals
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'container',
            type: 'div',
            props: { className: 'container mx-auto max-w-$width px-$padding' },
          },
        ],
        pages: [
          {
            name: 'Home',
            path: '/',
            sections: [{ block: 'container', vars: { width: '7xl', padding: '4' } }],
          },
        ],
      })

      // WHEN: maxWidth is 'max-w-$width' (Tailwind utility with variable)
      await page.goto('/')

      // THEN: it should render combined static and dynamic className parts
      const container = page.locator('[data-testid="block-container"]')
      await expect(container).toHaveClass(/container/)
      await expect(container).toHaveClass(/mx-auto/)
      await expect(container).toHaveClass(/max-w-7xl/)
      await expect(container).toHaveClass(/px-4/)
    }
  )

  test(
    'APP-BLOCKS-PROPS-010: should render complete component with all configuration applied',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props for component configuration
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'action-button',
            type: 'button',
            props: {
              className: 'btn btn-$variant',
              disabled: '$isDisabled',
              ariaLabel: '$label',
              dataAction: '$action',
            },
            content: '$buttonText',
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                block: 'action-button',
                vars: {
                  variant: 'primary',
                  isDisabled: false,
                  label: 'Submit form',
                  action: 'submit',
                  buttonText: 'Submit',
                },
              },
            ],
          },
        ],
      })

      // WHEN: props define component appearance and behavior
      await page.goto('/')

      // THEN: it should render complete component with all configuration applied
      const button = page.locator('[data-testid="block-action-button"]')
      await expect(button).toHaveClass(/btn-primary/)
      await expect(button).toHaveAttribute('aria-label', 'Submit form')
      await expect(button).toHaveAttribute('data-action', 'submit')
      await expect(button).toHaveText('Submit')
    }
  )

  test.fixme(
    'APP-BLOCKS-PROPS-011: should resolve translation tokens in block props during rendering',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block props containing translation tokens ($t:)
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [
            { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' },
            { code: 'fr', locale: 'fr-FR', label: 'Français', direction: 'ltr' },
          ],
          translations: {
            en: {
              'close.label': 'Close',
              'save.tooltip': 'Save changes',
            },
            fr: {
              'close.label': 'Fermer',
              'save.tooltip': 'Enregistrer les modifications',
            },
          },
        },
        blocks: [
          {
            name: 'action-button',
            type: 'button',
            props: {
              'aria-label': '$t:close.label',
              title: '$t:save.tooltip',
              className: 'btn btn-$variant',
            },
            children: ['×'],
          },
        ],
        pages: [
          {
            name: 'form',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                block: 'action-button',
                vars: {
                  variant: 'primary',
                },
              },
            ],
          },
        ],
      })

      // WHEN: block is rendered with $t: references in props values
      await page.goto('/')

      // THEN: translation tokens should be resolved to actual translated text during rendering
      const html = await page.content()
      expect(html).not.toContain('$t:')
      expect(html).toContain('aria-label="Close"')
      expect(html).toContain('title="Save changes"')

      const button = page.locator('[data-testid="block-action-button"]')
      await expect(button).toHaveAttribute('aria-label', 'Close')
      await expect(button).toHaveAttribute('title', 'Save changes')
      await expect(button).toHaveClass(/btn-primary/)
    }
  )

  test.fixme(
    'APP-BLOCKS-PROPS-012: should resolve translation tokens in block children during rendering',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block children containing translation tokens ($t:)
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' }],
          translations: {
            en: {
              'menu.home': 'Home',
              'menu.products': 'Products',
              'menu.contact': 'Contact',
            },
          },
        },
        blocks: [
          {
            name: 'nav-menu',
            type: 'nav',
            children: [
              {
                type: 'a',
                children: ['$t:menu.home'],
              },
              {
                type: 'a',
                children: ['$t:menu.products'],
              },
              {
                type: 'a',
                children: ['$t:menu.contact'],
              },
            ],
          },
        ],
        pages: [
          {
            name: 'main',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                block: 'nav-menu',
              },
            ],
          },
        ],
      })

      // WHEN: block is rendered with $t: references in children arrays
      await page.goto('/')

      // THEN: translation tokens in children should be resolved to translated text
      const html = await page.content()
      expect(html).not.toContain('$t:')

      const nav = page.locator('[data-testid="block-nav-menu"]')
      await expect(nav.locator('a').nth(0)).toHaveText('Home')
      await expect(nav.locator('a').nth(1)).toHaveText('Products')
      await expect(nav.locator('a').nth(2)).toHaveText('Contact')
    }
  )

  test.fixme(
    'APP-BLOCKS-PROPS-013: should resolve translation tokens in block content during rendering',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block content containing translation tokens ($t:)
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' }],
          translations: {
            en: {
              'hero.tagline': 'Build your next great app',
              'footer.copyright': '© 2025 All rights reserved',
            },
          },
        },
        blocks: [
          {
            name: 'hero-heading',
            type: 'h1',
            content: '$t:hero.tagline',
          },
          {
            name: 'footer-text',
            type: 'footer',
            content: '$t:footer.copyright',
          },
        ],
        pages: [
          {
            name: 'landing',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                block: 'hero-heading',
              },
              {
                block: 'footer-text',
              },
            ],
          },
        ],
      })

      // WHEN: block is rendered with $t: reference in content property
      await page.goto('/')

      // THEN: translation token in content should be resolved to translated text
      const html = await page.content()
      expect(html).not.toContain('$t:')

      await expect(page.locator('[data-testid="block-hero-heading"]')).toHaveText(
        'Build your next great app'
      )
      await expect(page.locator('[data-testid="block-footer-text"]')).toHaveText(
        '© 2025 All rights reserved'
      )
    }
  )

  test.fixme(
    'APP-BLOCKS-PROPS-014: should work with both translation tokens ($t:) and variable references ($variable)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block with both translation tokens ($t:) and variable references ($variable)
      await startServerWithSchema({
        name: 'test-app',
        languages: {
          default: 'en',
          supported: [{ code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' }],
          translations: {
            en: {
              'card.title': 'Product',
              'card.price': 'Price:',
              'card.action': 'Add to Cart',
            },
          },
        },
        blocks: [
          {
            name: 'product-card',
            type: 'div',
            props: {
              className: 'card card-$variant',
              'data-product-id': '$productId',
            },
            children: [
              {
                type: 'h3',
                content: '$t:card.title',
              },
              {
                type: 'p',
                content: '$t:card.price',
              },
              {
                type: 'span',
                content: '$price',
              },
              {
                type: 'button',
                props: {
                  'aria-label': '$t:card.action',
                },
                children: ['$t:card.action'],
              },
            ],
          },
        ],
        pages: [
          {
            name: 'shop',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                block: 'product-card',
                vars: {
                  variant: 'primary',
                  productId: '12345',
                  price: '$99.99',
                },
              },
            ],
          },
        ],
      })

      // WHEN: block uses $t: for translations AND $variable for dynamic data
      await page.goto('/')

      // THEN: both patterns should work together: translations resolved first, then variables substituted
      const html = await page.content()
      expect(html).not.toContain('$t:')
      expect(html).not.toMatch(/\$(?!99\.99)[a-zA-Z]/) // No unresolved variables except $99.99

      const card = page.locator('[data-testid="block-product-card"]')
      await expect(card).toHaveClass(/card-primary/)
      await expect(card).toHaveAttribute('data-product-id', '12345')
      await expect(card.locator('h3')).toHaveText('Product')
      await expect(card.locator('p')).toHaveText('Price:')
      await expect(card.locator('span')).toHaveText('$99.99')
      await expect(card.locator('button')).toHaveText('Add to Cart')
      await expect(card.locator('button')).toHaveAttribute('aria-label', 'Add to Cart')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-BLOCKS-BLOCK-PROPS-REGRESSION-001: user can complete full props workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with comprehensive block props
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'feature-box',
            type: 'div',
            props: {
              className: 'box-$variant p-$padding rounded-$radius',
              ariaLabel: '$label',
              dataConfig: '$config',
            },
            content: '$message',
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                block: 'feature-box',
                vars: {
                  variant: 'primary',
                  padding: '6',
                  radius: 'lg',
                  label: 'Feature 1',
                  config: 'enabled',
                  message: 'First feature',
                },
              },
              {
                block: 'feature-box',
                vars: {
                  variant: 'secondary',
                  padding: '4',
                  radius: 'md',
                  label: 'Feature 2',
                  config: 'disabled',
                  message: 'Second feature',
                },
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // Verify first box
      const box1 = page.locator('[data-testid="block-feature-box-0"]')
      await expect(box1).toHaveClass(/box-primary/)
      await expect(box1).toHaveClass(/p-6/)
      await expect(box1).toHaveAttribute('aria-label', 'Feature 1')

      // Verify second box
      const box2 = page.locator('[data-testid="block-feature-box-1"]')
      await expect(box2).toHaveClass(/box-secondary/)
      await expect(box2).toHaveClass(/rounded-md/)

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
