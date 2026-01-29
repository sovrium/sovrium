/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Component Props
 *
 * Source: src/domain/models/app/page/common.ts
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Component Props', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-PROPS-001: should accept string property',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props with string value
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              { type: 'div', props: { className: 'text-center mb-4' }, children: ['Content'] },
            ],
          },
        ],
      })

      // WHEN: className is 'text-center mb-4'
      await page.goto('/')

      // THEN: it should accept string property
      await expect(page.locator('div.text-center')).toBeVisible()
      await expect(page.locator('div.mb-4')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-PROPS-002: should accept numeric property',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props with number value
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ type: 'div', props: { size: 16 }, children: ['Content'] }],
          },
        ],
      })

      // WHEN: size is 16
      await page.goto('/')

      // THEN: it should accept numeric property
      await expect(page.locator('div[data-size="16"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-PROPS-003: should accept boolean property',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props with boolean value
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ type: 'button', props: { enabled: true }, children: ['Click'] }],
          },
        ],
      })

      // WHEN: enabled is true
      await page.goto('/')

      // THEN: it should accept boolean property
      await expect(page.locator('button[data-enabled="true"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-PROPS-004: should accept nested object property',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props with object value
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
                props: { style: { padding: '1rem', margin: '2rem' } },
                children: ['Content'],
              },
            ],
          },
        ],
      })

      // WHEN: style is { padding: '1rem', margin: '2rem' }
      await page.goto('/')

      // THEN: it should accept nested object property
      const div = page.locator('div').first()
      await expect(div).toHaveCSS('padding', '16px')
      await expect(div).toHaveCSS('margin', '32px')
    }
  )

  test(
    'APP-PAGES-PROPS-005: should accept array property',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props with array value
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              { type: 'div', props: { items: ['one', 'two', 'three'] }, children: ['List'] },
            ],
          },
        ],
      })

      // WHEN: items is ['one', 'two', 'three']
      await page.goto('/')

      // THEN: it should accept array property
      const dataItems = await page.locator('div').first().getAttribute('data-items')
      expect(JSON.parse(dataItems!)).toEqual(['one', 'two', 'three'])
    }
  )

  test(
    'APP-PAGES-PROPS-006: should accept string with $variable syntax',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props with variable reference
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          { name: 'welcome', type: 'div', props: { text: 'Welcome to $siteName' }, children: [] },
        ],
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ block: 'welcome', vars: { siteName: 'My Site' } }],
          },
        ],
      })

      // WHEN: text is 'Welcome to $siteName'
      await page.goto('/')

      // THEN: it should accept string with $variable syntax
      await expect(page.locator('div[data-text="Welcome to My Site"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-PROPS-007: should support mixed property types',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props with multiple properties of different types
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
                props: { className: 'container', size: 24, enabled: true },
                children: ['Mixed'],
              },
            ],
          },
        ],
      })

      // WHEN: object has className (string), size (number), enabled (boolean)
      await page.goto('/')

      // THEN: it should support mixed property types
      const div = page.locator('div.container')
      await expect(div).toHaveClass(/container/)
      await expect(div).toHaveAttribute('data-size', '24')
      await expect(div).toHaveAttribute('data-enabled', 'true')
    }
  )

  test(
    'APP-PAGES-PROPS-008: should validate camelCase naming convention',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props with camelCase property names
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
                props: { maxWidth: '1200px', minHeight: '400px', backgroundColor: '#f0f0f0' },
                children: ['Styled'],
              },
            ],
          },
        ],
      })

      // WHEN: properties are maxWidth, minHeight, backgroundColor
      await page.goto('/')

      // THEN: it should validate camelCase naming convention
      const div = page.locator('div').first()
      await expect(div).toHaveCSS('max-width', '1200px')
      await expect(div).toHaveCSS('min-height', '400px')
      await expect(div).toHaveCSS('background-color', 'rgb(240, 240, 240)')
    }
  )

  test(
    'APP-PAGES-PROPS-009: should support multiple variable references across properties',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: props object referencing theme tokens
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'greeting',
            type: 'div',
            props: { color: '$primaryColor', text: 'Hello $userName' },
            children: [],
          },
        ],
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ block: 'greeting', vars: { primaryColor: 'blue', userName: 'John' } }],
          },
        ],
      })

      // WHEN: color is '$primaryColor' and text is 'Hello $userName'
      await page.goto('/')

      // THEN: it should support multiple variable references across properties
      const div = page.locator('div[data-testid="block-greeting"]')
      await expect(div).toHaveAttribute('data-color', 'blue')
      await expect(div).toHaveAttribute('data-text', 'Hello John')
    }
  )

  test(
    'APP-PAGES-PROPS-010: should accept empty object for components without props',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: empty props object
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [{ type: 'div', props: {}, children: ['No Props'] }],
          },
        ],
      })

      // WHEN: no properties are provided
      await page.goto('/')

      // THEN: it should accept empty object for components without props
      await expect(page.locator('div')).toContainText('No Props')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test covering all 10 @spec scenarios via multi-server steps
  // ============================================================================

  test(
    'APP-PAGES-PROPS-REGRESSION: user can complete full props workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('APP-PAGES-PROPS-001: Accept string property', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [
                { type: 'div', props: { className: 'text-center mb-4' }, children: ['Content'] },
              ],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('div.text-center')).toBeVisible()
        await expect(page.locator('div.mb-4')).toBeVisible()
      })

      await test.step('APP-PAGES-PROPS-002: Accept numeric property', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [{ type: 'div', props: { size: 16 }, children: ['Content'] }],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('div[data-size="16"]')).toBeVisible()
      })

      await test.step('APP-PAGES-PROPS-003: Accept boolean property', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [{ type: 'button', props: { enabled: true }, children: ['Click'] }],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('button[data-enabled="true"]')).toBeVisible()
      })

      await test.step('APP-PAGES-PROPS-004: Accept nested object property', async () => {
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
                  props: { style: { padding: '1rem', margin: '2rem' } },
                  children: ['Content'],
                },
              ],
            },
          ],
        })
        await page.goto('/')
        const div = page.locator('div').first()
        await expect(div).toHaveCSS('padding', '16px')
        await expect(div).toHaveCSS('margin', '32px')
      })

      await test.step('APP-PAGES-PROPS-005: Accept array property', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [
                { type: 'div', props: { items: ['one', 'two', 'three'] }, children: ['List'] },
              ],
            },
          ],
        })
        await page.goto('/')
        const dataItems = await page.locator('div').first().getAttribute('data-items')
        expect(JSON.parse(dataItems!)).toEqual(['one', 'two', 'three'])
      })

      await test.step('APP-PAGES-PROPS-006: Accept string with $variable syntax', async () => {
        await startServerWithSchema({
          name: 'test-app',
          blocks: [
            { name: 'welcome', type: 'div', props: { text: 'Welcome to $siteName' }, children: [] },
          ],
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [{ block: 'welcome', vars: { siteName: 'My Site' } }],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('div[data-text="Welcome to My Site"]')).toBeVisible()
      })

      await test.step('APP-PAGES-PROPS-007: Support mixed property types', async () => {
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
                  props: { className: 'container', size: 24, enabled: true },
                  children: ['Mixed'],
                },
              ],
            },
          ],
        })
        await page.goto('/')
        const div = page.locator('div.container')
        await expect(div).toHaveClass(/container/)
        await expect(div).toHaveAttribute('data-size', '24')
        await expect(div).toHaveAttribute('data-enabled', 'true')
      })

      await test.step('APP-PAGES-PROPS-008: Validate camelCase naming convention', async () => {
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
                  props: { maxWidth: '1200px', minHeight: '400px', backgroundColor: '#f0f0f0' },
                  children: ['Styled'],
                },
              ],
            },
          ],
        })
        await page.goto('/')
        const div = page.locator('div').first()
        await expect(div).toHaveCSS('max-width', '1200px')
        await expect(div).toHaveCSS('min-height', '400px')
        await expect(div).toHaveCSS('background-color', 'rgb(240, 240, 240)')
      })

      await test.step('APP-PAGES-PROPS-009: Support multiple variable references', async () => {
        await startServerWithSchema({
          name: 'test-app',
          blocks: [
            {
              name: 'greeting',
              type: 'div',
              props: { color: '$primaryColor', text: 'Hello $userName' },
              children: [],
            },
          ],
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [{ block: 'greeting', vars: { primaryColor: 'blue', userName: 'John' } }],
            },
          ],
        })
        await page.goto('/')
        const div = page.locator('div[data-testid="block-greeting"]')
        await expect(div).toHaveAttribute('data-color', 'blue')
        await expect(div).toHaveAttribute('data-text', 'Hello John')
      })

      await test.step('APP-PAGES-PROPS-010: Accept empty object for no props', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [{ type: 'div', props: {}, children: ['No Props'] }],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('div')).toContainText('No Props')
      })
    }
  )
})
