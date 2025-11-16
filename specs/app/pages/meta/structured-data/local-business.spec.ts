/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Local Business Schema
 *
 * Source: specs/app/pages/meta/structured-data/local-business.schema.json
 * Spec Count: 14
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (14 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Local Business Schema', () => {
  test(
    'APP-PAGES-LOCALBUSINESS-001: should validate minimal LocalBusiness structured data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with required properties
      await startServerWithSchema({
        name: 'test_app',
        pages: [
          {
            name: 'test_page',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Coffee Shop',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @context is 'https://schema.org', @type is 'LocalBusiness', and name is provided
      await page.goto('/')

      // THEN: it should validate minimal LocalBusiness structured data
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"LocalBusiness"')
      expect(scriptContent).toContain('Coffee Shop')
    }
  )

  test(
    'APP-PAGES-LOCALBUSINESS-002: should provide business identity',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with name and description
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Best Coffee Shop',
                  description: 'Artisanal coffee and pastries',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: name and description describe the business
      await page.goto('/')

      // THEN: it should provide business identity
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('Best Coffee Shop')
      expect(scriptContent).toContain('Artisanal coffee and pastries')
    }
  )

  test(
    'APP-PAGES-LOCALBUSINESS-003: should provide business branding',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with url and logo
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Coffee Shop',
                  url: 'https://example.com',
                  logo: 'https://example.com/logo.png',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: url is website and logo is business logo URL
      await page.goto('/')

      // THEN: it should provide business branding
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('https://example.com')
      expect(scriptContent).toContain('logo.png')
    }
  )

  test(
    'APP-PAGES-LOCALBUSINESS-004: should support single or multiple business images',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with image
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Shop',
                  image: ['https://example.com/interior.jpg', 'https://example.com/exterior.jpg'],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: image is string URL or array of URLs
      await page.goto('/')

      // THEN: it should support single or multiple business images
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('interior.jpg')
      expect(scriptContent).toContain('exterior.jpg')
    }
  )

  test.fixme(
    'APP-PAGES-LOCALBUSINESS-005: should provide business contact information',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with contact info
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Shop',
                  email: 'contact@example.com',
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

      // THEN: it should provide business contact information
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('contact@example.com')
      expect(scriptContent).toContain('+1-555-123-4567')
    }
  )

  test(
    'APP-PAGES-LOCALBUSINESS-006: should indicate business price level',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with priceRange
      const priceRanges = ['$', '$$', '$$$', '$$$$']
      for (const priceRange of priceRanges) {
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
                  localBusiness: {
                    '@context': 'https://schema.org',
                    '@type': 'LocalBusiness',
                    name: 'Restaurant',
                    priceRange,
                  },
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain(priceRange)
      }
    }
  )

  test.fixme(
    'APP-PAGES-LOCALBUSINESS-007: should include physical address for maps',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with address
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Shop',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '123 Main St',
                    addressLocality: 'City',
                    addressCountry: 'US',
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: priceRange is '$', '$$', '$$$', or '$$$$'
      await page.goto('/')

      // THEN: it should indicate business price level
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('PostalAddress')
      expect(scriptContent).toContain('123 Main St')
    }
  )

  test.fixme(
    'APP-PAGES-LOCALBUSINESS-008: should provide precise map location',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with geo coordinates
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Shop',
                  geo: { '@type': 'GeoCoordinates', latitude: '48.5734', longitude: '7.7521' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: address references postal-address.schema.json
      await page.goto('/')

      // THEN: it should include physical address for maps
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('GeoCoordinates')
      expect(scriptContent).toContain('48.5734')
      expect(scriptContent).toContain('7.7521')
    }
  )

  test.fixme(
    'APP-PAGES-LOCALBUSINESS-009: should link business to social profiles',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with social profiles
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Shop',
                  sameAs: [
                    'https://facebook.com/shop',
                    'https://twitter.com/shop',
                    'https://instagram.com/shop',
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: geo is object with @type 'GeoCoordinates', latitude, and longitude
      await page.goto('/')

      // THEN: it should provide precise map location
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('facebook.com/shop')
      expect(scriptContent).toContain('twitter.com/shop')
    }
  )

  test.fixme(
    'APP-PAGES-LOCALBUSINESS-010: should provide business hours for each day',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with opening hours
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Shop',
                  openingHoursSpecification: [
                    {
                      '@type': 'OpeningHoursSpecification',
                      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                      opens: '09:00',
                      closes: '18:00',
                    },
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

      // THEN: it should link business to social profiles
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('OpeningHoursSpecification')
      expect(scriptContent).toContain('09:00')
      expect(scriptContent).toContain('18:00')
    }
  )

  test.fixme(
    'APP-PAGES-LOCALBUSINESS-011: should specify which days hours apply to',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with dayOfWeek enum
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Shop',
                  openingHoursSpecification: [
                    {
                      '@type': 'OpeningHoursSpecification',
                      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday'],
                      opens: '09:00',
                      closes: '17:00',
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: openingHoursSpecification is array with @type, dayOfWeek, opens, closes
      await page.goto('/')

      // THEN: it should provide business hours for each day
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('Monday')
      expect(scriptContent).toContain('Tuesday')
      expect(scriptContent).toContain('Wednesday')
    }
  )

  test.fixme(
    'APP-PAGES-LOCALBUSINESS-012: should specify daily operating hours',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness with opens/closes times
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Shop',
                  openingHoursSpecification: [
                    {
                      '@type': 'OpeningHoursSpecification',
                      dayOfWeek: ['Monday'],
                      opens: '09:00',
                      closes: '18:00',
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: dayOfWeek is array of 'Monday', 'Tuesday', etc.
      await page.goto('/')

      // THEN: it should specify which days hours apply to
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toMatch(/"opens":\s*"09:00"/)
      expect(scriptContent).toMatch(/"closes":\s*"18:00"/)
    }
  )

  test.fixme(
    'APP-PAGES-LOCALBUSINESS-013: should enable Google Business Profile rich results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness for local SEO
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Complete Business',
                  address: { '@type': 'PostalAddress', streetAddress: '123 Main St' },
                  geo: { '@type': 'GeoCoordinates', latitude: '48.5734', longitude: '7.7521' },
                  openingHoursSpecification: [
                    {
                      '@type': 'OpeningHoursSpecification',
                      dayOfWeek: ['Monday'],
                      opens: '09:00',
                      closes: '17:00',
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: opens is '09:00' and closes is '18:00' (HH:MM format)
      await page.goto('/')

      // THEN: it should specify daily operating hours
      await expect(page.locator('script[type="application/ld+json"]')).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-LOCALBUSINESS-014: should enable map pin and directions in search results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: LocalBusiness for map display
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Mappable Business',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '456 Oak Ave',
                    addressLocality: 'Springfield',
                  },
                  geo: { '@type': 'GeoCoordinates', latitude: '39.7817', longitude: '-89.6501' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: complete business data with address, geo, and hours is provided
      await page.goto('/')

      // THEN: it should enable Google Business Profile rich results
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('GeoCoordinates')
      expect(scriptContent).toContain('PostalAddress')
    }
  )

  test.fixme(
    'APP-PAGES-META-STRUCTURED-DATA-LOCAL-BUSINESS-REGRESSION-001: user can complete full Local Business workflow',
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
                localBusiness: {
                  '@context': 'https://schema.org',
                  '@type': 'LocalBusiness',
                  name: 'Complete Coffee Shop',
                  description: 'Best coffee in town',
                  url: 'https://example.com',
                  telephone: '+1-555-123-4567',
                  priceRange: '$$',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '123 Main St',
                    addressLocality: 'Strasbourg',
                    postalCode: '67000',
                    addressCountry: 'FR',
                  },
                  geo: { '@type': 'GeoCoordinates', latitude: '48.5734', longitude: '7.7521' },
                  openingHoursSpecification: [
                    {
                      '@type': 'OpeningHoursSpecification',
                      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                      opens: '07:00',
                      closes: '19:00',
                    },
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: address and geo coordinates are provided
      await page.goto('/')

      // THEN: it should enable map pin and directions in search results
      // Enhanced JSON-LD validation
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()

      // Validate JSON-LD is valid JSON
      const jsonLd = JSON.parse(scriptContent!)

      // Validate JSON-LD structure
      expect(jsonLd).toHaveProperty('@context', 'https://schema.org')
      expect(jsonLd).toHaveProperty('@type', 'LocalBusiness')
      expect(jsonLd).toHaveProperty('name', 'Complete Coffee Shop')
      expect(jsonLd).toHaveProperty('description', 'Best coffee in town')
      expect(jsonLd).toHaveProperty('url', 'https://example.com')
      expect(jsonLd).toHaveProperty('telephone', '+1-555-123-4567')
      expect(jsonLd).toHaveProperty('priceRange', '$$')

      // Validate address structure
      expect(jsonLd.address).toMatchObject({
        '@type': 'PostalAddress',
        streetAddress: '123 Main St',
        addressLocality: 'Strasbourg',
        postalCode: '67000',
        addressCountry: 'FR',
      })

      // Validate geo coordinates
      expect(jsonLd.geo).toMatchObject({
        '@type': 'GeoCoordinates',
        latitude: '48.5734',
        longitude: '7.7521',
      })

      // Validate opening hours
      expect(Array.isArray(jsonLd.openingHoursSpecification)).toBe(true)
      expect(jsonLd.openingHoursSpecification[0]).toMatchObject({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '07:00',
        closes: '19:00',
      })

      // Backwards compatibility: string containment checks
      expect(scriptContent).toContain('"@type":"LocalBusiness"')
      expect(scriptContent).toContain('Complete Coffee Shop')
      expect(scriptContent).toContain('Strasbourg')
    }
  )
})
