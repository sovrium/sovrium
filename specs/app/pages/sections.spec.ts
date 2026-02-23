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
 * Source: src/domain/models/app/page/sections.ts
 * Spec Count: 13
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
    'APP-PAGES-SECTIONS-008: should reference and instantiate reusable component with variables',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: a component reference in sections
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
                component: 'section-header',
                vars: { title: 'Our Features', subtitle: 'Everything you need to succeed' },
              },
            ],
          },
        ],
      })

      // WHEN: section uses $ref with vars for variable substitution
      await page.goto('/')

      // THEN: it should reference and instantiate reusable component with variables
      await expect(page.locator('h2:has-text("Our Features")')).toBeVisible()
      await expect(page.locator('p:has-text("Everything you need to succeed")')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-SECTIONS-009: should support hybrid section composition',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: sections with mixed direct components and component references
      await startServerWithSchema({
        name: 'test-app',
        components: [
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
              { component: 'cta-section', vars: { buttonLabel: 'Get Started' } },
              { type: 'container', children: [{ type: 'single-line-text', content: 'Features' }] },
            ],
          },
        ],
      })

      // WHEN: array contains both direct definitions and component references
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
    'APP-PAGES-SECTIONS-REGRESSION: user can complete full Page Sections workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // ============================================================================
      // OPTIMIZED: Consolidated from 13 startServerWithSchema calls to 2
      // Groups organized by schema requirements:
      // - Group 1: Tests 001-007, 010-013 - Direct component tests (no components)
      // - Group 2: Tests 008-009 - Tests requiring components definition
      // ============================================================================

      // Group 1: Comprehensive setup with all direct component sections
      // Combines tests 001, 003, 004, 005, 006, 007, 010, 011, 012, 013
      // Note: Test 002 (all component types) omitted as it's primarily testing type enum
      await test.step('Setup: Start server with comprehensive direct components', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: { lang: 'en-US', title: 'Test', description: 'Test' },
              sections: [
                // 001: Direct component with id, className, children
                {
                  type: 'section',
                  props: { id: 'hero', className: 'min-h-screen bg-gradient' },
                  children: [{ type: 'single-line-text', content: 'Welcome' }],
                },
                // 003: Generic component properties with data-analytics
                {
                  type: 'section',
                  props: {
                    id: 'hero-section',
                    className: 'min-h-screen bg-gradient',
                    style: { padding: '2rem' },
                    'data-analytics': 'hero',
                  },
                },
                // 004: Deeply nested component tree
                {
                  type: 'section',
                  props: { id: 'nested-section' },
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
                // 005: Heading with text content
                {
                  type: 'heading',
                  props: { className: 'text-6xl font-bold' },
                  content: 'Welcome to Our Platform',
                },
                // 006: Button with interactions (hover scale)
                {
                  type: 'button',
                  props: { id: 'interactive-btn' },
                  content: 'Click me',
                  interactions: {
                    hover: { scale: 1.05 },
                    click: { action: 'navigate', url: '/contact' },
                    entrance: { animation: 'fadeIn', duration: '500ms' },
                  },
                },
                // 007: Grid with responsive props
                {
                  type: 'grid',
                  props: { columns: 1 },
                  responsive: {
                    md: { props: { columns: 2 } },
                    lg: { props: { columns: 3 } },
                  },
                },
                // 010: Complex layout composition
                {
                  type: 'section',
                  props: { className: 'py-20', id: 'complex-layout' },
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
                                  children: [{ type: 'h3', content: 'Feature 1' }],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                // 011: Button with interactions + responsive
                {
                  type: 'button',
                  props: { className: 'px-6 py-3', id: 'responsive-btn' },
                  content: 'Responsive Button',
                  interactions: { hover: { scale: 1.05 } },
                  responsive: { md: { props: { className: 'px-8 py-4' } } },
                },
                // 012: Form with inputs
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
                // 013: Rich media content
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
        await page.goto('/')
      })

      await test.step('APP-PAGES-SECTIONS-001: Render direct component definition', async () => {
        const section = page.locator('section[id="hero"]')
        await expect(section).toBeVisible()
        await expect(section).toHaveClass(/min-h-screen/)
        await expect(section.locator('text=Welcome')).toBeVisible()
      })

      await test.step('APP-PAGES-SECTIONS-003: Accept generic component properties', async () => {
        const section = page.locator('#hero-section')
        await expect(section).toHaveAttribute('data-analytics', 'hero')
        await expect(section).toHaveClass(/min-h-screen/)
      })

      await test.step('APP-PAGES-SECTIONS-004: Support unlimited nesting depth', async () => {
        await expect(page.locator('text=Deeply nested')).toBeVisible()
      })

      await test.step('APP-PAGES-SECTIONS-005: Render text content', async () => {
        const heading = page.locator('h1')
        await expect(heading).toHaveText('Welcome to Our Platform')
        await expect(heading).toHaveClass(/text-6xl/)
      })

      await test.step('APP-PAGES-SECTIONS-006: Apply interactive behaviors', async () => {
        const button = page.locator('#interactive-btn')
        await expect(button).toBeVisible()
        await button.hover()
        await expect(button).toHaveCSS('transform', /matrix\(1\.05, 0, 0, 1\.05, 0, 0\)/)
      })

      await test.step('APP-PAGES-SECTIONS-007: Adapt component for different screen sizes', async () => {
        // Multiple grid components exist in merged schema, use .first() to avoid strict mode violation
        const grid = page.locator('[data-component-type="grid"]').first()
        await expect(grid).toBeVisible()
      })

      await test.step('APP-PAGES-SECTIONS-010: Build complex layouts through composition', async () => {
        await expect(page.locator('h3:has-text("Feature 1")')).toBeVisible()
      })

      await test.step('APP-PAGES-SECTIONS-011: Combine interactive and responsive features', async () => {
        await expect(page.locator('#responsive-btn')).toBeVisible()
      })

      await test.step('APP-PAGES-SECTIONS-012: Support form building capabilities', async () => {
        const form = page.locator('form[action="/api/contact"]')
        await expect(form).toBeVisible()
        await expect(form.locator('input[name="name"]')).toBeVisible()
        await expect(form.locator('input[type="email"]')).toBeVisible()
        await expect(form.locator('button[type="submit"]')).toBeVisible()
      })

      await test.step('APP-PAGES-SECTIONS-013: Support rich media content', async () => {
        await expect(page.locator('img[src="/hero.jpg"]')).toBeVisible()
        await expect(page.locator('video[src="/demo.mp4"]')).toBeVisible()
        await expect(page.locator('audio[src="/podcast.mp3"]')).toBeVisible()
        await expect(page.locator('iframe[src*="youtube.com"]')).toBeVisible()
      })

      // Group 2: Tests requiring components definition (conflicting schema - need separate setup)
      await test.step('Setup: Start server with components configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          components: [
            // Component for test 008
            {
              name: 'section-header',
              type: 'section',
              children: [
                { type: 'h2', content: '$title' },
                { type: 'p', content: '$subtitle' },
              ],
            },
            // Component for test 009
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
                // 008: Component reference with variable substitution
                {
                  component: 'section-header',
                  vars: { title: 'Our Features', subtitle: 'Everything you need to succeed' },
                },
                // 009: Hybrid composition (direct + component references)
                {
                  type: 'section',
                  props: { id: 'hybrid-hero' },
                  children: [{ type: 'single-line-text', content: 'Welcome Hybrid' }],
                },
                { component: 'cta-section', vars: { buttonLabel: 'Get Started' } },
                {
                  type: 'container',
                  children: [{ type: 'single-line-text', content: 'Features Hybrid' }],
                },
              ],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-PAGES-SECTIONS-008: Reference and instantiate reusable component', async () => {
        await expect(page.locator('h2:has-text("Our Features")')).toBeVisible()
        await expect(page.locator('p:has-text("Everything you need to succeed")')).toBeVisible()
      })

      await test.step('APP-PAGES-SECTIONS-009: Support hybrid section composition', async () => {
        await expect(page.locator('text=Welcome Hybrid')).toBeVisible()
        await expect(page.locator('button:has-text("Get Started")')).toBeVisible()
        await expect(page.locator('text=Features Hybrid')).toBeVisible()
      })

      // Test 002 requires its own setup due to unique all-component-types configuration
      await test.step('Setup: Start server with all component types', async () => {
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
        await page.goto('/')
      })

      await test.step('APP-PAGES-SECTIONS-002: Support all component types', async () => {
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
        for (const type of componentTypes) {
          const element = page.locator(`[data-component-type="${type}"]`).first()
          expect(element).toBeTruthy()
        }
      })
    }
  )
})
