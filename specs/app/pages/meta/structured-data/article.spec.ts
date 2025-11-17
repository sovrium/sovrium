/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Article Schema
 *
 * Source: specs/app/pages/meta/structured-data/article.schema.json
 * Spec Count: 14
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (14 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Article Schema', () => {
  test(
    'APP-PAGES-ARTICLE-001: should validate minimal Article structured data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article with required properties
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: 'Amazing Article Title',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @context is 'https://schema.org', @type is 'Article', and headline is provided
      await page.goto('/')

      // THEN: it should validate minimal Article structured data
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Article"')
      expect(scriptContent).toContain('Amazing Article Title')
    }
  )

  test(
    'APP-PAGES-ARTICLE-002: should categorize content type',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article with @type enum
      const types = ['Article', 'NewsArticle', 'BlogPosting']
      for (const type of types) {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              name: 'home',

              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                schema: {
                  article: {
                    '@context': 'https://schema.org',
                    '@type': type,
                    headline: 'Test Article',
                  },
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain(`"@type":"${type}"`)
      }
    }
  )

  test(
    'APP-PAGES-ARTICLE-003: should provide article title for rich results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article with headline
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: '10 Tips for Better Productivity',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @type is 'Article', 'NewsArticle', or 'BlogPosting'
      await page.goto('/')

      // THEN: it should categorize content type
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('10 Tips for Better Productivity')
    }
  )

  test(
    'APP-PAGES-ARTICLE-004: should provide article summary',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article with description
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: 'Article Title',
                  description:
                    'This article explores proven strategies for improving daily productivity',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: headline is article title
      await page.goto('/')

      // THEN: it should provide article title for rich results
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('proven strategies for improving daily productivity')
    }
  )

  test(
    'APP-PAGES-ARTICLE-005: should support single or multiple article images',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article with image
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: 'Test',
                  image: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: description summarizes article content
      await page.goto('/')

      // THEN: it should provide article summary
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('image1.jpg')
      expect(scriptContent).toContain('image2.jpg')
    }
  )

  test(
    'APP-PAGES-ARTICLE-006: should provide simple author name',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article with author as string
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: 'Test',
                  author: 'John Doe',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: image is string URL or array of URLs
      await page.goto('/')

      // THEN: it should support single or multiple article images
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('John Doe')
    }
  )

  test(
    'APP-PAGES-ARTICLE-007: should provide structured author information',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article with author as Person object
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: 'Test',
                  author: {
                    '@type': 'Person',
                    name: 'Jane Smith',
                    url: 'https://example.com/jane',
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: author is 'John Doe'
      await page.goto('/')

      // THEN: it should provide simple author name
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Person"')
      expect(scriptContent).toContain('Jane Smith')
    }
  )

  test(
    'APP-PAGES-ARTICLE-008: should attribute content to organization',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article with author as Organization
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: 'Test',
                  author: { '@type': 'Organization', name: 'Tech Blog' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: author is object with @type 'Person', name, and url
      await page.goto('/')

      // THEN: it should provide structured author information
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Organization"')
      expect(scriptContent).toContain('Tech Blog')
    }
  )

  test(
    'APP-PAGES-ARTICLE-009: should provide publication date',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article with datePublished
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: 'Test',
                  datePublished: '2025-01-15T09:00:00Z',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: author is object with @type 'Organization' and name
      await page.goto('/')

      // THEN: it should attribute content to organization
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('2025-01-15T09:00:00Z')
    }
  )

  test(
    'APP-PAGES-ARTICLE-010: should indicate last update date',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article with dateModified
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: 'Test',
                  datePublished: '2025-01-15T09:00:00Z',
                  dateModified: '2025-01-20T14:30:00Z',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: datePublished is ISO 8601 date-time
      await page.goto('/')

      // THEN: it should provide publication date
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('2025-01-20T14:30:00Z')
    }
  )

  test(
    'APP-PAGES-ARTICLE-011: should identify publishing organization',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article with publisher
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: 'Test',
                  publisher: {
                    '@type': 'Organization',
                    name: 'Tech Media',
                    logo: { '@type': 'ImageObject', url: 'https://example.com/logo.png' },
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: dateModified is ISO 8601 date-time
      await page.goto('/')

      // THEN: it should indicate last update date
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('Tech Media')
      expect(scriptContent).toContain('logo.png')
    }
  )

  test(
    "APP-PAGES-ARTICLE-012: should specify article's primary page URL",
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: 'Test',
                  mainEntityOfPage: 'https://example.com/articles/productivity-tips',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: publisher is object with @type 'Organization', name, and logo (ImageObject)
      await page.goto('/')

      // THEN: it should identify publishing organization
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('https://example.com/articles/productivity-tips')
    }
  )

  test(
    'APP-PAGES-ARTICLE-013: should enable Google News and article rich results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article for rich results
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'NewsArticle',
                  headline: 'Breaking News Story',
                  author: { '@type': 'Person', name: 'Reporter Name' },
                  datePublished: '2025-01-15T09:00:00Z',
                  publisher: {
                    '@type': 'Organization',
                    name: 'News Corp',
                    logo: { '@type': 'ImageObject', url: 'https://example.com/logo.png' },
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: complete article data with author, dates, and publisher is provided
      await page.goto('/')

      // THEN: it should enable Google News and article rich results
      await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-ARTICLE-014: should properly attribute content to authors and publishers',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Article for content attribution
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'BlogPosting',
                  headline: 'Complete Blog Post',
                  description: 'Comprehensive guide',
                  author: { '@type': 'Person', name: 'John Doe', url: 'https://example.com/john' },
                  datePublished: '2025-01-15T09:00:00Z',
                  publisher: { '@type': 'Organization', name: 'Blog Network' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: Article structured data is included in blog posts
      await page.goto('/')

      // THEN: it should properly attribute content to authors and publishers
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('John Doe')
      expect(scriptContent).toContain('Blog Network')
    }
  )

  test(
    'APP-PAGES-META-STRUCTURED-DATA-ARTICLE-REGRESSION-001: user can complete full Article workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                article: {
                  '@context': 'https://schema.org',
                  '@type': 'Article',
                  headline: 'Complete Article Test',
                  description: 'Testing all article features',
                  image: 'https://example.com/article-image.jpg',
                  author: { '@type': 'Person', name: 'Test Author' },
                  datePublished: '2025-01-15T09:00:00Z',
                  dateModified: '2025-01-20T14:30:00Z',
                  publisher: {
                    '@type': 'Organization',
                    name: 'Test Publisher',
                    logo: { '@type': 'ImageObject', url: 'https://example.com/logo.png' },
                  },
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
      expect(jsonLd).toHaveProperty('@type', 'Article')
      expect(jsonLd).toHaveProperty('headline', 'Complete Article Test')
      expect(jsonLd).toHaveProperty('description', 'Testing all article features')
      expect(jsonLd).toHaveProperty('image', 'https://example.com/article-image.jpg')

      // Validate author structure
      expect(jsonLd.author).toMatchObject({
        '@type': 'Person',
        name: 'Test Author',
      })

      // Validate dates
      expect(jsonLd).toHaveProperty('datePublished', '2025-01-15T09:00:00Z')
      expect(jsonLd).toHaveProperty('dateModified', '2025-01-20T14:30:00Z')

      // Validate publisher structure
      expect(jsonLd.publisher).toMatchObject({
        '@type': 'Organization',
        name: 'Test Publisher',
        logo: {
          '@type': 'ImageObject',
          url: 'https://example.com/logo.png',
        },
      })

      // Backwards compatibility: string containment checks
      expect(scriptContent).toContain('"@type":"Article"')
      expect(scriptContent).toContain('Complete Article Test')
      expect(scriptContent).toContain('Test Author')
      expect(scriptContent).toContain('Test Publisher')
    }
  )
})
