/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Person Schema
 *
 * Source: src/domain/models/app/page/meta.ts
 * Spec Count: 9
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Person Schema', () => {
  test(
    'APP-PAGES-PERSON-001: should validate minimal Person structured data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Person with required properties
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                person: { '@context': 'https://schema.org', '@type': 'Person', name: 'John Doe' },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @context is 'https://schema.org', @type is 'Person', and name is provided
      await page.goto('/')

      // THEN: it should validate minimal Person structured data
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Person"')
      expect(scriptContent).toContain('John Doe')
    }
  )

  test(
    "APP-PAGES-PERSON-002: should provide person's full name",
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app configuration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                person: { '@context': 'https://schema.org', '@type': 'Person', name: 'John Doe' },
              },
            },
            sections: [],
          },
        ],
      })
      // WHEN: user navigates to the page
      await page.goto('/')
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      // THEN: assertion
      expect(scriptContent).toContain('John Doe')
    }
  )

  test(
    'APP-PAGES-PERSON-003: should provide structured first and last names',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Person with split name
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                person: {
                  '@context': 'https://schema.org',
                  '@type': 'Person',
                  name: 'John Doe',
                  givenName: 'John',
                  familyName: 'Doe',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: givenName is 'John' and familyName is 'Doe'
      await page.goto('/')

      // THEN: it should provide structured first and last names
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('givenName')
      expect(scriptContent).toContain('John')
      expect(scriptContent).toContain('familyName')
      expect(scriptContent).toContain('Doe')
    }
  )

  test(
    'APP-PAGES-PERSON-004: should provide person contact information',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Person with contact info
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                person: {
                  '@context': 'https://schema.org',
                  '@type': 'Person',
                  name: 'John Doe',
                  email: 'john@example.com',
                  telephone: '+1-555-123-4567',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: email and telephone are provided
      await page.goto('/')

      // THEN: it should provide person contact information
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('john@example.com')
      expect(scriptContent).toContain('+1-555-123-4567')
    }
  )

  test(
    "APP-PAGES-PERSON-005: should link to person's web presence",
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: app configuration
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                person: {
                  '@context': 'https://schema.org',
                  '@type': 'Person',
                  name: 'John Doe',
                  url: 'https://johndoe.com',
                },
              },
            },
            sections: [],
          },
        ],
      })
      // WHEN: user navigates to the page
      await page.goto('/')
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      // THEN: assertion
      expect(scriptContent).toContain('https://johndoe.com')
    }
  )

  test(
    'APP-PAGES-PERSON-006: should provide visual representation',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Person with image
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                person: {
                  '@context': 'https://schema.org',
                  '@type': 'Person',
                  name: 'John Doe',
                  image: 'https://example.com/john-photo.jpg',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: image is URL to person's photo
      await page.goto('/')

      // THEN: it should provide visual representation
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('john-photo.jpg')
    }
  )

  test(
    "APP-PAGES-PERSON-007: should indicate person's professional role",
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      const jobTitles = ['CEO', 'Software Engineer', 'Product Manager', 'Designer']
      for (const jobTitle of jobTitles) {
        // GIVEN: app configuration
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                schema: {
                  person: {
                    '@context': 'https://schema.org',
                    '@type': 'Person',
                    name: 'John Doe',
                    jobTitle,
                  },
                },
              },
              sections: [],
            },
          ],
        })
        // WHEN: user navigates to the page
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        // THEN: assertion
        expect(scriptContent).toContain(jobTitle)
      }
    }
  )

  test(
    'APP-PAGES-PERSON-008: should link person to their employer',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Person with worksFor
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                person: {
                  '@context': 'https://schema.org',
                  '@type': 'Person',
                  name: 'John Doe',
                  worksFor: { '@type': 'Organization', name: 'Tech Corp' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: worksFor is object with @type 'Organization' and name
      await page.goto('/')

      // THEN: it should link person to their employer
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Organization"')
      expect(scriptContent).toContain('Tech Corp')
    }
  )

  test(
    'APP-PAGES-PERSON-009: should link person to their social profiles',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Person with social profiles
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                person: {
                  '@context': 'https://schema.org',
                  '@type': 'Person',
                  name: 'John Doe',
                  sameAs: [
                    'https://twitter.com/johndoe',
                    'https://linkedin.com/in/johndoe',
                    'https://github.com/johndoe',
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: sameAs is array of social media URLs
      await page.goto('/')

      // THEN: it should link person to their social profiles
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('twitter.com/johndoe')
      expect(scriptContent).toContain('linkedin.com/in/johndoe')
      expect(scriptContent).toContain('github.com/johndoe')
    }
  )

  test(
    'APP-PAGES-PERSON-010: should include PostalAddress structured data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Person with address
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                person: {
                  '@context': 'https://schema.org',
                  '@type': 'Person',
                  name: 'John Doe',
                  address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'New York',
                    addressRegion: 'NY',
                    addressCountry: 'US',
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: address references postal-address.schema.json
      await page.goto('/')

      // THEN: it should include PostalAddress structured data
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('PostalAddress')
      expect(scriptContent).toContain('New York')
    }
  )

  test(
    'APP-PAGES-PERSON-011: should attribute content to specific author',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Person for author attribution
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                person: {
                  '@context': 'https://schema.org',
                  '@type': 'Person',
                  name: 'Jane Author',
                  jobTitle: 'Writer',
                  url: 'https://janeauthor.com',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: Person is used in article.author
      await page.goto('/')

      // THEN: it should attribute content to specific author
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('Jane Author')
      expect(scriptContent).toContain('Writer')
    }
  )

  test(
    'APP-PAGES-PERSON-012: should enable Google Knowledge Graph panel for notable persons',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Person for knowledge graph
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                person: {
                  '@context': 'https://schema.org',
                  '@type': 'Person',
                  name: 'Notable Person',
                  jobTitle: 'Industry Leader',
                  url: 'https://notableperson.com',
                  image: 'https://example.com/photo.jpg',
                  sameAs: ['https://twitter.com/notable', 'https://linkedin.com/in/notable'],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: complete person data is provided
      await page.goto('/')

      // THEN: it should enable Google Knowledge Graph panel for notable persons
      await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-PERSON-013: user can complete full Person workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('Setup: Start server with Person schema', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'Test',
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                schema: {
                  person: {
                    '@context': 'https://schema.org',
                    '@type': 'Person',
                    name: 'Complete Person Profile',
                    givenName: 'John',
                    familyName: 'Smith',
                    email: 'john.smith@example.com',
                    telephone: '+1-555-987-6543',
                    url: 'https://johnsmith.com',
                    image: 'https://example.com/john.jpg',
                    jobTitle: 'Senior Software Engineer',
                    worksFor: { '@type': 'Organization', name: 'Tech Innovations Inc' },
                    sameAs: [
                      'https://twitter.com/johnsmith',
                      'https://linkedin.com/in/johnsmith',
                      'https://github.com/johnsmith',
                    ],
                  },
                },
              },
              sections: [],
            },
          ],
        })
      })

      let jsonLd: any

      await test.step('Navigate to page and parse JSON-LD', async () => {
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        jsonLd = JSON.parse(scriptContent!)
      })

      await test.step('Verify Person schema structure', async () => {
        expect(jsonLd).toHaveProperty('@context', 'https://schema.org')
        expect(jsonLd).toHaveProperty('@type', 'Person')
        expect(jsonLd).toHaveProperty('name', 'Complete Person Profile')
        expect(jsonLd).toHaveProperty('givenName', 'John')
        expect(jsonLd).toHaveProperty('familyName', 'Smith')
        expect(jsonLd).toHaveProperty('email', 'john.smith@example.com')
        expect(jsonLd).toHaveProperty('telephone', '+1-555-987-6543')
        expect(jsonLd).toHaveProperty('url', 'https://johnsmith.com')
        expect(jsonLd).toHaveProperty('image', 'https://example.com/john.jpg')
        expect(jsonLd).toHaveProperty('jobTitle', 'Senior Software Engineer')

        // Validate worksFor structure
        expect(jsonLd.worksFor).toMatchObject({
          '@type': 'Organization',
          name: 'Tech Innovations Inc',
        })

        // Validate social media links
        expect(Array.isArray(jsonLd.sameAs)).toBe(true)
        expect(jsonLd.sameAs).toHaveLength(3)
        expect(jsonLd.sameAs).toContain('https://twitter.com/johnsmith')
        expect(jsonLd.sameAs).toContain('https://linkedin.com/in/johnsmith')
        expect(jsonLd.sameAs).toContain('https://github.com/johnsmith')

        // Backwards compatibility: string containment checks
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('"@type":"Person"')
        expect(scriptContent).toContain('Complete Person Profile')
        expect(scriptContent).toContain('Tech Innovations Inc')
      })
    }
  )
})
