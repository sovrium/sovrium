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
 * Source: src/domain/models/app/page/meta.ts
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
    async ({ page, startServerWithSchema }) => {
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
    async ({ page, startServerWithSchema }) => {
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
    async ({ page, startServerWithSchema }) => {
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
    async ({ page, startServerWithSchema }) => {
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
    async ({ page, startServerWithSchema }) => {
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
    async ({ page, startServerWithSchema }) => {
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
    async ({ page, startServerWithSchema }) => {
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
    async ({ page, startServerWithSchema }) => {
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
    async ({ page, startServerWithSchema }) => {
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
    async ({ page, startServerWithSchema }) => {
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

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 10 @spec tests - covers: minimal BreadcrumbList, navigation path,
  // item structure, ordering, human-readable labels, clickable links, multi-level paths,
  // site architecture, Google search results, navigation UX
  // ============================================================================

  test(
    'APP-PAGES-BREADCRUMB-REGRESSION: user can complete full Breadcrumb workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('APP-PAGES-BREADCRUMB-001: Validate minimal BreadcrumbList structured data', async () => {
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
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('"@type":"BreadcrumbList"')
      })

      await test.step('APP-PAGES-BREADCRUMB-002: Define navigation path', async () => {
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
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('itemListElement')
      })

      await test.step('APP-PAGES-BREADCRUMB-003: Define breadcrumb item structure', async () => {
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
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('"@type":"ListItem"')
        expect(scriptContent).toContain('position')
        expect(scriptContent).toContain('name')
      })

      await test.step('APP-PAGES-BREADCRUMB-004: Order breadcrumb trail', async () => {
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
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toMatch(/"position":\s*1/)
        expect(scriptContent).toMatch(/"position":\s*2/)
        expect(scriptContent).toMatch(/"position":\s*3/)
      })

      await test.step('APP-PAGES-BREADCRUMB-005: Provide human-readable breadcrumb label', async () => {
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
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('Home')
        expect(scriptContent).toContain('Products')
        expect(scriptContent).toContain('Widget')
      })

      await test.step('APP-PAGES-BREADCRUMB-006: Provide clickable breadcrumb link', async () => {
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
                      {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Home',
                        item: 'https://example.com',
                      },
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
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('https://example.com/products')
      })

      await test.step('APP-PAGES-BREADCRUMB-007: Represent multi-level navigation path', async () => {
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
                      {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Home',
                        item: 'https://example.com',
                      },
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
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        const positions = (scriptContent?.match(/"position":\s*\d+/g) || []).length
        expect(positions).toBeGreaterThanOrEqual(3)
      })

      await test.step('APP-PAGES-BREADCRUMB-008: Help search engines understand site architecture', async () => {
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
                      {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Home',
                        item: 'https://example.com',
                      },
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
        await page.goto('/')
        await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
      })

      await test.step('APP-PAGES-BREADCRUMB-009: Display breadcrumb trail in Google search results', async () => {
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
                      {
                        '@type': 'ListItem',
                        position: 1,
                        name: 'Home',
                        item: 'https://example.com',
                      },
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
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('schema.org')
      })

      await test.step('APP-PAGES-BREADCRUMB-010: Improve navigation and reduce bounce rate', async () => {
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
        await page.goto('/')
        await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
      })
    }
  )
})
