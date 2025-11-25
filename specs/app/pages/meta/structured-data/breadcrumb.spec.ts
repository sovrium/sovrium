/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Breadcrumb Schema
 *
 * Source: specs/app/pages/meta/structured-data/breadcrumb.schema.json
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Breadcrumb Schema', () => {
  test(
    'APP-PAGES-BREADCRUMB-001: should validate minimal BreadcrumbList structured data',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: BreadcrumbList with required properties
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                breadcrumb: {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home' }],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @context is 'https://schema.org', @type is 'BreadcrumbList', and itemListElement is provided
      await page.goto('/')

      // THEN: it should validate minimal BreadcrumbList structured data
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"BreadcrumbList"')
    }
  )

  test(
    'APP-PAGES-BREADCRUMB-002: should define navigation path',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: BreadcrumbList with itemListElement array
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                breadcrumb: {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home' },
                    { '@type': 'ListItem', position: 2, name: 'Products' },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: itemListElement is array of ListItem objects
      await page.goto('/')

      // THEN: it should define navigation path
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('itemListElement')
    }
  )

  test(
    'APP-PAGES-BREADCRUMB-003: should define breadcrumb item structure',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: BreadcrumbList with ListItem
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                breadcrumb: {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home' }],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: each item has @type 'ListItem', position, name
      await page.goto('/')

      // THEN: it should define breadcrumb item structure
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"ListItem"')
      expect(scriptContent).toContain('position')
      expect(scriptContent).toContain('name')
    }
  )

  test(
    'APP-PAGES-BREADCRUMB-004: should order breadcrumb trail',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: BreadcrumbList with position
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                breadcrumb: {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home' },
                    { '@type': 'ListItem', position: 2, name: 'Products' },
                    { '@type': 'ListItem', position: 3, name: 'Widget' },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: position is integer starting from 1
      await page.goto('/')

      // THEN: it should order breadcrumb trail
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toMatch(/"position":\s*1/)
      expect(scriptContent).toMatch(/"position":\s*2/)
      expect(scriptContent).toMatch(/"position":\s*3/)
    }
  )

  test(
    'APP-PAGES-BREADCRUMB-005: should provide human-readable breadcrumb label',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: BreadcrumbList with name
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                breadcrumb: {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home' },
                    { '@type': 'ListItem', position: 2, name: 'Products' },
                    { '@type': 'ListItem', position: 3, name: 'Widget' },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: name is 'Home', 'Products', 'Widget'
      await page.goto('/')

      // THEN: it should provide human-readable breadcrumb label
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('Home')
      expect(scriptContent).toContain('Products')
      expect(scriptContent).toContain('Widget')
    }
  )

  test(
    'APP-PAGES-BREADCRUMB-006: should provide clickable breadcrumb link',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: BreadcrumbList with item URL
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                breadcrumb: {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com' },
                    {
                      '@type': 'ListItem',
                      position: 2,
                      name: 'Products',
                      item: 'https://example.com/products',
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: item is URL to breadcrumb page
      await page.goto('/')

      // THEN: it should provide clickable breadcrumb link
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('https://example.com/products')
    }
  )

  test(
    'APP-PAGES-BREADCRUMB-007: should represent multi-level navigation path',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: BreadcrumbList with multiple levels
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                breadcrumb: {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com' },
                    {
                      '@type': 'ListItem',
                      position: 2,
                      name: 'Products',
                      item: 'https://example.com/products',
                    },
                    {
                      '@type': 'ListItem',
                      position: 3,
                      name: 'Widgets',
                      item: 'https://example.com/products/widgets',
                    },
                    {
                      '@type': 'ListItem',
                      position: 4,
                      name: 'Blue Widget',
                      item: 'https://example.com/products/widgets/blue',
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: itemListElement has 3+ items (Home > Products > Widget)
      await page.goto('/')

      // THEN: it should represent multi-level navigation path
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      const positions = (scriptContent?.match(/"position":\s*\d+/g) || []).length
      expect(positions).toBeGreaterThanOrEqual(3)
    }
  )

  test(
    'APP-PAGES-BREADCRUMB-008: should help search engines understand site architecture',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: BreadcrumbList for site hierarchy
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                breadcrumb: {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com' },
                    {
                      '@type': 'ListItem',
                      position: 2,
                      name: 'Category',
                      item: 'https://example.com/category',
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: breadcrumb reflects site structure
      await page.goto('/')

      // THEN: it should help search engines understand site architecture
      await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-BREADCRUMB-009: should display breadcrumb trail in Google search results',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: BreadcrumbList for rich results
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                breadcrumb: {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com' },
                    {
                      '@type': 'ListItem',
                      position: 2,
                      name: 'Products',
                      item: 'https://example.com/products',
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: BreadcrumbList structured data is included in page metadata
      await page.goto('/')

      // THEN: it should display breadcrumb trail in Google search results
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('schema.org')
    }
  )

  test(
    'APP-PAGES-BREADCRUMB-010: should improve navigation and reduce bounce rate',
    { tag: '@spec' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      // GIVEN: BreadcrumbList for navigation UX
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                breadcrumb: {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home' },
                    { '@type': 'ListItem', position: 2, name: 'Current Page' },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: breadcrumb shows user's location in site
      await page.goto('/')

      // THEN: it should improve navigation and reduce bounce rate
      await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-META-STRUCTURED-DATA-BREADCRUMB-REGRESSION-001: user can complete full Breadcrumb workflow',
    { tag: '@regression' },
    async ({ page: _page, startServerWithSchema: _startServerWithSchema }) => {
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                breadcrumb: {
                  '@context': 'https://schema.org',
                  '@type': 'BreadcrumbList',
                  itemListElement: [
                    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com' },
                    {
                      '@type': 'ListItem',
                      position: 2,
                      name: 'Products',
                      item: 'https://example.com/products',
                    },
                    {
                      '@type': 'ListItem',
                      position: 3,
                      name: 'Widget',
                      item: 'https://example.com/products/widget',
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })
      await page.goto('/')

      // Enhanced JSON-LD validation
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()

      // Validate JSON-LD is valid JSON
      const jsonLd = JSON.parse(scriptContent!)

      // Validate JSON-LD structure
      expect(jsonLd).toHaveProperty('@context', 'https://schema.org')
      expect(jsonLd).toHaveProperty('@type', 'BreadcrumbList')
      expect(jsonLd).toHaveProperty('itemListElement')
      expect(Array.isArray(jsonLd.itemListElement)).toBe(true)
      expect(jsonLd.itemListElement).toHaveLength(3)

      // Validate breadcrumb items structure
      expect(jsonLd.itemListElement[0]).toMatchObject({
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://example.com',
      })
      expect(jsonLd.itemListElement[1]).toMatchObject({
        '@type': 'ListItem',
        position: 2,
        name: 'Products',
        item: 'https://example.com/products',
      })
      expect(jsonLd.itemListElement[2]).toMatchObject({
        '@type': 'ListItem',
        position: 3,
        name: 'Widget',
        item: 'https://example.com/products/widget',
      })

      // Backwards compatibility: string containment checks
      expect(scriptContent).toContain('"@type":"BreadcrumbList"')
      expect(scriptContent).toContain('Home')
      expect(scriptContent).toContain('Products')
      expect(scriptContent).toContain('Widget')
    }
  )
})
