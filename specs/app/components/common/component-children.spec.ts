/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Component Children
 *
 * Source: src/domain/models/app/component/common.ts
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Component Children', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-COMPONENTS-CHILDREN-001: should render nested component structure in DOM',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: children array for component templates
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'card',
            type: 'div',
            children: [
              { type: 'div', props: { className: 'header' } },
              { type: 'div', props: { className: 'body' } },
            ],
          },
        ],
        pages: [{ name: 'Home', path: '/', sections: [{ component: 'card', vars: {} }] }],
      })

      // WHEN: array contains child component objects
      await page.goto('/')

      // THEN: it should render nested component structure in DOM
      const card = page.locator('[data-testid="component-card"]')
      await expect(card.locator('div.header')).toBeVisible()
      await expect(card.locator('div.body')).toBeVisible()
    }
  )

  test(
    'APP-COMPONENTS-CHILDREN-002: should render child element based on type',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: child with required type
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
        pages: [{ name: 'Home', path: '/', sections: [{ component: 'multi-type', vars: {} }] }],
      })

      // WHEN: each child has type property
      await page.goto('/')

      // THEN: it should render child element based on type
      const component = page.locator('[data-testid="component-multi-type"]')
      await expect(component.locator('[data-testid="child-0"]')).toBeVisible()
      await expect(component.locator('[data-testid="child-1"]')).toBeVisible()
      await expect(component.locator('[data-testid="child-2"]')).toBeVisible()
      await expect(component.locator('[data-testid="child-3"]')).toBeVisible()
    }
  )

  test(
    'APP-COMPONENTS-CHILDREN-003: should render child with specified properties and attributes',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: child with props
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
        pages: [{ name: 'Home', path: '/', sections: [{ component: 'props-test', vars: {} }] }],
      })

      // WHEN: child has props referencing component-props.schema.json
      await page.goto('/')

      // THEN: it should render child with specified properties and attributes
      const child = page.locator('[data-testid="child-0"]')
      await expect(child).toHaveClass(/card-header/)
      await expect(child).toHaveAttribute('id', 'header-1')
      await expect(child).toHaveAttribute('aria-label', 'Card header')
    }
  )

  test(
    'APP-COMPONENTS-CHILDREN-004: should render unlimited nesting depth in DOM tree',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: child with recursive children
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
        pages: [{ name: 'Home', path: '/', sections: [{ component: 'nested-list', vars: {} }] }],
      })

      // WHEN: child has children property with self-reference (#)
      await page.goto('/')

      // THEN: it should render unlimited nesting depth in DOM tree
      const list = page.locator('[data-testid="component-nested-list"]')
      await expect(list.locator('li').first()).toContainText('Level 1')
      await expect(list.locator('li li').first()).toContainText('Level 2')
      await expect(list.locator('li li li').first()).toContainText('Level 3')
    }
  )

  test(
    'APP-COMPONENTS-CHILDREN-005: should render child with substituted text content',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: child with content
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
                component: 'labeled-input',
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
    'APP-COMPONENTS-CHILDREN-006: should render composite UI pattern with all child elements',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: children for component composition
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
                component: 'pricing-card',
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
    'APP-COMPONENTS-CHILDREN-007: should render SVG icon with substituted name and color',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon child example
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
              { component: 'badge-with-icon', vars: { icon: 'check-circle', color: 'green' } },
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
    'APP-COMPONENTS-CHILDREN-008: should render text element with substituted content',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: text child example
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
                component: 'simple-message',
                vars: { message: 'Welcome back!' },
              },
            ],
          },
        ],
      })

      // WHEN: child has type 'text' with content
      await page.goto('/')

      // THEN: it should render text element with content
      await expect(page.locator('[data-testid="component-simple-message"]')).toContainText(
        'Welcome back!'
      )
    }
  )

  test(
    'APP-COMPONENTS-CHILDREN-009: should render all children with substituted values throughout tree',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: children with nested structure
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
                component: 'alert-card',
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
      const card = page.locator('[data-testid="component-alert-card"]')
      await expect(card).toHaveClass(/alert-success/)
      await expect(page.locator('h4')).toHaveText('Success!')
    }
  )

  test(
    'APP-COMPONENTS-CHILDREN-010: should render hierarchical DOM tree with proper nesting',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: children for UI tree structure
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
            sections: [{ component: 'page-section', vars: { content: 'Content here' } }],
          },
        ],
      })

      // WHEN: children array defines parent-child relationships
      await page.goto('/')

      // THEN: it should render hierarchical DOM tree with proper nesting
      const section = page.locator('[data-testid="component-page-section"]')
      await expect(section.locator('.container .row .col')).toHaveText('Content here')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 10 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-COMPONENTS-CHILDREN-REGRESSION: user can complete full children workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('APP-COMPONENTS-CHILDREN-001: Renders nested component structure in DOM', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            {
              name: 'card',
              type: 'div',
              children: [
                { type: 'div', props: { className: 'header' } },
                { type: 'div', props: { className: 'body' } },
              ],
            },
          ],
          pages: [{ name: 'Home', path: '/', sections: [{ component: 'card', vars: {} }] }],
        })
        await page.goto('/')
        const card = page.locator('[data-testid="component-card"]')
        await expect(card.locator('div.header')).toBeVisible()
        await expect(card.locator('div.body')).toBeVisible()
      })

      await test.step('APP-COMPONENTS-CHILDREN-002: Renders child element based on type', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
          pages: [{ name: 'Home', path: '/', sections: [{ component: 'multi-type', vars: {} }] }],
        })
        await page.goto('/')
        const component = page.locator('[data-testid="component-multi-type"]')
        await expect(component.locator('[data-testid="child-0"]')).toBeVisible()
        await expect(component.locator('[data-testid="child-1"]')).toBeVisible()
        await expect(component.locator('[data-testid="child-2"]')).toBeVisible()
        await expect(component.locator('[data-testid="child-3"]')).toBeVisible()
      })

      await test.step('APP-COMPONENTS-CHILDREN-003: Renders child with specified properties and attributes', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
          pages: [{ name: 'Home', path: '/', sections: [{ component: 'props-test', vars: {} }] }],
        })
        await page.goto('/')
        const child = page.locator('[data-testid="child-0"]')
        await expect(child).toHaveClass(/card-header/)
        await expect(child).toHaveAttribute('id', 'header-1')
        await expect(child).toHaveAttribute('aria-label', 'Card header')
      })

      await test.step('APP-COMPONENTS-CHILDREN-004: Renders unlimited nesting depth in DOM tree', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
          pages: [{ name: 'Home', path: '/', sections: [{ component: 'nested-list', vars: {} }] }],
        })
        await page.goto('/')
        const list = page.locator('[data-testid="component-nested-list"]')
        await expect(list.locator('li').first()).toContainText('Level 1')
        await expect(list.locator('li li').first()).toContainText('Level 2')
        await expect(list.locator('li li li').first()).toContainText('Level 3')
      })

      await test.step('APP-COMPONENTS-CHILDREN-005: Renders child with substituted text content', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                  component: 'labeled-input',
                  vars: { label: 'Email Address', placeholder: 'Enter your email' },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="label"]')).toHaveText('Email Address')
        await expect(page.locator('input')).toHaveAttribute('placeholder', 'Enter your email')
      })

      await test.step('APP-COMPONENTS-CHILDREN-006: Renders composite UI pattern with all child elements', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                  component: 'pricing-card',
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
        await page.goto('/')
        await expect(page.locator('h3')).toHaveText('Pro')
        await expect(page.locator('p')).toHaveText('$49/mo')
        await expect(page.locator('button')).toHaveText('Get Started')
      })

      await test.step('APP-COMPONENTS-CHILDREN-007: Renders SVG icon with substituted name and color', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                { component: 'badge-with-icon', vars: { icon: 'check-circle', color: 'green' } },
              ],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="icon-check-circle"]')).toBeVisible()
        await expect(page.locator('[data-testid="icon-check-circle"]')).toHaveAttribute(
          'data-color',
          'green'
        )
      })

      await test.step('APP-COMPONENTS-CHILDREN-008: Renders text element with substituted content', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                  component: 'simple-message',
                  vars: { message: 'Welcome back!' },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="component-simple-message"]')).toContainText(
          'Welcome back!'
        )
      })

      await test.step('APP-COMPONENTS-CHILDREN-009: Renders all children with substituted values throughout tree', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
                  component: 'alert-card',
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
        await page.goto('/')
        const card = page.locator('[data-testid="component-alert-card"]')
        await expect(card).toHaveClass(/alert-success/)
        await expect(page.locator('h4')).toHaveText('Success!')
      })

      await test.step('APP-COMPONENTS-CHILDREN-010: Renders hierarchical DOM tree with proper nesting', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
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
              sections: [{ component: 'page-section', vars: { content: 'Content here' } }],
            },
          ],
        })
        await page.goto('/')
        const section = page.locator('[data-testid="component-page-section"]')
        await expect(section.locator('.container .row .col')).toHaveText('Content here')
      })
    }
  )
})
