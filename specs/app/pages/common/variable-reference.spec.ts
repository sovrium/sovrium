/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Variable Reference
 *
 * Source: specs/app/pages/common/variable-reference.schema.json
 * Spec Count: 8
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (8 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Variable Reference', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test.fixme(
    'APP-PAGES-VARREF-001: should validate variable syntax',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a simple variable reference
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',

            path: '/',
            vars: {
              color: 'blue',
            },
            sections: [
              {
                type: 'text',
                content: '$color',
              },
            ],
          },
        ],
      })

      // WHEN: value is '$color'
      await page.goto('/')

      // THEN: it should validate and replace variable syntax
      await expect(page.locator('[data-testid="text"]')).toHaveText('blue')
    }
  )

  test.fixme(
    'APP-PAGES-VARREF-002: should accept camelCase variable names',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a variable reference with camelCase name
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',

            path: '/',
            vars: {
              primaryText: 'Welcome to our site',
            },
            sections: [
              {
                type: 'text',
                content: '$primaryText',
              },
            ],
          },
        ],
      })

      // WHEN: value is '$primaryText'
      await page.goto('/')

      // THEN: it should accept camelCase variable names
      await expect(page.locator('[data-testid="text"]')).toHaveText('Welcome to our site')
    }
  )

  test.fixme(
    'APP-PAGES-VARREF-003: should accept variable at start of string',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a string with variable at the start
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',

            path: '/',
            vars: {
              siteName: 'Sovrium',
            },
            sections: [
              {
                type: 'text',
                content: '$siteName is the best',
              },
            ],
          },
        ],
      })

      // WHEN: value is '$siteName is the best'
      await page.goto('/')

      // THEN: it should accept variable at start of string
      await expect(page.locator('[data-testid="text"]')).toHaveText('Sovrium is the best')
    }
  )

  test.fixme(
    'APP-PAGES-VARREF-004: should accept variable in middle of string',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a string with variable in the middle
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',

            path: '/',
            vars: {
              siteName: 'Sovrium',
            },
            sections: [
              {
                type: 'text',
                content: 'Welcome to $siteName today',
              },
            ],
          },
        ],
      })

      // WHEN: value is 'Welcome to $siteName today'
      await page.goto('/')

      // THEN: it should accept variable in middle of string
      await expect(page.locator('[data-testid="text"]')).toHaveText('Welcome to Sovrium today')
    }
  )

  test.fixme(
    'APP-PAGES-VARREF-005: should accept variable at end of string',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a string with variable at the end
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',

            path: '/',
            vars: {
              primaryColor: 'blue',
            },
            sections: [
              {
                type: 'text',
                content: 'The color is $primaryColor',
              },
            ],
          },
        ],
      })

      // WHEN: value is 'The color is $primaryColor'
      await page.goto('/')

      // THEN: it should accept variable at end of string
      await expect(page.locator('[data-testid="text"]')).toHaveText('The color is blue')
    }
  )

  test.fixme(
    'APP-PAGES-VARREF-006: should accept multiple $variable references',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a string with multiple variables
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',

            path: '/',
            vars: {
              productName: 'Pro Plan',
              price: '$29.99',
            },
            sections: [
              {
                type: 'text',
                content: 'The $productName costs $price',
              },
            ],
          },
        ],
      })

      // WHEN: value is 'The $productName costs $price'
      await page.goto('/')

      // THEN: it should accept multiple $variable references
      await expect(page.locator('[data-testid="text"]')).toHaveText('The Pro Plan costs $29.99')
    }
  )

  test.fixme(
    'APP-PAGES-VARREF-007: should accept alphanumeric variable names',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a variable reference with numbers in name
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',

            path: '/',
            vars: {
              color1: 'red',
              size2x: 'large',
            },
            sections: [
              {
                type: 'text',
                content: 'Color: $color1, Size: $size2x',
              },
            ],
          },
        ],
      })

      // WHEN: value is '$color1' or '$size2x'
      await page.goto('/')

      // THEN: it should accept alphanumeric variable names
      await expect(page.locator('[data-testid="text"]')).toHaveText('Color: red, Size: large')
    }
  )

  test.fixme(
    'APP-PAGES-VARREF-008: should support variable composition patterns',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: complex variable combination
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',

            path: '/',
            vars: {
              icon: 'fa-home',
              size: 'lg',
            },
            sections: [
              {
                type: 'icon',
                props: {
                  className: '$icon-$size',
                },
              },
            ],
          },
        ],
      })

      // WHEN: value is '$icon-$size' for dynamic icon sizing
      await page.goto('/')

      // THEN: it should support variable composition patterns
      await expect(page.locator('[data-testid="icon"]')).toHaveClass(/fa-home-lg/)
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test.fixme(
    'APP-PAGES-VARIABLE-REFERENCE-REGRESSION-001: user can complete full variable-reference workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with comprehensive variable usage
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',

            path: '/',
            vars: {
              siteName: 'Sovrium',
              primaryColor: 'blue',
              productName: 'Pro Plan',
              price: '$29.99',
              icon: 'fa-star',
            },
            sections: [
              {
                type: 'heading',
                content: 'Welcome to $siteName',
              },
              {
                type: 'text',
                content: 'The $productName costs $price per month',
              },
              {
                type: 'button',
                content: 'Get Started',
                props: {
                  className: 'bg-$primaryColor',
                },
              },
              {
                type: 'icon',
                props: {
                  className: '$icon text-$primaryColor',
                },
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // Enhanced variable substitution validation
      // Ensure no unsubstituted variable patterns remain in HTML (except literal values like $29.99)
      const html = await page.locator('body').innerHTML()
      expect(html).not.toContain('$siteName') // Should be substituted
      expect(html).not.toContain('$productName') // Should be substituted
      expect(html).not.toContain('$primaryColor') // Should be substituted
      expect(html).not.toContain('$icon') // Should be substituted
      expect(html).toContain('$29.99') // Literal value, not a variable

      // Verify variable replacements in rendered content
      await expect(page.locator('h1')).toHaveText('Welcome to Sovrium')
      await expect(page.locator('[data-testid="text"]')).toHaveText(
        'The Pro Plan costs $29.99 per month'
      )
      await expect(page.locator('button')).toHaveClass(/bg-blue/)
      await expect(page.locator('[data-testid="icon"]')).toHaveClass(/fa-star/)
      await expect(page.locator('[data-testid="icon"]')).toHaveClass(/text-blue/)

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
