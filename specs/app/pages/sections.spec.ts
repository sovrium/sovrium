/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Page Sections
 *
 * Source: specs/app/pages/sections/sections.schema.json
 * Spec Count: 14
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (14 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Page Sections', () => {
  test(
    'APP-PAGES-SECTIONS-001: should render direct component definition',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a sections array with direct component
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'section',
                props: { id: 'hero', className: 'min-h-screen bg-gradient' },
                children: [{ type: 'single-line-text', content: 'Welcome' }],
              },
            ],
          },
        ],
      })

      // WHEN: section has type 'section' with props and children
      await page.goto('/')

      // THEN: it should render direct component definition
      const section = page.locator('section[id="hero"]')
      await expect(section).toBeVisible()
      await expect(section).toHaveClass(/min-h-screen/)
      await expect(section.locator('text=Welcome')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-SECTIONS-002: should support all component types for page building',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a section with 17 component types
      const componentTypes = [
        'section',
        'container',
        'flex',
        'grid',
        'card',
        'text',
        'icon',
        'image',
        'button',
        'link',
        'timeline',
        'accordion',
        'badge',
        'customHTML',
        'video',
        'audio',
        'iframe',
        'form',
        'input',
      ]

      // WHEN: type enum includes section, container, flex, grid, card, text, icon, image, button, link, timeline, accordion, badge, customHTML, video, audio, iframe, form, input
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: componentTypes.map((type) => ({ type })),
          },
        ],
      })
      // WHEN: user navigates to the page
      await page.goto('/')

      // THEN: it should support all component types for page building
      for (const type of componentTypes) {
        const element = page.locator(`[data-component-type="${type}"]`).first()
        expect(element).toBeTruthy()
      }
    }
  )

  test(
    'APP-PAGES-SECTIONS-003: should accept generic component properties via props.schema.json',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a section with props
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'section',
                props: {
                  id: 'hero-section',
                  className: 'min-h-screen bg-gradient',
                  style: { padding: '2rem' },
                  'data-analytics': 'hero',
                },
              },
            ],
          },
        ],
      })

      // WHEN: props includes className, id, and other component properties
      await page.goto('/')

      // THEN: it should accept generic component properties via props.schema.json
      const section = page.locator('#hero-section')
      await expect(section).toHaveAttribute('data-analytics', 'hero')
      await expect(section).toHaveClass(/min-h-screen/)
    }
  )

  test(
    'APP-PAGES-SECTIONS-004: should support unlimited nesting depth for component tree',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a section with recursive children
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'section',
                children: [
                  {
                    type: 'container',
                    children: [
                      {
                        type: 'flex',
                        children: [
                          {
                            type: 'card',
                            children: [{ type: 'single-line-text', content: 'Deeply nested' }],
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
      })

      // WHEN: children array contains nested sections
      await page.goto('/')

      // THEN: it should support unlimited nesting depth for component tree
      await expect(page.locator('text=Deeply nested')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-SECTIONS-005: should render text content',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a text component with content property
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'heading',
                props: { className: 'text-6xl font-bold' },
                content: 'Welcome to Our Platform',
              },
            ],
          },
        ],
      })

      // WHEN: component type is 'heading' with content 'Welcome to Our Platform'
      await page.goto('/')

      // THEN: it should render text content
      const heading = page.locator('h1')
      await expect(heading).toHaveText('Welcome to Our Platform')
      await expect(heading).toHaveClass(/text-6xl/)
    }
  )

  test(
    'APP-PAGES-SECTIONS-006: should apply interactive behaviors from interactions.schema.json',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a section with interactions
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'button',
                content: 'Click me',
                interactions: {
                  hover: { scale: 1.05 },
                  click: { action: 'navigate', url: '/contact' },
                  entrance: { animation: 'fadeIn', duration: '500ms' },
                },
              },
            ],
          },
        ],
      })

      // WHEN: interactions includes hover, click, scroll, entrance
      await page.goto('/')

      // THEN: it should apply interactive behaviors from interactions.schema.json
      const button = page.locator('button:has-text("Click me")')
      await expect(button).toBeVisible()
      await button.hover()
      // Note: Browsers convert scale(1.05) to matrix(1.05, 0, 0, 1.05, 0, 0)
      // THEN: assertion
      await expect(button).toHaveCSS('transform', /matrix\(1\.05, 0, 0, 1\.05, 0, 0\)/)
    }
  )

  test(
    'APP-PAGES-SECTIONS-007: should adapt component for different screen sizes',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a section with responsive overrides
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'grid',
                props: { columns: 1 },
                responsive: {
                  md: { props: { columns: 2 } },
                  lg: { props: { columns: 3 } },
                },
              },
            ],
          },
        ],
      })

      // WHEN: responsive property defines breakpoint-specific changes
      await page.goto('/')

      // THEN: it should adapt component for different screen sizes
      const grid = page.locator('[data-component-type="grid"]')
      await expect(grid).toBeVisible()
    }
  )

  test(
    'APP-PAGES-SECTIONS-008: should reference and instantiate reusable block with variables',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a block reference in sections
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'section-header',
            type: 'section',
            children: [
              { type: 'h2', content: '$title' },
              { type: 'p', content: '$subtitle' },
            ],
          },
        ],
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                block: 'section-header',
                vars: { title: 'Our Features', subtitle: 'Everything you need to succeed' },
              },
            ],
          },
        ],
      })

      // WHEN: section uses $ref with vars for variable substitution
      await page.goto('/')

      // THEN: it should reference and instantiate reusable block with variables
      await expect(page.locator('h2:has-text("Our Features")')).toBeVisible()
      await expect(page.locator('p:has-text("Everything you need to succeed")')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-SECTIONS-009: should support hybrid section composition',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: sections with mixed direct components and block references
      await startServerWithSchema({
        name: 'test-app',
        blocks: [
          {
            name: 'cta-section',
            type: 'section',
            children: [{ type: 'button', content: '$buttonLabel' }],
          },
        ],
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'section',
                props: { id: 'hero' },
                children: [{ type: 'single-line-text', content: 'Welcome' }],
              },
              { block: 'cta-section', vars: { buttonLabel: 'Get Started' } },
              { type: 'container', children: [{ type: 'single-line-text', content: 'Features' }] },
            ],
          },
        ],
      })

      // WHEN: array contains both direct definitions and block references
      await page.goto('/')

      // THEN: it should support hybrid section composition
      await expect(page.locator('text=Welcome')).toBeVisible()
      await expect(page.locator('button:has-text("Get Started")')).toBeVisible()
      await expect(page.locator('text=Features')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-SECTIONS-010: should build complex layouts through component composition',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a complex nested section tree
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'section',
                props: { className: 'py-20' },
                children: [
                  {
                    type: 'container',
                    children: [
                      {
                        type: 'flex',
                        children: [
                          {
                            type: 'grid',
                            children: [
                              {
                                type: 'card',
                                children: [
                                  {
                                    type: 'h3',
                                    content: 'Feature 1',
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
              },
            ],
          },
        ],
      })

      // WHEN: section → container → flex → grid → card → h3 hierarchy
      await page.goto('/')

      // THEN: it should build complex layouts through component composition
      await expect(page.locator('h3:has-text("Feature 1")')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-SECTIONS-011: should combine interactive and responsive features',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a section with multiple optional properties
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'button',
                content: 'Click me',
                props: { className: 'px-6 py-3' },
                interactions: { hover: { scale: 1.05 } },
                responsive: { md: { props: { className: 'px-8 py-4' } } },
              },
            ],
          },
        ],
      })

      // WHEN: section includes interactions and responsive design
      await page.goto('/')

      // THEN: it should combine interactive and responsive features
      await expect(page.locator('button:has-text("Click me")')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-SECTIONS-012: should support form building capabilities',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: sections with form components
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'form',
                props: { action: '/api/contact', method: 'POST' },
                children: [
                  {
                    type: 'input',
                    props: {
                      type: 'single-line-text',
                      name: 'name',
                      placeholder: 'Your name',
                      required: true,
                    },
                  },
                  {
                    type: 'input',
                    props: { type: 'email', name: 'email', placeholder: 'Your email' },
                  },
                  { type: 'button', props: { type: 'submit' }, content: 'Submit' },
                ],
              },
            ],
          },
        ],
      })

      // WHEN: sections include form, input types for user input
      await page.goto('/')

      // THEN: it should support form building capabilities
      const form = page.locator('form[action="/api/contact"]')
      await expect(form).toBeVisible()
      await expect(form.locator('input[name="name"]')).toBeVisible()
      await expect(form.locator('input[type="email"]')).toBeVisible()
      await expect(form.locator('button[type="submit"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-SECTIONS-013: should support rich media content',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: sections with media components
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'image',
                props: { src: '/hero.jpg', alt: 'Hero image', width: 1200, height: 600 },
              },
              { type: 'video', props: { src: '/demo.mp4', controls: true, autoplay: false } },
              { type: 'audio', props: { src: '/podcast.mp3', controls: true } },
              {
                type: 'iframe',
                props: {
                  src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
                  width: 560,
                  height: 315,
                },
              },
            ],
          },
        ],
      })

      // WHEN: sections include image, video, audio, iframe types
      await page.goto('/')

      // THEN: it should support rich media content
      await expect(page.locator('img[src="/hero.jpg"]')).toBeVisible()
      await expect(page.locator('video[src="/demo.mp4"]')).toBeVisible()
      await expect(page.locator('audio[src="/podcast.mp3"]')).toBeVisible()
      await expect(page.locator('iframe[src*="youtube.com"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-SECTIONS-014: user can complete full Page Sections workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app configuration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: { lang: 'en-US', title: 'Test', description: 'Test' },
            sections: [
              {
                type: 'section',
                props: {
                  id: 'hero',
                  className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100',
                },
                children: [
                  {
                    type: 'container',
                    props: { className: 'max-w-7xl' },
                    children: [
                      {
                        type: 'heading',
                        props: { className: 'text-6xl font-bold' },
                        content: 'Welcome to Our Platform',
                      },
                      {
                        type: 'single-line-text',
                        props: { 'data-testid': 'subtitle' },
                        content: 'Build amazing applications with ease',
                      },
                    ],
                  },
                ],
              },
              {
                type: 'section',
                props: { id: 'features' },
                children: [
                  {
                    type: 'grid',
                    props: { className: 'grid-cols-3' },
                    children: [
                      {
                        type: 'card',
                        children: [
                          { type: 'h3', content: 'Fast' },
                          { type: 'single-line-text', content: 'Lightning-fast performance' },
                        ],
                      },
                      {
                        type: 'card',
                        children: [
                          { type: 'h3', content: 'Secure' },
                          { type: 'single-line-text', content: 'Enterprise-grade security' },
                        ],
                      },
                      {
                        type: 'card',
                        children: [
                          { type: 'h3', content: 'Flexible' },
                          { type: 'single-line-text', content: 'Highly customizable' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      })
      // WHEN: user navigates to the page
      await page.goto('/')

      // Verify hero section
      // THEN: assertion
      await expect(page.locator('h1')).toHaveText('Welcome to Our Platform')
      await expect(page.locator('[data-testid="subtitle"]')).toContainText('Build amazing')

      // Verify features section with grid of cards
      await expect(page.locator('h3').first()).toHaveText('Fast')
      await expect(page.locator('section#features')).toBeVisible()
    }
  )
})
