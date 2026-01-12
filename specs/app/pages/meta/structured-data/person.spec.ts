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
 * Spec Count: 12
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

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 12 @spec tests - covers: minimal Person, full name, given/family name,
  // contact info, web presence, image, job title, employer, social profiles,
  // postal address, author attribution, Knowledge Graph panel
  //
  // OPTIMIZATION: Consolidated from 15 startServerWithSchema calls to 1
  // All Person properties are ADDITIVE - one comprehensive schema covers all assertions
  // ============================================================================

  test(
    'APP-PAGES-PERSON-REGRESSION: user can complete full Person workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // Setup: Start server with comprehensive Person configuration
      // This single schema contains ALL properties needed for all 12 test steps
      await test.step('Setup: Start server with comprehensive Person configuration', async () => {
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
                    // Basic name info (001, 002, 003)
                    name: 'John Doe',
                    givenName: 'John',
                    familyName: 'Doe',
                    // Contact info (004)
                    email: 'john@example.com',
                    telephone: '+1-555-123-4567',
                    // Web presence (005)
                    url: 'https://johndoe.com',
                    // Visual representation (006)
                    image: 'https://example.com/john-photo.jpg',
                    // Professional role (007) - single jobTitle validates the feature
                    jobTitle: 'CEO',
                    // Employer (008)
                    worksFor: { '@type': 'Organization', name: 'Tech Corp' },
                    // Social profiles (009)
                    sameAs: [
                      'https://twitter.com/johndoe',
                      'https://linkedin.com/in/johndoe',
                      'https://github.com/johndoe',
                    ],
                    // Address (010)
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
        await page.goto('/')
      })

      await test.step('APP-PAGES-PERSON-001: Validate minimal Person structured data', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('"@type":"Person"')
        expect(scriptContent).toContain('John Doe')
      })

      await test.step("APP-PAGES-PERSON-002: Provide person's full name", async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('John Doe')
      })

      await test.step('APP-PAGES-PERSON-003: Provide structured first and last names', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('givenName')
        expect(scriptContent).toContain('John')
        expect(scriptContent).toContain('familyName')
        expect(scriptContent).toContain('Doe')
      })

      await test.step('APP-PAGES-PERSON-004: Provide person contact information', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('john@example.com')
        expect(scriptContent).toContain('+1-555-123-4567')
      })

      await test.step("APP-PAGES-PERSON-005: Link to person's web presence", async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('https://johndoe.com')
      })

      await test.step('APP-PAGES-PERSON-006: Provide visual representation', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('john-photo.jpg')
      })

      await test.step("APP-PAGES-PERSON-007: Indicate person's professional role", async () => {
        // Comprehensive schema has jobTitle: 'CEO' - validates the feature
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('CEO')
      })

      await test.step('APP-PAGES-PERSON-008: Link person to their employer', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('"@type":"Organization"')
        expect(scriptContent).toContain('Tech Corp')
      })

      await test.step('APP-PAGES-PERSON-009: Link person to their social profiles', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('twitter.com/johndoe')
        expect(scriptContent).toContain('linkedin.com/in/johndoe')
        expect(scriptContent).toContain('github.com/johndoe')
      })

      await test.step('APP-PAGES-PERSON-010: Include PostalAddress structured data', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('PostalAddress')
        expect(scriptContent).toContain('New York')
      })

      await test.step('APP-PAGES-PERSON-011: Attribute content to specific author', async () => {
        // The comprehensive schema demonstrates author attribution capability
        // by having name + jobTitle + url - the key author attribution properties
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('John Doe')
        expect(scriptContent).toContain('CEO')
      })

      await test.step('APP-PAGES-PERSON-012: Enable Google Knowledge Graph panel for notable persons', async () => {
        // Complete person data (name, jobTitle, url, image, sameAs) enables Knowledge Graph
        await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
      })
    }
  )
})
