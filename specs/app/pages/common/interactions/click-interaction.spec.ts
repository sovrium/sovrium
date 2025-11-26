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
 * Source: specs/app/pages/common/interactions/click-interaction.schema.json
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
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-PAGES-INTERACTION-CLICK-013: user can complete full click interaction workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with comprehensive click interactions
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
                interactions: { click: { animation: 'pulse', navigate: '/contact' } },
                children: ['Contact'],
              },
              {
                type: 'button',
                props: {},
                interactions: { click: { scrollTo: '#footer' } },
                children: ['Scroll Down'],
              },
              {
                type: 'section',
                props: { id: 'footer', style: 'margin-top: 2000px' },
                children: ['Footer Content'],
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

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // Verify scroll interaction
      const scrollButton = page.locator('button').filter({ hasText: 'Scroll Down' })
      await scrollButton.click()
      // THEN: assertion
      await expect(page.locator('#footer')).toBeInViewport()

      // Verify animation + navigation
      const navButton = page.locator('button').filter({ hasText: 'Contact' })
      await navButton.click()
      // THEN: assertion
      await expect(navButton).toHaveClass(/animate-pulse/)
      await expect(page).toHaveURL('/contact')

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
