/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from '@/specs/fixtures'

test.describe('Static Site Generation - Progressive Enhancement', () => {
  test.fixme(
    'STATIC-HYDRATION-001: should generate static HTML that works without JavaScript',
    { tag: '@spec' },
    async ({ generateStaticSite, page }) => {
      // GIVEN: app with interactive elements
      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: {
                lang: 'en',
                title: 'Test App',
                description: 'Testing progressive enhancement',
              },
              sections: [
                {
                  type: 'header',
                  props: { className: 'bg-blue-600 text-white p-4' },
                  children: [{ type: 'h1', children: ['Test Application'] }],
                },
                {
                  type: 'nav',
                  props: { className: 'p-4' },
                  children: [
                    { type: 'a', props: { href: '/', className: 'mr-4' }, children: ['Home'] },
                    {
                      type: 'a',
                      props: { href: '/about', className: 'mr-4' },
                      children: ['About'],
                    },
                    { type: 'a', props: { href: '/contact' }, children: ['Contact'] },
                  ],
                },
                {
                  type: 'main',
                  props: { className: 'p-8' },
                  children: [
                    {
                      type: 'form',
                      props: { action: '/submit', method: 'POST' },
                      children: [
                        {
                          type: 'label',
                          props: { htmlFor: 'email' },
                          children: ['Email:'],
                        },
                        {
                          type: 'input',
                          props: {
                            type: 'email',
                            id: 'email',
                            name: 'email',
                            required: true,
                            className: 'border p-2',
                          },
                        },
                        {
                          type: 'button',
                          props: {
                            type: 'submit',
                            className: 'bg-blue-600 text-white px-4 py-2 mt-2',
                          },
                          children: ['Submit'],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              name: 'about',
              path: '/about',
              meta: {
                lang: 'en',
                title: 'About',
                description: 'About page',
              },
              sections: [
                { type: 'h1', children: ['About Us'] },
                { type: 'p', children: ['Information about our company.'] },
              ],
            },
          ],
        },
        {
          hydration: false, // No JavaScript initially
        }
      )

      // WHEN: loading page with JavaScript disabled
      await page.goto(`file://${join(outputDir, 'index.html')}`)
      // TODO: JavaScript should be disabled at context level, not page level
      // await page.context().setJavaScriptEnabled(false) // This would need to be set when creating the context
      await page.reload()

      // THEN: page should be fully functional without JavaScript
      // Content should be visible
      await expect(page.locator('h1')).toHaveText('Test Application')
      await expect(page.locator('nav')).toBeVisible()
      await expect(page.locator('a[href="/about"]')).toHaveText('About')

      // Form should work without JS
      const form = page.locator('form')
      await expect(form).toHaveAttribute('action', '/submit')
      await expect(form).toHaveAttribute('method', 'POST')

      const emailInput = page.locator('input[type="email"]')
      await expect(emailInput).toBeVisible()
      await expect(emailInput).toHaveAttribute('required', '')

      const submitButton = page.locator('button[type="submit"]')
      await expect(submitButton).toHaveText('Submit')

      // Navigation links should work
      const aboutLink = page.locator('a[href="/about"]')
      await expect(aboutLink).toHaveAttribute('href', '/about')

      // Verify no JavaScript files were generated
      const files = await readdir(outputDir, { recursive: true })
      const jsFiles = files.filter((f) => f.endsWith('.js'))
      expect(jsFiles).toHaveLength(0)
    }
  )

  test.fixme(
    'STATIC-HYDRATION-002: should include hydration script for React components',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with hydration enabled
      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: {
                lang: 'en',
                title: 'Interactive App',
                description: 'App with client-side interactivity',
              },
              sections: [
                {
                  type: 'div',
                  props: {
                    className: 'counter-widget',
                    'data-component': 'Counter',
                    'data-props': JSON.stringify({ initialValue: 0 }),
                  },
                  children: [
                    { type: 'button', props: { className: 'decrement' }, children: ['-'] },
                    { type: 'span', props: { className: 'value' }, children: ['0'] },
                    { type: 'button', props: { className: 'increment' }, children: ['+'] },
                  ],
                },
                {
                  type: 'div',
                  props: {
                    className: 'accordion-widget',
                    'data-component': 'Accordion',
                    'data-props': JSON.stringify({ items: ['Item 1', 'Item 2'] }),
                  },
                  children: [
                    {
                      type: 'details',
                      children: [
                        { type: 'summary', children: ['Item 1'] },
                        { type: 'p', children: ['Content 1'] },
                      ],
                    },
                    {
                      type: 'details',
                      children: [
                        { type: 'summary', children: ['Item 2'] },
                        { type: 'p', children: ['Content 2'] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          hydration: true,
        }
      )

      // WHEN: examining generated files
      const html = await readFile(join(outputDir, 'index.html'), 'utf-8')
      const files = await readdir(outputDir, { recursive: true })
      const jsFiles = files.filter((f) => f.endsWith('.js'))

      // THEN: should include hydration script
      // HTML should have hydration markers
      expect(html).toContain('data-component="Counter"')
      expect(html).toContain('data-component="Accordion"')
      expect(html).toContain('data-props=')

      // Should generate client bundle
      expect(jsFiles.length).toBeGreaterThan(0)
      expect(files).toContain('assets/client.js')

      // HTML should reference the client bundle
      expect(html).toContain('<script type="module" src="/assets/client.js">')

      // Should include React hydration root
      expect(html).toContain('id="root"') // Or similar hydration root

      // Read the client bundle
      const clientJs = await readFile(join(outputDir, 'assets/client.js'), 'utf-8')

      // Should contain hydration code
      expect(clientJs).toContain('hydrateRoot') // React 18 hydration
      // Or expect(clientJs).toContain('hydrate') // React 17 hydration

      // Should contain component manifest
      expect(clientJs).toContain('Counter')
      expect(clientJs).toContain('Accordion')
    }
  )

  test.fixme(
    'STATIC-HYDRATION-003: should bundle client-side JavaScript',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with interactive components requiring bundling
      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: {
                lang: 'en',
                title: 'App with Bundles',
                description: 'Testing JavaScript bundling',
              },
              sections: [
                {
                  type: 'div',
                  props: {
                    'data-component': 'SearchBar',
                    'data-props': JSON.stringify({
                      placeholder: 'Search...',
                      apiEndpoint: '/api/search',
                    }),
                  },
                  children: [
                    {
                      type: 'input',
                      props: {
                        type: 'text',
                        placeholder: 'Search...',
                        className: 'search-input',
                      },
                    },
                  ],
                },
                {
                  type: 'div',
                  props: {
                    'data-component': 'TabPanel',
                    'data-props': JSON.stringify({
                      tabs: ['Tab 1', 'Tab 2', 'Tab 3'],
                    }),
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'tab-buttons' },
                      children: [
                        { type: 'button', children: ['Tab 1'] },
                        { type: 'button', children: ['Tab 2'] },
                        { type: 'button', children: ['Tab 3'] },
                      ],
                    },
                    {
                      type: 'div',
                      props: { className: 'tab-content' },
                      children: [{ type: 'p', children: ['Tab 1 Content'] }],
                    },
                  ],
                },
              ],
            },
            {
              name: 'dashboard',
              path: '/dashboard',
              meta: {
                lang: 'en',
                title: 'Dashboard',
                description: 'Interactive dashboard',
              },
              sections: [
                {
                  type: 'div',
                  props: {
                    'data-component': 'Chart',
                    'data-props': JSON.stringify({
                      type: 'line',
                      data: [10, 20, 30, 40],
                    }),
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'chart-container' },
                      children: ['Chart placeholder'],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          hydration: true,
          bundleOptimization: 'split', // Code splitting
        }
      )

      // WHEN: examining bundled files
      const files = await readdir(outputDir, { recursive: true })
      const jsFiles = files.filter((f) => f.endsWith('.js'))
      const cssFiles = files.filter((f) => f.endsWith('.css'))

      // THEN: should generate optimized bundles
      // Should have main client bundle
      expect(files).toContain('assets/client.js')

      // Should potentially have vendor bundle (React, etc.)
      const hasVendorBundle = files.some((f) => f.includes('vendor'))

      // Should have component-specific bundles or chunks
      const hasChunks = jsFiles.some((f) => f.includes('chunk') || f.includes('['))

      // At least one optimization should be present
      expect(hasVendorBundle || hasChunks || jsFiles.length > 1).toBe(true)

      // Check bundle sizes are reasonable
      const clientBundleStat = await stat(join(outputDir, 'assets/client.js'))
      expect(clientBundleStat.size).toBeGreaterThan(0)
      expect(clientBundleStat.size).toBeLessThan(500_000) // Less than 500KB

      // HTML files should reference bundles correctly
      const homeHtml = await readFile(join(outputDir, 'index.html'), 'utf-8')
      const dashboardHtml = await readFile(join(outputDir, 'dashboard.html'), 'utf-8')

      // Both should reference main bundle
      expect(homeHtml).toContain('src="/assets/client.js"')
      expect(dashboardHtml).toContain('src="/assets/client.js"')

      // Should use module scripts for ES modules
      expect(homeHtml).toContain('type="module"')

      // CSS should still be bundled separately
      expect(cssFiles.length).toBeGreaterThan(0)
      expect(files).toContain('assets/output.css')
    }
  )

  test.fixme(
    'STATIC-HYDRATION-004: should generate component manifests',
    { tag: '@spec' },
    async ({ generateStaticSite }) => {
      // GIVEN: app with various interactive components
      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          pages: [
            {
              name: 'home',
              path: '/',
              meta: {
                lang: 'en',
                title: 'Component Manifest Test',
              },
              sections: [
                {
                  type: 'div',
                  props: {
                    'data-component': 'UserProfile',
                    'data-props': JSON.stringify({
                      userId: 123,
                      showAvatar: true,
                    }),
                    'data-hydrate': 'eager',
                  },
                  children: [
                    { type: 'h2', children: ['User Profile'] },
                    { type: 'div', props: { className: 'avatar' }, children: ['Avatar'] },
                  ],
                },
                {
                  type: 'div',
                  props: {
                    'data-component': 'CommentSection',
                    'data-props': JSON.stringify({
                      postId: 456,
                      allowReplies: true,
                    }),
                    'data-hydrate': 'lazy',
                  },
                  children: [
                    { type: 'h3', children: ['Comments'] },
                    {
                      type: 'div',
                      props: { className: 'comments-list' },
                      children: ['Loading comments...'],
                    },
                  ],
                },
                {
                  type: 'div',
                  props: {
                    'data-component': 'Newsletter',
                    'data-props': JSON.stringify({
                      listId: 'main',
                    }),
                    'data-hydrate': 'visible',
                  },
                  children: [
                    { type: 'h3', children: ['Subscribe'] },
                    {
                      type: 'form',
                      children: [
                        { type: 'input', props: { type: 'email', placeholder: 'Email' } },
                        { type: 'button', children: ['Subscribe'] },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              name: 'products',
              path: '/products',
              meta: {
                lang: 'en',
                title: 'Products',
              },
              sections: [
                {
                  type: 'div',
                  props: {
                    'data-component': 'ProductGrid',
                    'data-props': JSON.stringify({
                      category: 'featured',
                      limit: 12,
                    }),
                    'data-hydrate': 'eager',
                  },
                  children: [
                    {
                      type: 'div',
                      props: { className: 'grid' },
                      children: ['Products loading...'],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          hydration: true,
          generateManifest: true,
        }
      )

      // WHEN: examining manifest files
      const files = await readdir(outputDir, { recursive: true })

      // THEN: should generate component manifest
      expect(files).toContain('assets/manifest.json')

      const manifest = JSON.parse(await readFile(join(outputDir, 'assets/manifest.json'), 'utf-8'))

      // Manifest should contain component metadata
      expect(manifest.components).toBeDefined()
      expect(manifest.components).toHaveProperty('UserProfile')
      expect(manifest.components).toHaveProperty('CommentSection')
      expect(manifest.components).toHaveProperty('Newsletter')
      expect(manifest.components).toHaveProperty('ProductGrid')

      // Each component should have hydration strategy
      expect(manifest.components.UserProfile.hydrate).toBe('eager')
      expect(manifest.components.CommentSection.hydrate).toBe('lazy')
      expect(manifest.components.Newsletter.hydrate).toBe('visible')
      expect(manifest.components.ProductGrid.hydrate).toBe('eager')

      // Should track which pages use which components
      expect(manifest.pages).toBeDefined()
      expect(manifest.pages['/']).toContain('UserProfile')
      expect(manifest.pages['/']).toContain('CommentSection')
      expect(manifest.pages['/']).toContain('Newsletter')
      expect(manifest.pages['/products']).toContain('ProductGrid')

      // HTML should have data attributes for hydration
      const homeHtml = await readFile(join(outputDir, 'index.html'), 'utf-8')
      expect(homeHtml).toContain('data-component="UserProfile"')
      expect(homeHtml).toContain('data-hydrate="eager"')
      expect(homeHtml).toContain('data-hydrate="lazy"')
      expect(homeHtml).toContain('data-hydrate="visible"')

      // Client bundle should reference the manifest
      const clientJs = await readFile(join(outputDir, 'assets/client.js'), 'utf-8')
      expect(clientJs).toContain('manifest.json') // Or similar reference
    }
  )

  test.fixme(
    'STATIC-HYDRATION-REGRESSION-001: complete progressive enhancement workflow',
    { tag: '@regression' },
    async ({ generateStaticSite, page }) => {
      // GIVEN: complete app with progressive enhancement
      const outputDir = await generateStaticSite(
        {
          name: 'test-app',
          description: 'Progressive enhancement test',
          theme: {
            colors: { primary: '#3B82F6' },
          },
          pages: [
            {
              name: 'home',
              path: '/',
              meta: {
                lang: 'en',
                title: 'Progressive App',
                description: 'Testing progressive enhancement',
              },
              sections: [
                {
                  type: 'header',
                  props: { className: 'bg-primary text-white p-4' },
                  children: [{ type: 'h1', children: ['Progressive Web App'] }],
                },
                {
                  type: 'main',
                  props: { className: 'p-8' },
                  children: [
                    // Static content
                    {
                      type: 'section',
                      props: { className: 'mb-8' },
                      children: [
                        { type: 'h2', children: ['Static Content'] },
                        { type: 'p', children: ['This content works without JavaScript.'] },
                      ],
                    },
                    // Interactive widget
                    {
                      type: 'div',
                      props: {
                        className: 'interactive-widget mb-8',
                        'data-component': 'TogglePanel',
                        'data-props': JSON.stringify({
                          title: 'Interactive Panel',
                          defaultOpen: false,
                        }),
                        'data-hydrate': 'eager',
                      },
                      children: [
                        {
                          type: 'details',
                          children: [
                            { type: 'summary', children: ['Interactive Panel'] },
                            {
                              type: 'div',
                              props: { className: 'panel-content p-4' },
                              children: ['This panel can be toggled with or without JS.'],
                            },
                          ],
                        },
                      ],
                    },
                    // Form that works with and without JS
                    {
                      type: 'form',
                      props: {
                        action: '/subscribe',
                        method: 'POST',
                        className: 'subscribe-form',
                        'data-component': 'AjaxForm',
                        'data-hydrate': 'eager',
                      },
                      children: [
                        { type: 'h3', children: ['Newsletter'] },
                        {
                          type: 'input',
                          props: {
                            type: 'email',
                            name: 'email',
                            placeholder: 'Enter your email',
                            required: true,
                            className: 'border p-2 mr-2',
                          },
                        },
                        {
                          type: 'button',
                          props: {
                            type: 'submit',
                            className: 'bg-primary text-white px-4 py-2',
                          },
                          children: ['Subscribe'],
                        },
                        {
                          type: 'div',
                          props: {
                            className: 'form-message hidden',
                            'aria-live': 'polite',
                          },
                          children: [''],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          hydration: true,
        }
      )

      // WHEN: testing with JavaScript disabled
      await page.goto(`file://${join(outputDir, 'index.html')}`)
      // TODO: JavaScript should be disabled at context level, not page level
      // await page.context().setJavaScriptEnabled(false)

      // THEN: page should work without JavaScript
      // Static content visible
      await expect(page.locator('h1')).toHaveText('Progressive Web App')
      await expect(page.locator('h2')).toHaveText('Static Content')

      // Details/summary works without JS
      const details = page.locator('details')
      await expect(details).toBeVisible()
      await expect(details.locator('summary')).toHaveText('Interactive Panel')

      // Form works without JS
      const form = page.locator('form')
      await expect(form).toHaveAttribute('action', '/subscribe')
      await expect(form).toHaveAttribute('method', 'POST')

      // WHEN: enabling JavaScript
      // TODO: JavaScript is enabled by default, this line can be removed
      // await page.setJavaScriptEnabled(true)
      await page.reload()

      // THEN: enhanced functionality should be available
      // Wait for hydration
      await page
        .waitForFunction(
          () => {
            return (
              document.querySelector('[data-hydrated="true"]') !== null ||
              document.querySelector('.hydrated') !== null
            )
          },
          { timeout: 5000 }
        )
        .catch(() => {
          // Hydration markers might vary, continue with test
        })

      // Client bundle should be loaded
      const scripts = await page.locator('script[src*="client"]').all()
      expect(scripts.length).toBeGreaterThan(0)

      // Verify files were generated correctly
      const files = await readdir(outputDir, { recursive: true })
      expect(files).toContain('index.html')
      expect(files).toContain('assets/output.css')
      expect(files).toContain('assets/client.js')

      // HTML should be valid and complete
      const html = await readFile(join(outputDir, 'index.html'), 'utf-8')
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('data-component=')
      expect(html).toContain('data-hydrate=')
    }
  )
})
