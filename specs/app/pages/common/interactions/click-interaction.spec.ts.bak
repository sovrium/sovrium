/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Click Interaction
 *
 * Source: src/domain/models/app/page/common.ts
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Click Interaction', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-PAGES-INTERACTION-CLICK-001: should play a pulse animation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with click animation 'pulse'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { animation: 'pulse' } },
                children: ['Click Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')
      await button.click()

      // THEN: it should play a pulse animation
      await expect(button).toHaveClass(/animate-pulse/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-CLICK-002: should play a ripple animation from the click point',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with click animation 'ripple'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { animation: 'ripple' } },
                children: ['Click Me'],
              },
            ],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')
      await button.click()

      // THEN: it should play a ripple animation from the click point
      await expect(button).toHaveClass(/animate-ripple/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-CLICK-003: should navigate to the contact page',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with navigate to '/contact'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { navigate: '/contact' } },
                children: ['Contact Us'],
              },
            ],
          },
          {
            name: 'Contact',
            path: '/contact',
            meta: { lang: 'en-US', title: 'Contact' },
            sections: [],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')
      await button.click()

      // THEN: it should navigate to the contact page
      await expect(page).toHaveURL('/contact')
    }
  )

  test(
    'APP-PAGES-INTERACTION-CLICK-004: should navigate to the pricing section on the same page',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with navigate to anchor '#pricing-section'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { navigate: '#pricing-section' } },
                children: ['See Pricing'],
              },
              { type: 'section', props: { id: 'pricing-section' }, children: ['Pricing Content'] },
            ],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')
      await button.click()

      // THEN: it should navigate to the pricing section on the same page
      await expect(page).toHaveURL('/#pricing-section')
      const section = page.locator('#pricing-section')
      await expect(section).toBeInViewport()
    }
  )

  test(
    'APP-PAGES-INTERACTION-CLICK-005: should open the URL in the same tab',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with openUrl to external site
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { openUrl: 'https://example.com' } },
                children: ['Visit Example'],
              },
            ],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')

      // THEN: it should open the URL in the same tab
      const navigationPromise = page.waitForURL('https://example.com')
      await button.click()
      await navigationPromise
      // THEN: assertion
      await expect(page).toHaveURL('https://example.com')
    }
  )

  test(
    'APP-PAGES-INTERACTION-CLICK-006: should open the URL in a new tab',
    { tag: '@spec' },
    async ({ page, startServerWithSchema, context }) => {
      // GIVEN: a button with openUrl and openInNewTab true
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { openUrl: 'https://example.com', openInNewTab: true } },
                children: ['Visit Example'],
              },
            ],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')

      // THEN: it should open the URL in a new tab
      const newPagePromise = context.waitForEvent('page')
      await button.click()
      const newPage = await newPagePromise
      // THEN: assertion
      await expect(newPage).toHaveURL('https://example.com')
    }
  )

  test(
    'APP-PAGES-INTERACTION-CLICK-007: should smoothly scroll to the hero section',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with scrollTo '#hero-section'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { scrollTo: '#hero-section' } },
                children: ['Scroll to Hero'],
              },
              {
                type: 'section',
                props: { id: 'hero-section', style: 'margin-top: 2000px' },
                children: ['Hero Content'],
              },
            ],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')
      await button.click()

      // THEN: it should smoothly scroll to the hero section
      const section = page.locator('#hero-section')
      await expect(section).toBeInViewport()
    }
  )

  test(
    'APP-PAGES-INTERACTION-CLICK-008: should show the mobile menu if hidden, or hide it if shown',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with toggleElement '#mobile-menu'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { toggleElement: '#mobile-menu' } },
                children: ['Toggle Menu'],
              },
              {
                type: 'nav',
                props: { id: 'mobile-menu', style: 'display: none' },
                children: ['Menu Items'],
              },
            ],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')
      const menu = page.locator('#mobile-menu')

      // THEN: it should show the mobile menu if hidden, or hide it if shown
      await expect(menu).toBeHidden()
      await button.click()
      await expect(menu).toBeVisible()
      await button.click()
      // THEN: assertion
      await expect(menu).toBeHidden()
    }
  )

  test(
    'APP-PAGES-INTERACTION-CLICK-009: should submit the contact form',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with submitForm '#contact-form'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'form',
                props: { id: 'contact-form', action: '/submit' },
                children: [
                  { type: 'input', props: { name: 'email' } },
                  {
                    type: 'button',
                    props: {},
                    interactions: { click: { submitForm: '#contact-form' } },
                    children: ['Submit'],
                  },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')

      // THEN: it should submit the contact form
      const submitPromise = page.waitForRequest((request) => request.url().includes('/submit'))
      await button.click()
      await submitPromise
    }
  )

  test(
    'APP-PAGES-INTERACTION-CLICK-010: should play pulse animation then navigate to signup page',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with animation 'pulse' and navigate '/signup'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Home',
            path: '/',
            meta: { lang: 'en-US', title: 'Home' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { animation: 'pulse', navigate: '/signup' } },
                children: ['Sign Up'],
              },
            ],
          },
          {
            name: 'Signup',
            path: '/signup',
            meta: { lang: 'en-US', title: 'Signup' },
            sections: [],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')
      await button.click()

      // THEN: it should play pulse animation then navigate to signup page
      await expect(button).toHaveClass(/animate-pulse/)
      await expect(page).toHaveURL('/signup')
    }
  )

  test(
    'APP-PAGES-INTERACTION-CLICK-011: should play a bounce animation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with animation 'bounce'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { animation: 'bounce' } },
                children: ['Bounce'],
              },
            ],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')
      await button.click()

      // THEN: it should play a bounce animation
      await expect(button).toHaveClass(/animate-bounce/)
    }
  )

  test(
    'APP-PAGES-INTERACTION-CLICK-012: should not play any animation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a button with animation 'none'
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test' },
            sections: [
              {
                type: 'button',
                props: {},
                interactions: { click: { animation: 'none' } },
                children: ['No Animation'],
              },
            ],
          },
        ],
      })

      // WHEN: user clicks the button
      await page.goto('/')
      const button = page.locator('button')
      await button.click()

      // THEN: it should not play any animation
      await expect(button).not.toHaveClass(/animate-/)
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test covering all 12 @spec scenarios
  // OPTIMIZATION: Reduced from 12 to 5 startServerWithSchema calls
  // - Group 1 (001, 002, 011, 012): Animation tests - 4 buttons on same page
  // - Group 2 (003, 004, 010): Navigation tests - multiple buttons and pages
  // - Group 3 (005): Open URL in same tab - navigates away, needs own setup
  // - Group 4 (006): Open URL in new tab - needs own setup for context.waitForEvent
  // - Group 5 (007, 008, 009): Page-local interactions - scrollTo, toggle, form
  // ============================================================================

  test(
    'APP-PAGES-INTERACTION-CLICK-REGRESSION: user can complete full click interaction workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema, context }) => {
      // Group 1: Animation tests (001, 002, 011, 012)
      // All 4 animation types as separate buttons on the same page
      await test.step('Setup: Start server with animation buttons configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [
                {
                  type: 'button',
                  props: { 'data-testid': 'btn-pulse' },
                  interactions: { click: { animation: 'pulse' } },
                  children: ['Pulse'],
                },
                {
                  type: 'button',
                  props: { 'data-testid': 'btn-ripple' },
                  interactions: { click: { animation: 'ripple' } },
                  children: ['Ripple'],
                },
                {
                  type: 'button',
                  props: { 'data-testid': 'btn-bounce' },
                  interactions: { click: { animation: 'bounce' } },
                  children: ['Bounce'],
                },
                {
                  type: 'button',
                  props: { 'data-testid': 'btn-none' },
                  interactions: { click: { animation: 'none' } },
                  children: ['No Animation'],
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-001: Play pulse animation', async () => {
        const button = page.locator('[data-testid="btn-pulse"]')
        await button.click()
        await expect(button).toHaveClass(/animate-pulse/)
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-002: Play ripple animation', async () => {
        const button = page.locator('[data-testid="btn-ripple"]')
        await button.click()
        await expect(button).toHaveClass(/animate-ripple/)
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-011: Play bounce animation', async () => {
        const button = page.locator('[data-testid="btn-bounce"]')
        await button.click()
        await expect(button).toHaveClass(/animate-bounce/)
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-012: No animation with none', async () => {
        const button = page.locator('[data-testid="btn-none"]')
        await button.click()
        await expect(button).not.toHaveClass(/animate-/)
      })

      // Group 2: Navigation tests (003, 004, 010)
      // Multiple navigation buttons with target pages
      await test.step('Setup: Start server with navigation configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Home',
              path: '/',
              meta: { lang: 'en-US', title: 'Home' },
              sections: [
                {
                  type: 'button',
                  props: { 'data-testid': 'btn-contact' },
                  interactions: { click: { navigate: '/contact' } },
                  children: ['Contact Us'],
                },
                {
                  type: 'button',
                  props: { 'data-testid': 'btn-anchor' },
                  interactions: { click: { navigate: '#pricing-section' } },
                  children: ['See Pricing'],
                },
                {
                  type: 'button',
                  props: { 'data-testid': 'btn-signup' },
                  interactions: { click: { animation: 'pulse', navigate: '/signup' } },
                  children: ['Sign Up'],
                },
                {
                  type: 'section',
                  props: { id: 'pricing-section' },
                  children: ['Pricing Content'],
                },
              ],
            },
            {
              name: 'Contact',
              path: '/contact',
              meta: { lang: 'en-US', title: 'Contact' },
              sections: [],
            },
            {
              name: 'Signup',
              path: '/signup',
              meta: { lang: 'en-US', title: 'Signup' },
              sections: [],
            },
          ],
        })
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-003: Navigate to contact page', async () => {
        await page.goto('/')
        const button = page.locator('[data-testid="btn-contact"]')
        await button.click()
        await expect(page).toHaveURL('/contact')
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-004: Navigate to anchor', async () => {
        await page.goto('/')
        const button = page.locator('[data-testid="btn-anchor"]')
        await button.click()
        await expect(page).toHaveURL('/#pricing-section')
        await expect(page.locator('#pricing-section')).toBeInViewport()
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-010: Play pulse then navigate', async () => {
        await page.goto('/')
        const button = page.locator('[data-testid="btn-signup"]')
        await button.click()
        await expect(button).toHaveClass(/animate-pulse/)
        await expect(page).toHaveURL('/signup')
      })

      // Group 3: Open URL in same tab (005)
      // This test navigates away from the test app, needs separate setup
      await test.step('Setup: Start server with openUrl same tab configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [
                {
                  type: 'button',
                  props: {},
                  interactions: { click: { openUrl: 'https://example.com' } },
                  children: ['Visit Example'],
                },
              ],
            },
          ],
        })
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-005: Open URL in same tab', async () => {
        await page.goto('/')
        const button = page.locator('button')
        const navigationPromise = page.waitForURL('https://example.com')
        await button.click()
        await navigationPromise
        await expect(page).toHaveURL('https://example.com')
      })

      // Group 4: Open URL in new tab (006)
      // Needs its own setup for context.waitForEvent('page')
      await test.step('Setup: Start server with openUrl new tab configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [
                {
                  type: 'button',
                  props: {},
                  interactions: { click: { openUrl: 'https://example.com', openInNewTab: true } },
                  children: ['Visit Example'],
                },
              ],
            },
          ],
        })
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-006: Open URL in new tab', async () => {
        await page.goto('/')
        const button = page.locator('button')
        const newPagePromise = context.waitForEvent('page')
        await button.click()
        const newPage = await newPagePromise
        await expect(newPage).toHaveURL('https://example.com')
      })

      // Group 5: Page-local interactions (007, 008, 009)
      // scrollTo, toggleElement, submitForm - all on same page with different sections
      await test.step('Setup: Start server with page-local interactions configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test' },
              sections: [
                // Button for scrollTo
                {
                  type: 'button',
                  props: { 'data-testid': 'btn-scroll' },
                  interactions: { click: { scrollTo: '#hero-section' } },
                  children: ['Scroll to Hero'],
                },
                // Button for toggleElement
                {
                  type: 'button',
                  props: { 'data-testid': 'btn-toggle' },
                  interactions: { click: { toggleElement: '#mobile-menu' } },
                  children: ['Toggle Menu'],
                },
                // Nav element for toggle
                {
                  type: 'nav',
                  props: { id: 'mobile-menu', style: 'display: none' },
                  children: ['Menu Items'],
                },
                // Form with submitForm button
                {
                  type: 'form',
                  props: { id: 'contact-form', action: '/submit' },
                  children: [
                    { type: 'input', props: { name: 'email' } },
                    {
                      type: 'button',
                      props: { 'data-testid': 'btn-submit' },
                      interactions: { click: { submitForm: '#contact-form' } },
                      children: ['Submit'],
                    },
                  ],
                },
                // Section to scroll to (at bottom with margin)
                {
                  type: 'section',
                  props: { id: 'hero-section', style: 'margin-top: 2000px' },
                  children: ['Hero Content'],
                },
              ],
            },
          ],
        })
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-007: Scroll to hero section', async () => {
        await page.goto('/')
        const button = page.locator('[data-testid="btn-scroll"]')
        await button.click()
        await expect(page.locator('#hero-section')).toBeInViewport()
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-008: Toggle mobile menu', async () => {
        await page.goto('/')
        const button = page.locator('[data-testid="btn-toggle"]')
        const menu = page.locator('#mobile-menu')
        await expect(menu).toBeHidden()
        await button.click()
        await expect(menu).toBeVisible()
        await button.click()
        await expect(menu).toBeHidden()
      })

      await test.step('APP-PAGES-INTERACTION-CLICK-009: Submit contact form', async () => {
        await page.goto('/')
        const button = page.locator('[data-testid="btn-submit"]')
        const submitPromise = page.waitForRequest((request) => request.url().includes('/submit'))
        await button.click()
        await submitPromise
      })
    }
  )
})
