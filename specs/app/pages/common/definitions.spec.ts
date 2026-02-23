/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Common Definitions
 *
 * Source: src/domain/models/app/page/common.ts
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Common Definitions', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-DEFINITIONS-001: should validate as nonEmptyString',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a non-empty string
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'hello',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [],
          },
        ],
      })

      // WHEN: value is 'hello'
      await page.goto('/')

      // THEN: it should validate as nonEmptyString
      await expect(page.locator('[data-testid="page-hello"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-002: should validate as kebabCase pattern',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a kebab-case string
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'my-component-name', type: 'div' }],
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ component: 'my-component-name', vars: {} }],
          },
        ],
      })

      // WHEN: value is 'my-component-name'
      await page.goto('/')

      // THEN: it should validate as kebabCase pattern
      await expect(page.locator('[data-testid="component-my-component-name"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-003: should validate as variableName pattern',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a variable name
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'test-component', type: 'div', content: '$myVariable123' }],
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ component: 'test-component', vars: { myVariable123: 'Hello' } }],
          },
        ],
      })

      // WHEN: value is 'myVariable123'
      await page.goto('/')

      // THEN: it should validate as variableName pattern
      await expect(page.locator('[data-testid="component-test-component"]')).toHaveText('Hello')
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-004: should validate as variableReference pattern',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a string with variable reference
      await startServerWithSchema({
        name: 'test-app',
        components: [{ name: 'welcome', type: 'div', content: 'Welcome to $siteName' }],
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ component: 'welcome', vars: { siteName: 'My Site' } }],
          },
        ],
      })

      // WHEN: value is 'Welcome to $siteName'
      await page.goto('/')

      // THEN: it should validate as variableReference pattern
      await expect(page.locator('[data-testid="component-welcome"]')).toHaveText(
        'Welcome to My Site'
      )
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-005: should validate as hexColor pattern',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a 6-digit hex color
      await startServerWithSchema({
        name: 'test-app',
        theme: { colors: { custom: '#FF5733' } },
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ type: 'div', props: { className: 'bg-custom' }, children: ['Test'] }],
          },
        ],
      })

      // WHEN: value is '#FF5733'
      await page.goto('/')

      // THEN: it should validate as hexColor pattern
      const element = page.locator('div.bg-custom')
      await expect(element).toHaveCSS('background-color', 'rgb(255, 87, 51)')
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-006: should validate as url with http/https protocol',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an HTTP URL
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              openGraph: { image: 'https://example.com/image.jpg' },
            },
            sections: [],
          },
        ],
      })

      // WHEN: value is 'https://example.com/path'
      await page.goto('/')

      // THEN: it should validate as url with http/https protocol
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        'https://example.com/image.jpg'
      )
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-007: should validate as relativePath pattern',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a relative path
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ type: 'img', props: { src: './public/logo.svg', alt: 'Logo' } }],
          },
        ],
      })

      // WHEN: value is './public/logo.svg'
      await page.goto('/')

      // THEN: it should validate as relativePath pattern
      await expect(page.locator('img[src="./public/logo.svg"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-008: should validate as emailAddress format',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an email address
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              { type: 'a', props: { href: 'mailto:user@example.com' }, children: ['Contact'] },
            ],
          },
        ],
      })

      // WHEN: value is 'user@example.com'
      await page.goto('/')

      // THEN: it should validate as emailAddress format
      await expect(page.locator('a[href="mailto:user@example.com"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-009: should validate as className',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Tailwind CSS classes
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'div',
                props: { className: 'text-center bg-blue-500 p-4' },
                children: ['Content'],
              },
            ],
          },
        ],
      })

      // WHEN: value is 'text-center bg-blue-500 p-4'
      await page.goto('/')

      // THEN: it should validate as className
      const element = page.locator('div.text-center')
      await expect(element).toHaveClass(/text-center/)
      await expect(element).toHaveClass(/bg-blue-500/)
      await expect(element).toHaveClass(/p-4/)
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-010: should validate as iconName enum',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an icon from the icon library
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'icon-component',
            type: 'div',
            children: [{ type: 'icon', props: { name: 'arrow-right' } }],
          },
        ],
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ component: 'icon-component', vars: {} }],
          },
        ],
      })

      // WHEN: value is 'arrow-right'
      await page.goto('/')

      // THEN: it should validate as iconName enum
      await expect(page.locator('[data-testid="icon-arrow-right"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-011: should validate as dimensions object',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: dimensions with width and height
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'image',
                props: { src: '/image.jpg', width: 800, height: 600 },
                children: [],
              },
            ],
          },
        ],
      })

      // WHEN: value is { width: 800, height: 600 }
      await page.goto('/')

      // THEN: it should validate as dimensions object
      const img = page.locator('img[src="/image.jpg"]')
      await expect(img).toHaveAttribute('width', '800')
      await expect(img).toHaveAttribute('height', '600')
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-012: should provide comprehensive icon set for all UI needs',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: multiple icon names in the library
      await startServerWithSchema({
        name: 'test-app',
        components: [
          {
            name: 'icons',
            type: 'div',
            children: [
              { type: 'icon', props: { name: 'arrow-right' } },
              { type: 'icon', props: { name: 'check' } },
              { type: 'icon', props: { name: 'user' } },
              { type: 'icon', props: { name: 'star' } },
              { type: 'icon', props: { name: 'heart' } },
            ],
          },
        ],
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ component: 'icons', vars: {} }],
          },
        ],
      })

      // WHEN: 70+ icon names are defined (arrow-right, check, user, star, etc.)
      await page.goto('/')

      // THEN: it should provide comprehensive icon set for all UI needs
      await expect(page.locator('[data-testid="icon-arrow-right"]')).toBeVisible()
      await expect(page.locator('[data-testid="icon-check"]')).toBeVisible()
      await expect(page.locator('[data-testid="icon-user"]')).toBeVisible()
      await expect(page.locator('[data-testid="icon-star"]')).toBeVisible()
      await expect(page.locator('[data-testid="icon-heart"]')).toBeVisible()
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test covering all 12 @spec scenarios via grouped server setups
  // OPTIMIZATION: Consolidated from 12 startServerWithSchema calls to 3
  // ============================================================================

  test(
    'APP-PAGES-DEFINITIONS-REGRESSION: user can complete full definitions workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // Group 1: Component-based tests with variable substitution (002, 003, 004, 010, 012)
      // All components can coexist in a single schema
      await test.step('Setup: Start server with component-based configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            // 002: kebabCase component
            { name: 'my-component-name', type: 'div' },
            // 003: variableName component
            { name: 'test-component', type: 'div', content: '$myVariable123' },
            // 004: variableReference component
            { name: 'welcome', type: 'div', content: 'Welcome to $siteName' },
            // 010: single icon component
            {
              name: 'icon-component',
              type: 'div',
              children: [{ type: 'icon', props: { name: 'arrow-right' } }],
            },
            // 012: comprehensive icons component
            {
              name: 'icons',
              type: 'div',
              children: [
                { type: 'icon', props: { name: 'arrow-right' } },
                { type: 'icon', props: { name: 'check' } },
                { type: 'icon', props: { name: 'user' } },
                { type: 'icon', props: { name: 'star' } },
                { type: 'icon', props: { name: 'heart' } },
              ],
            },
          ],
          pages: [
            {
              name: 'test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [
                { component: 'my-component-name', vars: {} },
                { component: 'test-component', vars: { myVariable123: 'Hello' } },
                { component: 'welcome', vars: { siteName: 'My Site' } },
                { component: 'icon-component', vars: {} },
                { component: 'icons', vars: {} },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-PAGES-DEFINITIONS-002: Validate as kebabCase pattern', async () => {
        await expect(page.locator('[data-testid="component-my-component-name"]')).toBeVisible()
      })

      await test.step('APP-PAGES-DEFINITIONS-003: Validate as variableName pattern', async () => {
        await expect(page.locator('[data-testid="component-test-component"]')).toHaveText('Hello')
      })

      await test.step('APP-PAGES-DEFINITIONS-004: Validate as variableReference pattern', async () => {
        await expect(page.locator('[data-testid="component-welcome"]')).toHaveText(
          'Welcome to My Site'
        )
      })

      await test.step('APP-PAGES-DEFINITIONS-010: Validate as iconName enum', async () => {
        await expect(page.locator('[data-testid="icon-arrow-right"]').first()).toBeVisible()
      })

      await test.step('APP-PAGES-DEFINITIONS-012: Provide comprehensive icon set', async () => {
        await expect(page.locator('[data-testid="icon-arrow-right"]').first()).toBeVisible()
        await expect(page.locator('[data-testid="icon-check"]')).toBeVisible()
        await expect(page.locator('[data-testid="icon-user"]')).toBeVisible()
        await expect(page.locator('[data-testid="icon-star"]')).toBeVisible()
        await expect(page.locator('[data-testid="icon-heart"]')).toBeVisible()
      })

      // Group 2: Meta-based and sections tests (001, 005, 006, 007, 008, 009, 011)
      // All use different page properties that can coexist
      await test.step('Setup: Start server with meta/sections configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          theme: { colors: { custom: '#FF5733' } }, // 005: hexColor
          pages: [
            {
              name: 'hello', // 001: nonEmptyString
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test page',
                openGraph: { image: 'https://example.com/image.jpg' }, // 006: url
              },
              sections: [
                // 007: relativePath
                { type: 'img', props: { src: './public/logo.svg', alt: 'Logo' } },
                // 008: emailAddress
                { type: 'a', props: { href: 'mailto:user@example.com' }, children: ['Contact'] },
                // 005: hexColor bg
                { type: 'div', props: { className: 'bg-custom' }, children: ['Test'] },
                // 009: className
                {
                  type: 'div',
                  props: { className: 'text-center bg-blue-500 p-4' },
                  children: ['Content'],
                },
                // 011: dimensions
                {
                  type: 'image',
                  props: { src: '/image.jpg', width: 800, height: 600 },
                  children: [],
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-PAGES-DEFINITIONS-001: Validate as nonEmptyString', async () => {
        await expect(page.locator('[data-testid="page-hello"]')).toBeVisible()
      })

      await test.step('APP-PAGES-DEFINITIONS-005: Validate as hexColor pattern', async () => {
        const element = page.locator('div.bg-custom')
        await expect(element).toHaveCSS('background-color', 'rgb(255, 87, 51)')
      })

      await test.step('APP-PAGES-DEFINITIONS-006: Validate as url with http/https protocol', async () => {
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
          'content',
          'https://example.com/image.jpg'
        )
      })

      await test.step('APP-PAGES-DEFINITIONS-007: Validate as relativePath pattern', async () => {
        await expect(page.locator('img[src="./public/logo.svg"]')).toBeVisible()
      })

      await test.step('APP-PAGES-DEFINITIONS-008: Validate as emailAddress format', async () => {
        await expect(page.locator('a[href="mailto:user@example.com"]')).toBeVisible()
      })

      await test.step('APP-PAGES-DEFINITIONS-009: Validate as className', async () => {
        const element = page.locator('div.text-center')
        await expect(element).toHaveClass(/text-center/)
        await expect(element).toHaveClass(/bg-blue-500/)
        await expect(element).toHaveClass(/p-4/)
      })

      await test.step('APP-PAGES-DEFINITIONS-011: Validate as dimensions object', async () => {
        const img = page.locator('img[src="/image.jpg"]')
        await expect(img).toHaveAttribute('width', '800')
        await expect(img).toHaveAttribute('height', '600')
      })
    }
  )
})
