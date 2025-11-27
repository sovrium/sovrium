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
        blocks: [{ name: 'my-component-name', type: 'div' }],
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ block: 'my-component-name', vars: {} }],
          },
        ],
      })

      // WHEN: value is 'my-component-name'
      await page.goto('/')

      // THEN: it should validate as kebabCase pattern
      await expect(page.locator('[data-testid="block-my-component-name"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-003: should validate as variableName pattern',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a variable name
      await startServerWithSchema({
        name: 'test-app',
        blocks: [{ name: 'test-block', type: 'div', content: '$myVariable123' }],
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ block: 'test-block', vars: { myVariable123: 'Hello' } }],
          },
        ],
      })

      // WHEN: value is 'myVariable123'
      await page.goto('/')

      // THEN: it should validate as variableName pattern
      await expect(page.locator('[data-testid="block-test-block"]')).toHaveText('Hello')
    }
  )

  test(
    'APP-PAGES-DEFINITIONS-004: should validate as variableReference pattern',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a string with variable reference
      await startServerWithSchema({
        name: 'test-app',
        blocks: [{ name: 'welcome', type: 'div', content: 'Welcome to $siteName' }],
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [{ block: 'welcome', vars: { siteName: 'My Site' } }],
          },
        ],
      })

      // WHEN: value is 'Welcome to $siteName'
      await page.goto('/')

      // THEN: it should validate as variableReference pattern
      await expect(page.locator('[data-testid="block-welcome"]')).toHaveText('Welcome to My Site')
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
            layout: { navigation: { logo: './public/logo.svg' } },
            sections: [],
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
            layout: { footer: { email: 'user@example.com' } },
            sections: [],
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
        blocks: [
          {
            name: 'icon-block',
            type: 'div',
            children: [{ type: 'icon', props: { name: 'arrow-right' } }],
          },
        ],
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ block: 'icon-block', vars: {} }],
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
        blocks: [
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
            sections: [{ block: 'icons', vars: {} }],
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
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-DEFINITIONS-013: user can complete full definitions workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application using various common definitions
      await startServerWithSchema({
        name: 'test-app',
        theme: { colors: { primary: '#3B82F6' } },
        blocks: [
          { name: 'my-component', type: 'div', content: 'Welcome to $siteName' },
          {
            name: 'icon-row',
            type: 'div',
            children: [
              { type: 'icon', props: { name: 'check' } },
              { type: 'icon', props: { name: 'star' } },
            ],
          },
        ],
        pages: [
          {
            name: 'Test Page',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              openGraph: { image: 'https://example.com/og.jpg' },
            },
            layout: { navigation: { logo: './logo.svg' } },
            sections: [
              { block: 'my-component', vars: { siteName: 'My Site' } },
              { block: 'icon-row', vars: {} },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // Verify variable reference
      // THEN: assertion
      await expect(page.locator('[data-testid="block-my-component"]')).toHaveText(
        'Welcome to My Site'
      )

      // Verify icons
      // THEN: assertion
      await expect(page.locator('[data-testid="icon-check"]')).toBeVisible()
      await expect(page.locator('[data-testid="icon-star"]')).toBeVisible()

      // Verify URL
      // THEN: assertion
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        'https://example.com/og.jpg'
      )

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
