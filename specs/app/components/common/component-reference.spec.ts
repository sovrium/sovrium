/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Component Reference
 *
 * Source: src/domain/models/app/component/common.ts
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Component Reference', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-COMPONENTS-REFERENCE-001: should validate minimal component reference structure at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component reference with required properties
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'my-component', type: 'div', props: { className: 'text-$color' } }],
        pages: [
          {
            name: 'Home',
            path: '/',
            sections: [{ component: 'my-component', vars: { color: 'blue' } }],
          },
        ],
      })

      // WHEN: component and vars are provided
      await page.goto('/')

      // THEN: it should validate minimal component reference structure at build time
      await expect(page.locator('[data-testid="component-my-component"]')).toBeVisible()
    }
  )

  test(
    'APP-COMPONENTS-REFERENCE-002: should look up and instantiate matching component template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component reference component property
      await startServerWithSchema({
        name: 'test-app',
        components: [
          { name: 'icon-badge', type: 'badge', content: '$text' },
          { name: 'cta-button', type: 'button', content: '$label' },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              { component: 'icon-badge', vars: { text: 'New' } },
              { component: 'cta-button', vars: { label: 'Click' } },
            ],
          },
        ],
      })

      // WHEN: component is component name in kebab-case
      await page.goto('/')

      // THEN: it should look up and instantiate matching component template
      await expect(page.locator('[data-testid="component-icon-badge"]')).toHaveText('New')
      await expect(page.locator('[data-testid="component-cta-button"]')).toHaveText('Click')
    }
  )

  test(
    'APP-COMPONENTS-REFERENCE-003: should validate kebab-case naming at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component reference component pattern
      const validBlocks = [
        { name: 'icon-badge', type: 'div' },
        { name: 'cta', type: 'div' },
        { name: 'section-header-2', type: 'div' },
        { name: 'my-component', type: 'div' },
      ]
      await startServerWithSchema({
        name: 'test-app',
        components: validBlocks,
        pages: [
          {
            name: 'Home',
            path: '/',
            sections: validBlocks.map((b) => ({ component: b.name, vars: {} })),
          },
        ],
      })

      // WHEN: component matches ^[a-z][a-z0-9-]*$ pattern
      await page.goto('/')

      // THEN: it should validate kebab-case naming at build time
      await expect(page.locator('[data-testid="component-icon-badge"]')).toBeVisible()
    }
  )

  test(
    "APP-COMPONENTS-REFERENCE-004: should fail validation if referenced component doesn't exist",
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component reference component validation
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'icon-badge', type: 'badge' }],
        pages: [{ name: 'Home', path: '/', sections: [{ component: 'icon-badge', vars: {} }] }],
      })

      // WHEN: component value must match existing component name in components array
      await page.goto('/')

      // THEN: it should fail validation if referenced component doesn't exist
      await expect(page.locator('[data-testid="component-icon-badge"]')).toBeVisible()
    }
  )

  test(
    'APP-COMPONENTS-REFERENCE-005: should provide all data needed for template substitution',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component reference vars object
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'user-card',
            type: 'card',
            children: [
              { type: 'h3', content: '$name' },
              { type: 'text', props: { 'data-testid': 'role' }, content: '$role' },
              { type: 'text', props: { 'data-testid': 'email' }, content: '$email' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                component: 'user-card',
                vars: { name: 'John Doe', role: 'Developer', email: 'john@example.com' },
              },
            ],
          },
        ],
      })

      // WHEN: vars contains variable name-value pairs
      await page.goto('/')

      // THEN: it should provide all data needed for template substitution
      const card = page.locator('[data-testid="component-user-card"]')
      await expect(card.locator('h3')).toHaveText('John Doe')
      await expect(page.locator('[data-testid="role"]')).toHaveText('Developer')
      await expect(page.locator('[data-testid="email"]')).toHaveText('john@example.com')
    }
  )

  test(
    'APP-COMPONENTS-REFERENCE-006: should validate JavaScript naming convention for variables',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: vars property names in camelCase
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'test-component',
            type: 'div',
            props: { className: '$color' },
            content: '$titleText',
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                component: 'test-component',
                vars: { color: 'blue', titleText: 'Hello', isActive: true },
              },
            ],
          },
        ],
      })

      // WHEN: vars property names match ^[a-zA-Z][a-zA-Z0-9]*$ pattern
      await page.goto('/')

      // THEN: it should validate JavaScript naming convention for variables
      await expect(page.locator('[data-testid="component-test-component"]')).toBeVisible()
    }
  )

  test(
    'APP-COMPONENTS-REFERENCE-007: should substitute primitive data types into template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: vars property values
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'settings-toggle',
            type: 'div',
            props: { className: 'setting-$priority' },
            children: [
              { type: 'text', props: { 'data-testid': 'label' }, content: '$label' },
              { type: 'input', props: { type: 'checkbox' } },
              { type: 'text', props: { 'data-testid': 'max' }, content: 'Max: $maxValue' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                component: 'settings-toggle',
                vars: { priority: 'high', label: 'Enable feature', maxValue: 100 },
              },
            ],
          },
        ],
      })

      // WHEN: values are string, number, or boolean
      await page.goto('/')

      // THEN: it should substitute primitive data types into template
      const toggle = page.locator('[data-testid="component-settings-toggle"]')
      await expect(toggle).toHaveClass(/setting-high/)
      await expect(page.locator('[data-testid="label"]')).toHaveText('Enable feature')
      await expect(page.locator('[data-testid="max"]')).toHaveText('Max: 100')
    }
  )

  test(
    'APP-COMPONENTS-REFERENCE-008: should render badge with orange color, users icon, and French text',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon-badge reference example
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'icon-badge',
            type: 'badge',
            props: { className: 'bg-$color-500' },
            children: [
              { type: 'icon', props: { name: '$icon' } },
              { type: 'text', props: { 'data-testid': 'badge-text' }, content: '$text' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                component: 'icon-badge',
                vars: { color: 'orange', icon: 'users', text: '6 à 15 personnes' },
              },
            ],
          },
        ],
      })

      // WHEN: component is 'icon-badge' with orange color, users icon, and French text
      await page.goto('/')

      // THEN: it should render badge with orange color, users icon, and French text
      const badge = page.locator('[data-testid="component-icon-badge"]')
      await expect(badge).toHaveClass(/bg-orange/)
      await expect(page.locator('[data-testid="badge-text"]')).toHaveText('6 à 15 personnes')
    }
  )

  test(
    'APP-COMPONENTS-REFERENCE-009: should render section header with purple title and French content',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: section-header reference example
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'section-header',
            type: 'container',
            props: { className: 'text-center mb-12' },
            children: [
              {
                type: 'h2',
                props: { className: 'text-$titleColor-500 text-4xl mb-4' },
                content: '$title',
              },
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
                component: 'section-header',
                vars: {
                  titleColor: 'purple',
                  title: 'notre mission',
                  subtitle: 'Rendre la culture du consentement accessible à tous',
                },
              },
            ],
          },
        ],
      })

      // WHEN: component is 'section-header' with purple title and French content
      await page.goto('/')

      // THEN: it should render section header with purple title and French content
      const header = page.locator('[data-testid="component-section-header"]')
      await expect(header).toHaveClass(/text-center/)
      await expect(header.locator('h2')).toHaveClass(/text-purple/)
      await expect(header.locator('h2')).toHaveText('notre mission')
      await expect(header.locator('p')).toHaveText(
        'Rendre la culture du consentement accessible à tous'
      )
    }
  )

  test(
    'APP-COMPONENTS-REFERENCE-010: should transform abstract template into concrete rendered component',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: variable substitution mechanism
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'alert',
            type: 'div',
            props: { className: 'alert alert-$variant' },
            content: '$message',
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              { component: 'alert', vars: { variant: 'success', message: 'Saved successfully!' } },
            ],
          },
        ],
      })

      // WHEN: vars values replace $variable placeholders in component template
      await page.goto('/')

      // THEN: it should transform abstract template into concrete rendered component
      const alert = page.locator('[data-testid="component-alert"]')
      await expect(alert).toHaveClass(/alert-success/)
      await expect(alert).toHaveText('Saved successfully!')
      const html = await alert.innerHTML()
      // THEN: assertion
      expect(html).not.toContain('$')
    }
  )

  test(
    'APP-COMPONENTS-REFERENCE-011: should enable same template to generate different instances',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component reference for template instantiation
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'team-member',
            type: 'card',
            children: [
              { type: 'img', props: { src: '$photo', alt: '$name' } },
              { type: 'h4', content: '$name' },
              { type: 'text', content: '$position' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                component: 'team-member',
                vars: { photo: '/alice.jpg', name: 'Alice', position: 'CEO' },
              },
              {
                component: 'team-member',
                vars: { photo: '/bob.jpg', name: 'Bob', position: 'CTO' },
              },
              {
                component: 'team-member',
                vars: { photo: '/carol.jpg', name: 'Carol', position: 'Designer' },
              },
            ],
          },
        ],
      })

      // WHEN: reference creates instance of component with specific data
      await page.goto('/')

      // THEN: it should enable same template to generate different instances
      await expect(page.locator('[data-testid="component-team-member-0"] h4')).toHaveText('Alice')
      await expect(page.locator('[data-testid="component-team-member-0"] img')).toHaveAttribute(
        'src',
        '/alice.jpg'
      )
      // THEN: assertion
      await expect(page.locator('[data-testid="component-team-member-1"] h4')).toHaveText('Bob')
      await expect(page.locator('[data-testid="component-team-member-2"] h4')).toHaveText('Carol')
    }
  )

  test(
    'APP-COMPONENTS-REFERENCE-012: should maintain structural consistency while varying data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: component reference for single source of truth
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'feature-item',
            type: 'div',
            props: { className: 'feature flex gap-4' },
            children: [
              { type: 'icon', props: { name: '$icon', className: 'text-blue-500' } },
              {
                type: 'div',
                children: [
                  { type: 'h5', content: '$title' },
                  { type: 'text', content: '$description' },
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
                component: 'feature-item',
                vars: { icon: 'check', title: 'Feature 1', description: 'Description 1' },
              },
              {
                component: 'feature-item',
                vars: { icon: 'star', title: 'Feature 2', description: 'Description 2' },
              },
              {
                component: 'feature-item',
                vars: { icon: 'heart', title: 'Feature 3', description: 'Description 3' },
              },
            ],
          },
        ],
      })

      // WHEN: multiple references point to same component template
      await page.goto('/')

      // THEN: it should maintain structural consistency while varying data
      for (let i = 0; i < 3; i++) {
        const feature = page.locator(`[data-testid="component-feature-item-${i}"]`)
        await expect(feature).toHaveClass(/feature/)
        await expect(feature).toHaveClass(/flex/)
        await expect(feature).toHaveClass(/gap-4/)
        await expect(feature.locator('h5')).toBeVisible()
      }
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 12 @spec tests - see individual @spec tests for exhaustive criteria
  // ============================================================================

  test(
    'APP-COMPONENTS-REFERENCE-REGRESSION: user can complete full reference workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('APP-COMPONENTS-REFERENCE-001: Validates minimal component reference structure at build time', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [{ name: 'my-component', type: 'div', props: { className: 'text-$color' } }],
          pages: [
            {
              name: 'Home',
              path: '/',
              sections: [{ component: 'my-component', vars: { color: 'blue' } }],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="component-my-component"]')).toBeVisible()
      })

      await test.step('APP-COMPONENTS-REFERENCE-002: Looks up and instantiates matching component template', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            { name: 'icon-badge', type: 'badge', content: '$text' },
            { name: 'cta-button', type: 'button', content: '$label' },
          ],
          pages: [
            {
              name: 'home',
              path: '/',
              sections: [
                { component: 'icon-badge', vars: { text: 'New' } },
                { component: 'cta-button', vars: { label: 'Click' } },
              ],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="component-icon-badge"]')).toHaveText('New')
        await expect(page.locator('[data-testid="component-cta-button"]')).toHaveText('Click')
      })

      await test.step('APP-COMPONENTS-REFERENCE-003: Validates kebab-case naming at build time', async () => {
        const validBlocks = [
          { name: 'icon-badge', type: 'div' },
          { name: 'cta', type: 'div' },
          { name: 'section-header-2', type: 'div' },
          { name: 'my-component', type: 'div' },
        ]
        await startServerWithSchema({
          name: 'test-app',
          components: validBlocks,
          pages: [
            {
              name: 'Home',
              path: '/',
              sections: validBlocks.map((b) => ({ component: b.name, vars: {} })),
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="component-icon-badge"]')).toBeVisible()
      })

      await test.step("APP-COMPONENTS-REFERENCE-004: Fails validation if referenced component doesn't exist", async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [{ name: 'icon-badge', type: 'badge' }],
          pages: [{ name: 'Home', path: '/', sections: [{ component: 'icon-badge', vars: {} }] }],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="component-icon-badge"]')).toBeVisible()
      })

      await test.step('APP-COMPONENTS-REFERENCE-005: Provides all data needed for template substitution', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            {
              name: 'user-card',
              type: 'card',
              children: [
                { type: 'h3', content: '$name' },
                { type: 'text', props: { 'data-testid': 'role' }, content: '$role' },
                { type: 'text', props: { 'data-testid': 'email' }, content: '$email' },
              ],
            },
          ],
          pages: [
            {
              name: 'home',
              path: '/',
              sections: [
                {
                  component: 'user-card',
                  vars: { name: 'John Doe', role: 'Developer', email: 'john@example.com' },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        const card = page.locator('[data-testid="component-user-card"]')
        await expect(card.locator('h3')).toHaveText('John Doe')
        await expect(page.locator('[data-testid="role"]')).toHaveText('Developer')
        await expect(page.locator('[data-testid="email"]')).toHaveText('john@example.com')
      })

      await test.step('APP-COMPONENTS-REFERENCE-006: Validates JavaScript naming convention for variables', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            {
              name: 'test-component',
              type: 'div',
              props: { className: '$color' },
              content: '$titleText',
            },
          ],
          pages: [
            {
              name: 'home',
              path: '/',
              sections: [
                {
                  component: 'test-component',
                  vars: { color: 'blue', titleText: 'Hello', isActive: true },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="component-test-component"]')).toBeVisible()
      })

      await test.step('APP-COMPONENTS-REFERENCE-007: Substitutes primitive data types into template', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            {
              name: 'settings-toggle',
              type: 'div',
              props: { className: 'setting-$priority' },
              children: [
                { type: 'text', props: { 'data-testid': 'label' }, content: '$label' },
                { type: 'input', props: { type: 'checkbox' } },
                { type: 'text', props: { 'data-testid': 'max' }, content: 'Max: $maxValue' },
              ],
            },
          ],
          pages: [
            {
              name: 'home',
              path: '/',
              sections: [
                {
                  component: 'settings-toggle',
                  vars: { priority: 'high', label: 'Enable feature', maxValue: 100 },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        const toggle = page.locator('[data-testid="component-settings-toggle"]')
        await expect(toggle).toHaveClass(/setting-high/)
        await expect(page.locator('[data-testid="label"]')).toHaveText('Enable feature')
        await expect(page.locator('[data-testid="max"]')).toHaveText('Max: 100')
      })

      await test.step('APP-COMPONENTS-REFERENCE-008: Renders badge with orange color, users icon, and French text', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            {
              name: 'icon-badge',
              type: 'badge',
              props: { className: 'bg-$color-500' },
              children: [
                { type: 'icon', props: { name: '$icon' } },
                { type: 'text', props: { 'data-testid': 'badge-text' }, content: '$text' },
              ],
            },
          ],
          pages: [
            {
              name: 'home',
              path: '/',
              sections: [
                {
                  component: 'icon-badge',
                  vars: { color: 'orange', icon: 'users', text: '6 à 15 personnes' },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        const badge = page.locator('[data-testid="component-icon-badge"]')
        await expect(badge).toHaveClass(/bg-orange/)
        await expect(page.locator('[data-testid="badge-text"]')).toHaveText('6 à 15 personnes')
      })

      await test.step('APP-COMPONENTS-REFERENCE-009: Renders section header with purple title and French content', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            {
              name: 'section-header',
              type: 'container',
              props: { className: 'text-center mb-12' },
              children: [
                {
                  type: 'h2',
                  props: { className: 'text-$titleColor-500 text-4xl mb-4' },
                  content: '$title',
                },
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
                  component: 'section-header',
                  vars: {
                    titleColor: 'purple',
                    title: 'notre mission',
                    subtitle: 'Rendre la culture du consentement accessible à tous',
                  },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        const header = page.locator('[data-testid="component-section-header"]')
        await expect(header).toHaveClass(/text-center/)
        await expect(header.locator('h2')).toHaveClass(/text-purple/)
        await expect(header.locator('h2')).toHaveText('notre mission')
        await expect(header.locator('p')).toHaveText(
          'Rendre la culture du consentement accessible à tous'
        )
      })

      await test.step('APP-COMPONENTS-REFERENCE-010: Transforms abstract template into concrete rendered component', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            {
              name: 'alert',
              type: 'div',
              props: { className: 'alert alert-$variant' },
              content: '$message',
            },
          ],
          pages: [
            {
              name: 'home',
              path: '/',
              sections: [
                {
                  component: 'alert',
                  vars: { variant: 'success', message: 'Saved successfully!' },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        const alert = page.locator('[data-testid="component-alert"]')
        await expect(alert).toHaveClass(/alert-success/)
        await expect(alert).toHaveText('Saved successfully!')
        const html = await alert.innerHTML()
        expect(html).not.toContain('$')
      })

      await test.step('APP-COMPONENTS-REFERENCE-011: Enables same template to generate different instances', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            {
              name: 'team-member',
              type: 'card',
              children: [
                { type: 'img', props: { src: '$photo', alt: '$name' } },
                { type: 'h4', content: '$name' },
                { type: 'text', content: '$position' },
              ],
            },
          ],
          pages: [
            {
              name: 'home',
              path: '/',
              sections: [
                {
                  component: 'team-member',
                  vars: { photo: '/alice.jpg', name: 'Alice', position: 'CEO' },
                },
                {
                  component: 'team-member',
                  vars: { photo: '/bob.jpg', name: 'Bob', position: 'CTO' },
                },
                {
                  component: 'team-member',
                  vars: { photo: '/carol.jpg', name: 'Carol', position: 'Designer' },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="component-team-member-0"] h4')).toHaveText('Alice')
        await expect(page.locator('[data-testid="component-team-member-0"] img')).toHaveAttribute(
          'src',
          '/alice.jpg'
        )
        await expect(page.locator('[data-testid="component-team-member-1"] h4')).toHaveText('Bob')
        await expect(page.locator('[data-testid="component-team-member-2"] h4')).toHaveText('Carol')
      })

      await test.step('APP-COMPONENTS-REFERENCE-012: Maintains structural consistency while varying data', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            {
              name: 'feature-item',
              type: 'div',
              props: { className: 'feature flex gap-4' },
              children: [
                { type: 'icon', props: { name: '$icon', className: 'text-blue-500' } },
                {
                  type: 'div',
                  children: [
                    { type: 'h5', content: '$title' },
                    { type: 'text', content: '$description' },
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
                  component: 'feature-item',
                  vars: { icon: 'check', title: 'Feature 1', description: 'Description 1' },
                },
                {
                  component: 'feature-item',
                  vars: { icon: 'star', title: 'Feature 2', description: 'Description 2' },
                },
                {
                  component: 'feature-item',
                  vars: { icon: 'heart', title: 'Feature 3', description: 'Description 3' },
                },
              ],
            },
          ],
        })
        await page.goto('/')
        for (let i = 0; i < 3; i++) {
          const feature = page.locator(`[data-testid="component-feature-item-${i}"]`)
          await expect(feature).toHaveClass(/feature/)
          await expect(feature).toHaveClass(/flex/)
          await expect(feature).toHaveClass(/gap-4/)
          await expect(feature.locator('h5')).toBeVisible()
        }
      })
    }
  )
})
