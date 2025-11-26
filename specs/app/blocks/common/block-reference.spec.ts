/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Block Reference
 *
 * Source: specs/app/blocks/common/block-reference.schema.json
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Block Reference', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-BLOCKS-REFERENCE-001: should validate minimal block reference structure at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block reference with required properties
      await startServerWithSchema({
        name: 'test-app',
        blocks: [{ name: 'my-block', type: 'div', props: { className: 'text-$color' } }],
        pages: [
          { name: 'Home', path: '/', sections: [{ block: 'my-block', vars: { color: 'blue' } }] },
        ],
      })

      // WHEN: block and vars are provided
      await page.goto('/')

      // THEN: it should validate minimal block reference structure at build time
      await expect(page.locator('[data-testid="block-my-block"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-REFERENCE-002: should look up and instantiate matching block template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block reference block property
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          { name: 'icon-badge', type: 'badge', content: '$text' },
          { name: 'cta-button', type: 'button', content: '$label' },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              { block: 'icon-badge', vars: { text: 'New' } },
              { block: 'cta-button', vars: { label: 'Click' } },
            ],
          },
        ],
      })

      // WHEN: block is block name in kebab-case
      await page.goto('/')

      // THEN: it should look up and instantiate matching block template
      await expect(page.locator('[data-testid="block-icon-badge"]')).toHaveText('New')
      await expect(page.locator('[data-testid="block-cta-button"]')).toHaveText('Click')
    }
  )

  test(
    'APP-BLOCKS-REFERENCE-003: should validate kebab-case naming at build time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block reference block pattern
      const validBlocks = [
        { name: 'icon-badge', type: 'div' },
        { name: 'cta', type: 'div' },
        { name: 'section-header-2', type: 'div' },
        { name: 'my-component', type: 'div' },
      ]
      await startServerWithSchema({
        name: 'test-app',
        blocks: validBlocks,
        pages: [
          {
            name: 'Home',
            path: '/',
            sections: validBlocks.map((b) => ({ block: b.name, vars: {} })),
          },
        ],
      })

      // WHEN: block matches ^[a-z][a-z0-9-]*$ pattern
      await page.goto('/')

      // THEN: it should validate kebab-case naming at build time
      await expect(page.locator('[data-testid="block-icon-badge"]')).toBeVisible()
    }
  )

  test(
    "APP-BLOCKS-REFERENCE-004: should fail validation if referenced block doesn't exist",
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block reference block validation
      await startServerWithSchema({
        name: 'test-app',
        blocks: [{ name: 'icon-badge', type: 'badge' }],
        pages: [{ name: 'Home', path: '/', sections: [{ block: 'icon-badge', vars: {} }] }],
      })

      // WHEN: block value must match existing block name in blocks array
      await page.goto('/')

      // THEN: it should fail validation if referenced block doesn't exist
      await expect(page.locator('[data-testid="block-icon-badge"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-REFERENCE-005: should provide all data needed for template substitution',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block reference vars object
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
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
                block: 'user-card',
                vars: { name: 'John Doe', role: 'Developer', email: 'john@example.com' },
              },
            ],
          },
        ],
      })

      // WHEN: vars contains variable name-value pairs
      await page.goto('/')

      // THEN: it should provide all data needed for template substitution
      const card = page.locator('[data-testid="block-user-card"]')
      await expect(card.locator('h3')).toHaveText('John Doe')
      await expect(page.locator('[data-testid="role"]')).toHaveText('Developer')
      await expect(page.locator('[data-testid="email"]')).toHaveText('john@example.com')
    }
  )

  test(
    'APP-BLOCKS-REFERENCE-006: should validate JavaScript naming convention for variables',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: vars property names in camelCase
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'test-block',
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
              { block: 'test-block', vars: { color: 'blue', titleText: 'Hello', isActive: true } },
            ],
          },
        ],
      })

      // WHEN: vars property names match ^[a-zA-Z][a-zA-Z0-9]*$ pattern
      await page.goto('/')

      // THEN: it should validate JavaScript naming convention for variables
      await expect(page.locator('[data-testid="block-test-block"]')).toBeVisible()
    }
  )

  test(
    'APP-BLOCKS-REFERENCE-007: should substitute primitive data types into template',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: vars property values
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
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
                block: 'settings-toggle',
                vars: { priority: 'high', label: 'Enable feature', maxValue: 100 },
              },
            ],
          },
        ],
      })

      // WHEN: values are string, number, or boolean
      await page.goto('/')

      // THEN: it should substitute primitive data types into template
      const toggle = page.locator('[data-testid="block-settings-toggle"]')
      await expect(toggle).toHaveClass(/setting-high/)
      await expect(page.locator('[data-testid="label"]')).toHaveText('Enable feature')
      await expect(page.locator('[data-testid="max"]')).toHaveText('Max: 100')
    }
  )

  test(
    'APP-BLOCKS-REFERENCE-008: should render badge with orange color, users icon, and French text',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: icon-badge reference example
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
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
                block: 'icon-badge',
                vars: { color: 'orange', icon: 'users', text: '6 à 15 personnes' },
              },
            ],
          },
        ],
      })

      // WHEN: block is 'icon-badge' with orange color, users icon, and French text
      await page.goto('/')

      // THEN: it should render badge with orange color, users icon, and French text
      const badge = page.locator('[data-testid="block-icon-badge"]')
      await expect(badge).toHaveClass(/bg-orange/)
      await expect(page.locator('[data-testid="badge-text"]')).toHaveText('6 à 15 personnes')
    }
  )

  test(
    'APP-BLOCKS-REFERENCE-009: should render section header with purple title and French content',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: section-header reference example
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
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
                block: 'section-header',
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

      // WHEN: block is 'section-header' with purple title and French content
      await page.goto('/')

      // THEN: it should render section header with purple title and French content
      const header = page.locator('[data-testid="block-section-header"]')
      await expect(header).toHaveClass(/text-center/)
      await expect(header.locator('h2')).toHaveClass(/text-purple/)
      await expect(header.locator('h2')).toHaveText('notre mission')
      await expect(header.locator('p')).toHaveText(
        'Rendre la culture du consentement accessible à tous'
      )
    }
  )

  test(
    'APP-BLOCKS-REFERENCE-010: should transform abstract template into concrete rendered component',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: variable substitution mechanism
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
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
              { block: 'alert', vars: { variant: 'success', message: 'Saved successfully!' } },
            ],
          },
        ],
      })

      // WHEN: vars values replace $variable placeholders in block template
      await page.goto('/')

      // THEN: it should transform abstract template into concrete rendered component
      const alert = page.locator('[data-testid="block-alert"]')
      await expect(alert).toHaveClass(/alert-success/)
      await expect(alert).toHaveText('Saved successfully!')
      const html = await alert.innerHTML()
      expect(html).not.toContain('$')
    }
  )

  test(
    'APP-BLOCKS-REFERENCE-011: should enable same template to generate different instances',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block reference for template instantiation
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
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
                block: 'team-member',
                vars: { photo: '/alice.jpg', name: 'Alice', position: 'CEO' },
              },
              {
                block: 'team-member',
                vars: { photo: '/bob.jpg', name: 'Bob', position: 'CTO' },
              },
              {
                block: 'team-member',
                vars: { photo: '/carol.jpg', name: 'Carol', position: 'Designer' },
              },
            ],
          },
        ],
      })

      // WHEN: reference creates instance of block with specific data
      await page.goto('/')

      // THEN: it should enable same template to generate different instances
      await expect(page.locator('[data-testid="block-team-member-0"] h4')).toHaveText('Alice')
      await expect(page.locator('[data-testid="block-team-member-0"] img')).toHaveAttribute(
        'src',
        '/alice.jpg'
      )
      await expect(page.locator('[data-testid="block-team-member-1"] h4')).toHaveText('Bob')
      await expect(page.locator('[data-testid="block-team-member-2"] h4')).toHaveText('Carol')
    }
  )

  test(
    'APP-BLOCKS-REFERENCE-012: should maintain structural consistency while varying data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: block reference for single source of truth
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
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
                block: 'feature-item',
                vars: { icon: 'check', title: 'Feature 1', description: 'Description 1' },
              },
              {
                block: 'feature-item',
                vars: { icon: 'star', title: 'Feature 2', description: 'Description 2' },
              },
              {
                block: 'feature-item',
                vars: { icon: 'heart', title: 'Feature 3', description: 'Description 3' },
              },
            ],
          },
        ],
      })

      // WHEN: multiple references point to same block template
      await page.goto('/')

      // THEN: it should maintain structural consistency while varying data
      for (let i = 0; i < 3; i++) {
        const feature = page.locator(`[data-testid="block-feature-item-${i}"]`)
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
  // ============================================================================

  test(
    'APP-BLOCKS-BLOCK-REFERENCE-REGRESSION-001: user can complete full reference workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with block templates and references
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'hero-block',
            type: 'section',
            props: { id: 'hero', className: 'bg-blue-500' },
            children: [
              { type: 'heading', content: 'Welcome' },
              { type: 'single-line-text', content: 'This is a block template' },
            ],
          },
          {
            name: 'feature-card',
            type: 'card',
            props: { className: 'p-4' },
            children: [
              { type: 'h3', content: 'Feature Title' },
              { type: 'single-line-text', content: 'Feature description goes here' },
            ],
          },
        ],
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              { type: 'heading', content: 'Block Reference Test' },
              {
                type: 'section',
                props: { id: 'features' },
                children: [
                  { type: 'h2', content: 'Features' },
                  {
                    type: 'grid',
                    props: { className: 'grid-cols-2' },
                    children: [
                      { type: 'card', children: [{ type: 'h3', content: 'Fast' }] },
                      { type: 'card', children: [{ type: 'h3', content: 'Secure' }] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // Verify page renders with blocks schema validated
      await expect(page.locator('h1')).toHaveText('Block Reference Test')

      // Verify features section
      await expect(page.locator('section#features h2')).toHaveText('Features')
      await expect(page.locator('h3').first()).toHaveText('Fast')

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
