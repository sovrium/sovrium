/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Block Children
 *
 * Source: specs/app/blocks/common/block-children.schema.json
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Block Children', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-BLOCKS-CHILDREN-001: should render nested component structure in DOM',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: children array for block templates
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'card',
            type: 'div',
            children: [
              { type: 'div', props: { className: 'header' } },
              { type: 'div', props: { className: 'body' } },
            ],
          },
        ],
        pages: [{ name: 'Home', path: '/', sections: [{ block: 'card', vars: {} }] }],
      })

      // WHEN: array contains child component objects
      await page.goto('/')

      // THEN: it should render nested component structure in DOM
      const card = page.locator('[data-testid="block-card"]')
      await expect(card.locator('div.header')).toBeVisible()
      await expect(card.locator('div.body')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-CHILDREN-002: should render child element based on type',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: child with required type
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'multi-type',
            type: 'div',
            children: [
              { type: 'div' },
              { type: 'span' },
              { type: 'button' },
              { type: 'single-line-text' },
            ],
          },
        ],
        pages: [{ name: 'Home', path: '/', sections: [{ block: 'multi-type', vars: {} }] }],
      })

      // WHEN: each child has type property
      await page.goto('/')

      // THEN: it should render child element based on type
      const block = page.locator('[data-testid="block-multi-type"]')
      await expect(block.locator('[data-testid="child-0"]')).toBeVisible()
      await expect(block.locator('[data-testid="child-1"]')).toBeVisible()
      await expect(block.locator('[data-testid="child-2"]')).toBeVisible()
      await expect(block.locator('[data-testid="child-3"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-CHILDREN-003: should render child with specified properties and attributes',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: child with props
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'props-test',
            type: 'div',
            children: [
              {
                type: 'div',
                props: { className: 'card-header', id: 'header-1', ariaLabel: 'Card header' },
              },
            ],
          },
        ],
        pages: [{ name: 'Home', path: '/', sections: [{ block: 'props-test', vars: {} }] }],
      })

      // WHEN: child has props referencing block-props.schema.json
      await page.goto('/')

      // THEN: it should render child with specified properties and attributes
      const child = page.locator('[data-testid="child-0"]')
      await expect(child).toHaveClass(/card-header/)
      await expect(child).toHaveAttribute('id', 'header-1')
      await expect(child).toHaveAttribute('aria-label', 'Card header')
    }
  )

  test(
    'APP-BLOCKS-CHILDREN-004: should render unlimited nesting depth in DOM tree',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: child with recursive children
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'nested-list',
            type: 'ul',
            children: [
              {
                type: 'li',
                content: 'Level 1',
                children: [
                  {
                    type: 'ul',
                    children: [
                      {
                        type: 'li',
                        content: 'Level 2',
                        children: [
                          {
                            type: 'ul',
                            children: [{ type: 'li', content: 'Level 3' }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        pages: [{ name: 'Home', path: '/', sections: [{ block: 'nested-list', vars: {} }] }],
      })

      // WHEN: child has children property with self-reference (#)
      await page.goto('/')

      // THEN: it should render unlimited nesting depth in DOM tree
      const list = page.locator('[data-testid="block-nested-list"]')
      await expect(list.locator('li').first()).toContainText('Level 1')
      await expect(list.locator('li li').first()).toContainText('Level 2')
      await expect(list.locator('li li li').first()).toContainText('Level 3')
    }
  )

  test(
    'APP-BLOCKS-CHILDREN-005: should render child with substituted text content',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: child with content
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'labeled-input',
            type: 'div',
            children: [
              {
                type: 'text',
                props: { level: 'label', 'data-testid': 'label' },
                content: '$label',
              },
              { type: 'input', props: { placeholder: '$placeholder' } },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                block: 'labeled-input',
                vars: { label: 'Email Address', placeholder: 'Enter your email' },
              },
            ],
          },
        ],
      })

      // WHEN: child has content string with $variable support
      await page.goto('/')

      // THEN: it should render child with substituted text content
      await expect(page.locator('[data-testid="label"]')).toHaveText('Email Address')
      await expect(page.locator('input')).toHaveAttribute('placeholder', 'Enter your email')
    }
  )

  test(
    'APP-BLOCKS-CHILDREN-006: should render composite UI pattern with all child elements',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: children for component composition
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'pricing-card',
            type: 'card',
            children: [
              {
                type: 'div',
                props: { className: 'card-header' },
                children: [
                  { type: 'h3', content: '$plan' },
                  { type: 'p', content: '$price' },
                ],
              },
              {
                type: 'list',
                props: { className: 'features' },
                children: [
                  { type: 'list-item', content: '$feature1' },
                  { type: 'list-item', content: '$feature2' },
                ],
              },
              { type: 'button', content: '$cta' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                block: 'pricing-card',
                vars: {
                  plan: 'Pro',
                  price: '$49/mo',
                  feature1: 'Unlimited users',
                  feature2: '24/7 support',
                  cta: 'Get Started',
                },
              },
            ],
          },
        ],
      })

      // WHEN: multiple children create complex structure
      await page.goto('/')

      // THEN: it should render composite UI pattern with all child elements
      await expect(page.locator('h3')).toHaveText('Pro')
      await expect(page.locator('p')).toHaveText('$49/mo')
      await expect(page.locator('button')).toHaveText('Get Started')
    }
  )

  test(
    'APP-BLOCKS-CHILDREN-007: should render SVG icon with substituted name and color',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon child example
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'badge-with-icon',
            type: 'div',
            children: [{ type: 'icon', props: { name: '$icon', color: '$color' } }],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              { block: 'badge-with-icon', vars: { icon: 'check-circle', color: 'green' } },
            ],
          },
        ],
      })

      // WHEN: child has type 'icon' with props containing $icon and $color variables
      await page.goto('/')

      // THEN: it should render SVG icon with substituted name and color
      await expect(page.locator('[data-testid="icon-check-circle"]')).toBeVisible()
      await expect(page.locator('[data-testid="icon-check-circle"]')).toHaveAttribute(
        'data-color',
        'green'
      )
    }
  )

  test(
    'APP-BLOCKS-CHILDREN-008: should render text element with substituted content',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: text child example
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'simple-message',
            type: 'div',
            children: [{ type: 'text', content: '$message' }],
          },
        ],
        pages: [
          {
            name: 'Home',
            path: '/',
            sections: [
              {
                block: 'simple-message',
                vars: { message: 'Welcome back!' },
              },
            ],
          },
        ],
      })

      // WHEN: child has type 'text' with content
      await page.goto('/')

      // THEN: it should render text element with content
      await expect(page.locator('[data-testid="block-simple-message"]')).toContainText(
        'Welcome back!'
      )
    }
  )

  test(
    'APP-BLOCKS-CHILDREN-009: should render all children with substituted values throughout tree',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: children with nested structure
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'alert-card',
            type: 'div',
            props: { className: 'alert-$alertType' },
            children: [
              { type: 'icon', props: { name: '$icon', className: 'text-$iconColor-500' } },
              {
                type: 'div',
                children: [
                  { type: 'h4', content: '$title' },
                  { type: 'text', content: '$message' },
                ],
              },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                block: 'alert-card',
                vars: {
                  alertType: 'success',
                  icon: 'check',
                  iconColor: 'green',
                  title: 'Success!',
                  message: 'Operation completed',
                },
              },
            ],
          },
        ],
      })

      // WHEN: children contain nested structure
      await page.goto('/')

      // THEN: it should render all children with substituted values throughout tree
      const card = page.locator('[data-testid="block-alert-card"]')
      await expect(card).toHaveClass(/alert-success/)
      await expect(page.locator('h4')).toHaveText('Success!')
    }
  )

  test(
    'APP-BLOCKS-CHILDREN-010: should render hierarchical DOM tree with proper nesting',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: children for UI tree structure
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'page-section',
            type: 'section',
            children: [
              {
                type: 'div',
                props: { className: 'container' },
                children: [
                  {
                    type: 'div',
                    props: { className: 'row' },
                    children: [
                      {
                        type: 'div',
                        props: { className: 'col' },
                        content: '$content',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        pages: [
          {
            name: 'Home',
            path: '/',
            sections: [{ block: 'page-section', vars: { content: 'Content here' } }],
          },
        ],
      })

      // WHEN: children array defines parent-child relationships
      await page.goto('/')

      // THEN: it should render hierarchical DOM tree with proper nesting
      const section = page.locator('[data-testid="block-page-section"]')
      await expect(section.locator('.container .row .col')).toHaveText('Content here')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test.fixme(
    'APP-BLOCKS-CHILDREN-011: user can complete full children workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with complex nested children
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'feature-card',
            type: 'card',
            children: [
              { type: 'icon', props: { name: '$icon', color: '$color' } },
              {
                type: 'div',
                children: [
                  { type: 'single-line-text', props: { level: 'h4' }, content: '$title' },
                  { type: 'single-line-text', content: '$description' },
                ],
              },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Home',
              description: 'Home page',
            },
            sections: [
              {
                block: 'feature-card',
                vars: {
                  icon: 'star',
                  color: 'blue',
                  title: 'Feature 1',
                  description: 'Description 1',
                },
              },
              {
                block: 'feature-card',
                vars: {
                  icon: 'heart',
                  color: 'red',
                  title: 'Feature 2',
                  description: 'Description 2',
                },
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // 1. Structure validation (ARIA) - First card
      // THEN: assertion
      await expect(page.locator('[data-testid="block-feature-card-0"]')).toMatchAriaSnapshot(`
        - group:
          - img
          - group:
            - heading "Feature 1" [level=4]
            - text: Description 1
      `)

      // 2. Structure validation (ARIA) - Second card (different data, same structure)
      // THEN: assertion
      await expect(page.locator('[data-testid="block-feature-card-1"]')).toMatchAriaSnapshot(`
        - group:
          - img
          - group:
            - heading "Feature 2" [level=4]
            - text: Description 2
      `)

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
