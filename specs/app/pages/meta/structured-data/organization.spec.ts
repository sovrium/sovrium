/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Organization Schema
 *
 * Source: specs/app/pages/meta/structured-data/organization.schema.json
 * Spec Count: 14
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (14 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Organization Schema', () => {
  test(
    'APP-PAGES-ORGANIZATION-001: should validate minimal Organization structured data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with required properties
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'My Company',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @context is 'https://schema.org', @type is 'Organization', and name is provided
      await page.goto('/')

      // THEN: it should validate minimal Organization structured data
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Organization"')
      expect(scriptContent).toContain('My Company')
    }
  )

  test(
    'APP-PAGES-ORGANIZATION-002: should specify Schema.org vocabulary',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with @context
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Company',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @context is 'https://schema.org' (const)
      await page.goto('/')

      // THEN: it should specify Schema.org vocabulary
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@context":"https://schema.org"')
    }
  )

  test(
    'APP-PAGES-ORGANIZATION-003: should identify entity as Organization',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with @type
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Company',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @type is 'Organization' (const)
      await page.goto('/')

      // THEN: it should identify entity as Organization
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Organization"')
    }
  )

  test(
    'APP-PAGES-ORGANIZATION-004: should provide organization name',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with name
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'My Company',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: name is 'My Company'
      await page.goto('/')

      // THEN: it should provide organization name
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('My Company')
    }
  )

  test(
    'APP-PAGES-ORGANIZATION-005: should provide organization website URL',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with url
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Company',
                  url: 'https://example.com',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: url is 'https://example.com'
      await page.goto('/')

      // THEN: it should provide organization website URL
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('https://example.com')
    }
  )

  test(
    'APP-PAGES-ORGANIZATION-006: should provide logo for search results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with logo
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Company',
                  logo: 'https://example.com/logo.png',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: logo is URL to organization logo
      await page.goto('/')

      // THEN: it should provide logo for search results
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('logo.png')
    }
  )

  test(
    'APP-PAGES-ORGANIZATION-007: should support single or multiple organization images',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with image
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Company',
                  image: ['https://example.com/office1.jpg', 'https://example.com/office2.jpg'],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: image is string URL or array of URLs
      await page.goto('/')

      // THEN: it should support single or multiple organization images
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('office1.jpg')
      expect(scriptContent).toContain('office2.jpg')
    }
  )

  test(
    'APP-PAGES-ORGANIZATION-008: should provide contact information',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with contact info
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Company',
                  email: 'info@example.com',
                  telephone: '+1-800-555-1234',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: email and telephone are provided
      await page.goto('/')

      // THEN: it should provide contact information
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('info@example.com')
      expect(scriptContent).toContain('+1-800-555-1234')
    }
  )

  test(
    'APP-PAGES-ORGANIZATION-009: should include PostalAddress structured data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with address
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Company',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '100 Corporate Blvd',
                    addressLocality: 'San Francisco',
                    addressRegion: 'CA',
                    postalCode: '94105',
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
      expect(scriptContent).toContain('San Francisco')
    }
  )

  test.fixme(
    'APP-PAGES-ORGANIZATION-010: should link organization to social profiles',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with social profiles
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Company',
                  sameAs: [
                    'https://facebook.com/company',
                    'https://twitter.com/company',
                    'https://linkedin.com/company/company',
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: sameAs is array of social media URLs (Facebook, Twitter, LinkedIn)
      await page.goto('/')

      // THEN: it should link organization to social profiles
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('facebook.com')
      expect(scriptContent).toContain('twitter.com')
      expect(scriptContent).toContain('linkedin.com')
    }
  )

  test.fixme(
    'APP-PAGES-ORGANIZATION-011: should provide organization history',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with founder info
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Tech Startup',
                  founder: 'Jane Doe',
                  foundingDate: '2020-03-15',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: founder name and foundingDate are provided
      await page.goto('/')

      // THEN: it should provide organization history
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('Jane Doe')
      expect(scriptContent).toContain('2020-03-15')
    }
  )

  test.fixme(
    'APP-PAGES-ORGANIZATION-012: should indicate organization size',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with employees count
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Growing Company',
                  employees: 50,
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: employees is integer minimum 1
      await page.goto('/')

      // THEN: it should indicate organization size
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('50')
    }
  )

  test.fixme(
    'APP-PAGES-ORGANIZATION-013: should link organization to hosted events',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with event
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Event Host',
                  event: {
                    '@type': 'EducationEvent',
                    name: 'Annual Conference',
                    startDate: '2025-09-01T09:00:00Z',
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: event references education-event.schema.json
      await page.goto('/')

      // THEN: it should link organization to hosted events
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('EducationEvent')
      expect(scriptContent).toContain('Annual Conference')
    }
  )

  test.fixme(
    'APP-PAGES-ORGANIZATION-014: should enable Google Knowledge Graph panel in search results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization for knowledge graph
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Notable Company',
                  description: 'Leading technology company',
                  url: 'https://example.com',
                  logo: 'https://example.com/logo.png',
                  sameAs: ['https://facebook.com/company', 'https://twitter.com/company'],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: complete organization data is provided
      await page.goto('/')

      // THEN: it should enable Google Knowledge Graph panel in search results
      await expect(page.locator('script[type="application/ld+json"]')).toBeVisible()
    }
  )

  test(
    'APP-PAGES-META-STRUCTURED-DATA-ORGANIZATION-REGRESSION-001: user can complete full Organization workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
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
                organization: {
                  '@context': 'https://schema.org',
                  '@type': 'Organization',
                  name: 'Complete Tech Company',
                  description: 'Innovative technology solutions',
                  url: 'https://example.com',
                  logo: 'https://example.com/logo.png',
                  email: 'info@example.com',
                  telephone: '+1-800-123-4567',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '123 Tech Lane',
                    addressLocality: 'San Francisco',
                    addressRegion: 'CA',
                    postalCode: '94105',
                    addressCountry: 'US',
                  },
                  sameAs: ['https://facebook.com/techcompany', 'https://twitter.com/techcompany'],
                  founder: 'John Smith',
                  foundingDate: '2018-01-15',
                  employees: 150,
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
      expect(jsonLd).toHaveProperty('@type', 'Organization')
      expect(jsonLd).toHaveProperty('name', 'Complete Tech Company')
      expect(jsonLd).toHaveProperty('description', 'Innovative technology solutions')
      expect(jsonLd).toHaveProperty('url', 'https://example.com')
      expect(jsonLd).toHaveProperty('logo', 'https://example.com/logo.png')
      expect(jsonLd).toHaveProperty('email', 'info@example.com')
      expect(jsonLd).toHaveProperty('telephone', '+1-800-123-4567')
      expect(jsonLd).toHaveProperty('founder', 'John Smith')
      expect(jsonLd).toHaveProperty('foundingDate', '2018-01-15')
      expect(jsonLd).toHaveProperty('employees', 150)

      // Validate address structure
      expect(jsonLd.address).toMatchObject({
        '@type': 'PostalAddress',
        streetAddress: '123 Tech Lane',
        addressLocality: 'San Francisco',
        addressRegion: 'CA',
        postalCode: '94105',
        addressCountry: 'US',
      })

      // Validate social media links
      expect(Array.isArray(jsonLd.sameAs)).toBe(true)
      expect(jsonLd.sameAs).toHaveLength(2)
      expect(jsonLd.sameAs).toContain('https://facebook.com/techcompany')
      expect(jsonLd.sameAs).toContain('https://twitter.com/techcompany')

      // Backwards compatibility: string containment checks
      expect(scriptContent).toContain('"@type":"Organization"')
      expect(scriptContent).toContain('Complete Tech Company')
      expect(scriptContent).toContain('San Francisco')
    }
  )
})
