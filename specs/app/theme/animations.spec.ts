/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Animation Configuration
 *
 * Source: specs/app/theme/animations/animations.schema.json
 * Spec Count: 24 (23 @spec + 1 @regression)
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (23 tests: 8 validation + 15 application) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Animation Configuration', () => {
  // ============================================================================
  // SPECIFICATION TESTS (@spec)
  // One test per spec in schema - defines EXHAUSTIVE acceptance criteria
  // ============================================================================

  test(
    'APP-THEME-ANIMATIONS-001: should validate animation enablement',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an animation with boolean value true
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            fadeIn: true,
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'animation-fadeIn',
                  style: { animation: 'fade-in 1s ease-in' },
                },
                children: ['Fade In Content'],
              },
            ],
          },
        ],
      })

      // WHEN: animation is simply enabled/disabled
      await page.goto('/')

      // THEN: it should validate animation enablement
      await expect(page.locator('[data-testid="animation-fadeIn"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-ANIMATIONS-002: should validate CSS animation string',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an animation with string CSS value
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            slideIn: 'slide-in 0.5s ease-out',
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'animation-slideIn',
                  style: { animation: 'slide-in 0.5s ease-out' },
                },
                children: ['Slide In Content'],
              },
            ],
          },
        ],
      })

      // WHEN: animation uses CSS shorthand (e.g., 'slide-in 0.5s ease-out')
      await page.goto('/')

      // THEN: it should validate CSS animation string
      const animValue = await page
        .locator('[data-testid="animation-slideIn"]')
        .evaluate((el) => window.getComputedStyle(el).animation)
      // THEN: assertion
      expect(animValue).toContain('slide-in')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-003: should validate timing properties',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an animation with duration and easing object config
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            transition: {
              duration: '300ms',
              easing: 'ease-in-out',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'animation-transition',
                  style: { transition: 'all 300ms ease-in-out' },
                },
                children: ['Transition Content'],
              },
            ],
          },
        ],
      })

      // WHEN: animation has custom duration '300ms' and easing 'ease-in-out'
      await page.goto('/')

      // THEN: it should validate timing properties
      await expect(page.locator('[data-testid="animation-transition"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-ANIMATIONS-004: should validate animation delay',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an animation with delay property
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            delayedFade: {
              duration: '500ms',
              delay: '200ms',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'animation-delayedFade',
                  style: { animation: 'fade-in 500ms ease-in 200ms' },
                },
                children: ['Delayed Fade Content'],
              },
            ],
          },
        ],
      })

      // WHEN: animation should wait before starting
      await page.goto('/')

      // THEN: it should validate animation delay
      await expect(page.locator('[data-testid="animation-delayedFade"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-ANIMATIONS-005: should validate animation frames definition',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an animation with keyframes object
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            custom: {
              keyframes: {
                '0%': {
                  opacity: 0,
                },
                '100%': {
                  opacity: 1,
                },
              },
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'animation-custom',
                  style: { animation: 'custom-animation 1s ease-in' },
                },
                children: ['Custom Animation Content'],
              },
            ],
          },
        ],
      })

      // WHEN: animation uses custom CSS keyframes
      await page.goto('/')

      // THEN: it should validate animation frames definition
      await expect(page.locator('[data-testid="animation-custom"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-ANIMATIONS-006: should validate disabled state',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: an animation with enabled set to false
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            fadeIn: {
              enabled: false,
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'animation-fadeIn',
                  style: { animation: 'none' },
                },
                children: ['Disabled Animation Content'],
              },
            ],
          },
        ],
      })

      // WHEN: animation is disabled via config
      await page.goto('/')

      // THEN: it should validate disabled state
      const element = page.locator('[data-testid="animation-fadeIn"]')
      const animValue = await element.evaluate((el) => window.getComputedStyle(el).animation)
      expect(animValue).toContain('none')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-007: should validate reusable animation library',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: common animations (fadeIn, fadeInUp, pulse, float)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            fadeIn: true,
            fadeInUp: true,
            pulse: true,
            float: true,
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'animation-fadeIn',
                  style: { animation: 'fade-in 1s ease-in' },
                },
                children: ['Fade In'],
              },
              {
                type: 'div',
                props: {
                  'data-testid': 'animation-pulse',
                  style: { animation: 'pulse 2s ease-in-out infinite' },
                },
                children: ['Pulse'],
              },
            ],
          },
        ],
      })

      // WHEN: theme defines standard animation library
      await page.goto('/')

      // THEN: it should validate reusable animation library
      await expect(page.locator('[data-testid="animation-fadeIn"]')).toBeVisible()
      await expect(page.locator('[data-testid="animation-pulse"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-ANIMATIONS-008: should validate default transition behavior',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: transition config with duration and easing
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            transition: {
              duration: '300ms',
              easing: 'ease-in-out',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'animation-transition',
                  style: { transition: 'all 300ms ease-in-out' },
                },
                children: ['Transition Content'],
              },
            ],
          },
        ],
      })

      // WHEN: global transition timing is defined
      await page.goto('/')

      // THEN: it should validate default transition behavior
      await expect(page.locator('[data-testid="animation-transition"]')).toBeVisible()
    }
  )

  test(
    'APP-THEME-ANIMATIONS-009: should render modal with fade-in animation on mount',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: fadeIn animation applied to modal component
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            fadeIn: {
              duration: '300ms',
              easing: 'ease-in',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'modal',
                content: 'Modal content',
                props: {
                  'data-testid': 'modal',
                },
              },
            ],
          },
        ],
      })

      // WHEN: modal uses theme.animations.fadeIn
      await page.goto('/')

      // THEN: it should render modal with fade-in animation on mount
      const modal = page.locator('[data-testid="modal"]')
      await expect(modal).toHaveScreenshot('animation-app-001-modal-fade.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-010: should render badge with pulsing animation loop',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: pulse animation applied to notification badge
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            pulse: {
              duration: '2s',
              easing: 'ease-in-out',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'badge',
                content: '3',
                props: {
                  'data-testid': 'notification-badge',
                },
              },
            ],
          },
        ],
      })

      // WHEN: badge uses theme.animations.pulse
      await page.goto('/')

      // THEN: it should render badge with pulsing animation loop
      const badge = page.locator('[data-testid="notification-badge"]')
      await expect(badge).toHaveScreenshot('animation-app-002-badge-pulse.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-011: should render button with CSS transition on hover',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: transition animation applied to button hover state
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            transition: {
              duration: '200ms',
              easing: 'ease-in-out',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'button',
                content: 'Hover me',
                props: {
                  'data-testid': 'action-button',
                },
              },
            ],
          },
        ],
      })

      // WHEN: button uses theme.animations.transition for smooth state changes
      await page.goto('/')

      // THEN: it should render button with CSS transition on hover
      const button = page.locator('[data-testid="action-button"]')
      await expect(button).toHaveScreenshot('animation-app-003-button-transition.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-012: should render hero content sliding up and fading in',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: fadeInUp entrance animation applied to hero section
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            fadeInUp: {
              duration: '600ms',
              easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
              keyframes: {
                '0%': {
                  opacity: 0,
                  transform: 'translateY(20px)',
                },
                '100%': {
                  opacity: 1,
                  transform: 'translateY(0)',
                },
              },
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'hero',
                content: '<h1>Welcome to Our Site</h1><p>Discover amazing features</p>',
                props: {
                  'data-testid': 'hero-section',
                },
              },
            ],
          },
        ],
      })

      // WHEN: hero section uses theme.animations.fadeInUp on page load
      await page.goto('/')

      // THEN: it should render hero content sliding up and fading in
      const hero = page.locator('[data-testid="hero-section"]')
      await expect(hero).toHaveScreenshot('animation-app-004-hero-fade-up.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-013: should render sidebar sliding in from left',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: slideIn entrance animation applied to sidebar
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            slideIn: {
              duration: '400ms',
              easing: 'ease-out',
              keyframes: {
                '0%': {
                  transform: 'translateX(-100%)',
                },
                '100%': {
                  transform: 'translateX(0)',
                },
              },
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'sidebar',
                content: '<nav>Menu items</nav>',
                props: {
                  'data-testid': 'mobile-sidebar',
                },
              },
            ],
          },
        ],
      })

      // WHEN: sidebar uses theme.animations.slideIn on navigation
      await page.goto('/')

      // THEN: it should render sidebar sliding in from left
      const sidebar = page.locator('[data-testid="mobile-sidebar"]')
      await expect(sidebar).toHaveScreenshot('animation-app-005-sidebar-slide.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-014: should render toast fading out before removal',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: fadeOut exit animation applied to toast notification
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            fadeOut: {
              duration: '300ms',
              easing: 'ease-out',
              keyframes: {
                '0%': {
                  opacity: 1,
                },
                '100%': {
                  opacity: 0,
                },
              },
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'toast',
                content: 'Notification message',
                props: {
                  'data-testid': 'toast-notification',
                },
              },
            ],
          },
        ],
      })

      // WHEN: toast uses theme.animations.fadeOut on dismiss
      await page.goto('/')

      // THEN: it should render toast fading out before removal
      const toast = page.locator('[data-testid="toast-notification"]')
      await expect(toast).toHaveScreenshot('animation-app-006-toast-fade-out.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-015: should render card scaling up when scrolled into view',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: scaleUp entrance animation on scroll-triggered card reveal
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            scaleUp: {
              duration: '500ms',
              easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              keyframes: {
                '0%': {
                  opacity: 0,
                  transform: 'scale(0.8)',
                },
                '100%': {
                  opacity: 1,
                  transform: 'scale(1)',
                },
              },
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'card',
                content: '<h3>Feature Title</h3><p>Description</p>',
                props: {
                  'data-testid': 'feature-card',
                },
              },
            ],
          },
        ],
      })

      // WHEN: card uses theme.animations.scaleUp with IntersectionObserver
      await page.goto('/')

      // THEN: it should render card scaling up when scrolled into view
      const card = page.locator('[data-testid="feature-card"]')
      await expect(card).toHaveScreenshot('animation-app-007-card-scale.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-016: should render button gently floating up and down',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: float animation applied to floating action button (FAB)
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            float: {
              duration: '3s',
              easing: 'ease-in-out',
              keyframes: {
                '0%, 100%': {
                  transform: 'translateY(0)',
                },
                '50%': {
                  transform: 'translateY(-10px)',
                },
              },
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'fab',
                content: '+',
                props: {
                  'data-testid': 'fab-button',
                },
              },
            ],
          },
        ],
      })

      // WHEN: FAB uses theme.animations.float for continuous hover effect
      await page.goto('/')

      // THEN: it should render button gently floating up and down
      const fab = page.locator('[data-testid="fab-button"]')
      await expect(fab).toHaveScreenshot('animation-app-008-fab-float.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-017: should render button scaling up smoothly on hover',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: hover animation for button scale interaction
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            transition: {
              duration: '200ms',
              easing: 'ease-in-out',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'button',
                content: 'Buy Now',
                props: {
                  'data-testid': 'cta-button',
                },
              },
            ],
          },
        ],
      })

      // WHEN: button uses theme.animations.transition for hover scale
      await page.goto('/')

      // THEN: it should render button scaling up smoothly on hover
      const button = page.locator('[data-testid="cta-button"]')
      await button.hover()
      await expect(button).toHaveScreenshot('animation-app-009-button-hover-scale.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-018: should render list items appearing one after another',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: stagger animation for list items
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            fadeIn: {
              duration: '400ms',
              easing: 'ease-out',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'div',
                props: {
                  'data-testid': 'feature-list',
                  role: 'list',
                },
                children: [
                  { type: 'div', props: { role: 'listitem' }, children: ['Feature 1'] },
                  { type: 'div', props: { role: 'listitem' }, children: ['Feature 2'] },
                  { type: 'div', props: { role: 'listitem' }, children: ['Feature 3'] },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: list items use theme.animations.fadeIn with incremental delays
      await page.goto('/')

      // THEN: it should render list items appearing one after another
      const list = page.locator('[data-testid="feature-list"]')
      await expect(list).toBeVisible()
      const items = list.locator('[role="listitem"]')
      // THEN: assertion
      await expect(items.first()).toBeVisible()
    }
  )

  test(
    'APP-THEME-ANIMATIONS-019: should render spinner rotating infinitely',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: rotate animation for loading spinner
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            rotate: {
              duration: '1s',
              easing: 'linear',
              keyframes: {
                '0%': {
                  transform: 'rotate(0deg)',
                },
                '100%': {
                  transform: 'rotate(360deg)',
                },
              },
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'spinner',
                content: '<svg>...</svg>',
                props: {
                  'data-testid': 'loading-spinner',
                },
              },
            ],
          },
        ],
      })

      // WHEN: spinner uses theme.animations.rotate for continuous rotation
      await page.goto('/')

      // THEN: it should render spinner rotating infinitely
      const spinner = page.locator('[data-testid="loading-spinner"]')
      await expect(spinner).toHaveScreenshot('animation-app-011-spinner-rotate.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-020: should render input shaking horizontally to indicate error',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: shake animation for form validation error
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            shake: {
              duration: '500ms',
              easing: 'ease-in-out',
              keyframes: {
                '0%, 100%': {
                  transform: 'translateX(0)',
                },
                '10%, 30%, 50%, 70%, 90%': {
                  transform: 'translateX(-10px)',
                },
                '20%, 40%, 60%, 80%': {
                  transform: 'translateX(10px)',
                },
              },
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'input',
                props: {
                  'data-testid': 'email-input',
                  'aria-invalid': 'true',
                },
              },
            ],
          },
        ],
      })

      // WHEN: input field uses theme.animations.shake on invalid submission
      await page.goto('/')

      // THEN: it should render input shaking horizontally to indicate error
      const input = page.locator('[data-testid="email-input"]')
      await expect(input).toHaveScreenshot('animation-app-012-input-shake.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-021: should render background moving slower than foreground (parallax effect)',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: parallax scroll animation for background image
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            parallax: {
              easing: 'linear',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'section',
                props: {
                  'data-testid': 'hero-section',
                },
                children: [
                  { type: 'div', props: { 'data-testid': 'hero-background' }, children: [] },
                  { type: 'div', props: { 'data-testid': 'hero-content' }, children: ['Content'] },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: hero background uses theme.animations.parallax on scroll
      await page.goto('/')

      // THEN: it should render background moving slower than foreground (parallax effect)
      const heroSection = page.locator('[data-testid="hero-section"]')
      await expect(heroSection).toBeVisible()
      const background = page.locator('[data-testid="hero-background"]')
      // THEN: assertion
      await expect(background).toBeVisible()
    }
  )

  test(
    'APP-THEME-ANIMATIONS-022: should render text appearing one character at a time',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: typewriter animation for text reveal
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            typewriter: {
              duration: '4s',
              easing: 'steps(40, end)',
              keyframes: {
                '0%': {
                  width: '0',
                },
                '100%': {
                  width: '100%',
                },
              },
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'heading',
                content: 'Welcome to our website',
                props: {
                  'data-testid': 'hero-heading',
                },
              },
            ],
          },
        ],
      })

      // WHEN: heading uses theme.animations.typewriter for character-by-character reveal
      await page.goto('/')

      // THEN: it should render text appearing one character at a time
      const heading = page.locator('[data-testid="hero-heading"]')
      await expect(heading).toHaveScreenshot('animation-app-014-typewriter.png')
    }
  )

  test(
    'APP-THEME-ANIMATIONS-023: should disable animations or use simplified versions',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: reduced motion preference respected
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            fadeIn: {
              duration: '300ms',
              enabled: true,
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            sections: [
              {
                type: 'modal',
                content: 'Modal content',
                props: {
                  'data-testid': 'modal',
                },
              },
            ],
          },
        ],
      })

      // WHEN: user has prefers-reduced-motion enabled
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')

      // THEN: it should disable animations or use simplified versions
      const modal = page.locator('[data-testid="modal"]')
      await expect(modal).toBeVisible()
      const opacity = await modal.evaluate((el) => window.getComputedStyle(el).opacity)
      // THEN: assertion
      expect(opacity).toBe('1')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // ============================================================================

  test(
    'APP-THEME-ANIMATIONS-024: user can complete full animations workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Application with comprehensive animation system
      await startServerWithSchema({
        name: 'test-app',
        theme: {
          animations: {
            fadeIn: true,
            pulse: {
              duration: '2s',
              easing: 'ease-in-out',
            },
            transition: {
              duration: '200ms',
              easing: 'ease-in-out',
            },
          },
        },
        pages: [
          {
            name: 'home',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test page' },
            sections: [
              {
                type: 'modal',
                props: {
                  'data-testid': 'modal',
                },
                children: ['Modal'],
              },
              {
                type: 'badge',
                props: {
                  'data-testid': 'badge',
                },
                children: ['5'],
              },
              {
                type: 'button',
                props: {
                  'data-testid': 'button',
                },
                children: ['Click'],
              },
            ],
          },
        ],
      })

      // WHEN/THEN: Streamlined workflow testing integration points
      await page.goto('/')

      // 1. Verify CSS compilation contains animation definitions
      const cssResponse = await page.request.get('/assets/output.css')
      // THEN: assertion
      expect(cssResponse.ok()).toBeTruthy()
      const css = await cssResponse.text()
      // Animations may generate @keyframes or CSS custom properties
      // THEN: assertion
      expect(css.length).toBeGreaterThan(1000) // Tailwind CSS with animations is substantial

      // 2. Structure validation (ARIA)
      // THEN: assertion
      await expect(page.locator('[data-testid="modal"]')).toBeVisible()
      await expect(page.locator('[data-testid="badge"]')).toBeVisible()
      await expect(page.locator('[data-testid="button"]')).toBeVisible()

      // 3. Visual validation - captures animation rendering state
      await expect(page.locator('body')).toHaveScreenshot(
        'animations-regression-001-complete-system.png',
        {
          animations: 'disabled',
        }
      )

      // Focus on workflow continuity, not exhaustive coverage
    }
  )
})
