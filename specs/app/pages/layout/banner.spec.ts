/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Banner Configuration
 *
 * Source: src/domain/models/app/page/layout.ts
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Banner Configuration', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-BANNER-001: should display banner at top of page',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a banner with enabled set to true
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            layout: { banner: { enabled: true, text: 'Announcement' } },
            sections: [],
          },
        ],
      })

      // WHEN: banner should be visible
      await page.goto('/')

      // THEN: it should display banner at top of page
      const banner = page.locator('[data-testid="banner"]')
      await expect(banner).toBeVisible()
      await expect(banner).toContainText('Announcement')
    }
  )

  test(
    'APP-PAGES-BANNER-002: should render announcement text',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a banner with text content
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            layout: { banner: { enabled: true, text: '🎉 New feature available!' } },
            sections: [],
          },
        ],
      })

      // WHEN: text is '🎉 New feature available!'
      await page.goto('/')

      // THEN: it should render announcement text
      const banner = page.locator('[data-testid="banner"]')
      await expect(banner).toContainText('🎉 New feature available!')
    }
  )

  test(
    'APP-PAGES-BANNER-003: should add clickable link to banner',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a banner with link
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
            layout: {
              banner: {
                enabled: true,
                text: 'Check out our new features',
                link: { href: '/features', label: 'Learn more' },
              },
            },
            sections: [],
          },
          {
            name: 'features',
            path: '/features',
            meta: { lang: 'en-US', title: 'Features', description: 'Features page' },
            sections: [],
          },
        ],
      })

      // WHEN: link has href '/features' and label 'Learn more'
      await page.goto('/')
      const link = page.locator('[data-testid="banner-link"]')

      // THEN: it should add clickable link to banner
      await expect(link).toBeVisible()
      await expect(link).toHaveText('Learn more')
      await link.click()
      // THEN: assertion
      await expect(page).toHaveURL('/features')
    }
  )

  test(
    'APP-PAGES-BANNER-004: should apply CSS gradient as background',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a banner with gradient background
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            layout: {
              banner: {
                enabled: true,
                text: 'Announcement',
                gradient: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: gradient is 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
      await page.goto('/')

      // THEN: it should apply CSS gradient as background
      const banner = page.locator('[data-testid="banner"]')
      await expect(banner).toHaveCSS('background', /linear-gradient/)
    }
  )

  test(
    'APP-PAGES-BANNER-005: should apply solid background color',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a banner with solid backgroundColor
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            layout: { banner: { enabled: true, text: 'Announcement', backgroundColor: '#FF5733' } },
            sections: [],
          },
        ],
      })

      // WHEN: backgroundColor is '#FF5733' (hex color)
      await page.goto('/')

      // THEN: it should apply solid background color
      const banner = page.locator('[data-testid="banner"]')
      await expect(banner).toHaveCSS('background-color', 'rgb(255, 87, 51)')
    }
  )

  test(
    'APP-PAGES-BANNER-006: should apply text color for contrast',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a banner with textColor
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            layout: {
              banner: {
                enabled: true,
                text: 'Announcement',
                backgroundColor: '#1E40AF',
                textColor: '#FFFFFF',
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: textColor is '#FFFFFF' for readability
      await page.goto('/')

      // THEN: it should apply text color for contrast
      const banner = page.locator('[data-testid="banner"]')
      await expect(banner).toHaveCSS('color', 'rgb(255, 255, 255)')
    }
  )

  test(
    'APP-PAGES-BANNER-007: should allow users to close banner permanently',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a dismissible banner
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            layout: { banner: { enabled: true, text: 'Announcement', dismissible: true } },
            sections: [],
          },
        ],
      })

      // WHEN: dismissible is true
      await page.goto('/')
      const banner = page.locator('[data-testid="banner"]')
      // THEN: assertion
      await expect(banner).toBeVisible()

      const dismissButton = page.locator('[data-testid="banner-dismiss"]')
      await dismissButton.click()

      // THEN: it should allow users to close banner permanently
      await expect(banner).toBeHidden()

      // Verify persistence
      await page.reload()
      // THEN: assertion
      await expect(banner).toBeHidden()
    }
  )

  test(
    'APP-PAGES-BANNER-008: should remain at top during page scroll',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sticky banner
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            layout: { banner: { enabled: true, text: 'Announcement', sticky: true } },
            sections: [
              { type: 'div', props: { style: 'height: 3000px' }, children: ['Long content'] },
            ],
          },
        ],
      })

      // WHEN: sticky is true
      await page.goto('/')
      const banner = page.locator('[data-testid="banner"]')
      // THEN: assertion
      await expect(banner).toHaveCSS('position', 'sticky')
      await expect(banner).toHaveCSS('top', '0px')

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 1000))

      // THEN: it should remain at top during page scroll
      await expect(banner).toBeInViewport()
    }
  )

  test(
    'APP-PAGES-BANNER-009: should not render banner',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a disabled banner
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            layout: { banner: { enabled: false, text: 'This banner is disabled' } },
            sections: [],
          },
        ],
      })

      // WHEN: enabled is false
      await page.goto('/')

      // THEN: it should not render banner
      await expect(page.locator('[data-testid="banner"]')).toBeHidden()
    }
  )

  test(
    'APP-PAGES-BANNER-010: should render emojis correctly',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a banner with emoji in text
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            layout: { banner: { enabled: true, text: '🎉🎊🥳 Triple celebration emojis!' } },
            sections: [],
          },
        ],
      })

      // WHEN: text includes '🎉' or other emojis
      await page.goto('/')

      // THEN: it should render emojis correctly
      const banner = page.locator('[data-testid="banner"]')
      await expect(banner).toContainText('🎉🎊🥳 Triple celebration emojis!')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-BANNER-REGRESSION: user can complete full banner workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('APP-PAGES-BANNER-001: Display banner at top of page', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              layout: { banner: { enabled: true, text: 'Announcement' } },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const banner = page.locator('[data-testid="banner"]')
        await expect(banner).toBeVisible()
        await expect(banner).toContainText('Announcement')
      })

      await test.step('APP-PAGES-BANNER-002: Render announcement text', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              layout: { banner: { enabled: true, text: '🎉 New feature available!' } },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const banner = page.locator('[data-testid="banner"]')
        await expect(banner).toContainText('🎉 New feature available!')
      })

      await test.step('APP-PAGES-BANNER-003: Add clickable link to banner', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: { lang: 'en-US', title: 'Home', description: 'Home page' },
              layout: {
                banner: {
                  enabled: true,
                  text: 'Check out our new features',
                  link: { href: '/features', label: 'Learn more' },
                },
              },
              sections: [],
            },
            {
              name: 'features',
              path: '/features',
              meta: { lang: 'en-US', title: 'Features', description: 'Features page' },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const link = page.locator('[data-testid="banner-link"]')
        await expect(link).toBeVisible()
        await expect(link).toHaveText('Learn more')
        await link.click()
        await expect(page).toHaveURL('/features')
      })

      await test.step('APP-PAGES-BANNER-004: Apply CSS gradient as background', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              layout: {
                banner: {
                  enabled: true,
                  text: 'Announcement',
                  gradient: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const banner = page.locator('[data-testid="banner"]')
        await expect(banner).toHaveCSS('background', /linear-gradient/)
      })

      await test.step('APP-PAGES-BANNER-005: Apply solid background color', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              layout: { banner: { enabled: true, text: 'Announcement', backgroundColor: '#FF5733' } },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const banner = page.locator('[data-testid="banner"]')
        await expect(banner).toHaveCSS('background-color', 'rgb(255, 87, 51)')
      })

      await test.step('APP-PAGES-BANNER-006: Apply text color for contrast', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              layout: {
                banner: {
                  enabled: true,
                  text: 'Announcement',
                  backgroundColor: '#1E40AF',
                  textColor: '#FFFFFF',
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const banner = page.locator('[data-testid="banner"]')
        await expect(banner).toHaveCSS('color', 'rgb(255, 255, 255)')
      })

      await test.step('APP-PAGES-BANNER-007: Allow users to close banner permanently', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              layout: { banner: { enabled: true, text: 'Announcement', dismissible: true } },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const banner = page.locator('[data-testid="banner"]')
        await expect(banner).toBeVisible()
        const dismissButton = page.locator('[data-testid="banner-dismiss"]')
        await dismissButton.click()
        await expect(banner).toBeHidden()
        await page.reload()
        await expect(banner).toBeHidden()
      })

      await test.step('APP-PAGES-BANNER-008: Remain at top during page scroll', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              layout: { banner: { enabled: true, text: 'Announcement', sticky: true } },
              sections: [
                { type: 'div', props: { style: 'height: 3000px' }, children: ['Long content'] },
              ],
            },
          ],
        })
        await page.goto('/')
        const banner = page.locator('[data-testid="banner"]')
        await expect(banner).toHaveCSS('position', 'sticky')
        await expect(banner).toHaveCSS('top', '0px')
        await page.evaluate(() => window.scrollTo(0, 1000))
        await expect(banner).toBeInViewport()
      })

      await test.step('APP-PAGES-BANNER-009: Not render banner when disabled', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              layout: { banner: { enabled: false, text: 'This banner is disabled' } },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        await expect(page.locator('[data-testid="banner"]')).toBeHidden()
      })

      await test.step('APP-PAGES-BANNER-010: Render emojis correctly', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
              layout: { banner: { enabled: true, text: '🎉🎊🥳 Triple celebration emojis!' } },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const banner = page.locator('[data-testid="banner"]')
        await expect(banner).toContainText('🎉🎊🥳 Triple celebration emojis!')
      })
    }
  )
})
