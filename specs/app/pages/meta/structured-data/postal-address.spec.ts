/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Postal Address
 *
 * Source: src/domain/models/app/page/meta.ts
 * Spec Count: 10
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (10 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Postal Address', () => {
  test(
    'APP-PAGES-POSTALADDRESS-001: should validate minimal PostalAddress structured data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: PostalAddress with required @type
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
                  address: { '@type': 'PostalAddress' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @type is 'PostalAddress' (const)
      await page.goto('/')

      // THEN: it should validate minimal PostalAddress structured data
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"PostalAddress"')
    }
  )

  test(
    'APP-PAGES-POSTALADDRESS-002: should provide street address',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: PostalAddress with streetAddress
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
                  address: { '@type': 'PostalAddress', streetAddress: '123 Main St' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: streetAddress is '123 Main St'
      await page.goto('/')

      // THEN: it should provide street address
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('123 Main St')
    }
  )

  test(
    'APP-PAGES-POSTALADDRESS-003: should provide city or locality name',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: PostalAddress with addressLocality
      const localities = ['Strasbourg', 'Paris', 'New York', 'Tokyo']
      for (const locality of localities) {
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
                    address: { '@type': 'PostalAddress', addressLocality: locality },
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
        expect(scriptContent).toContain(locality)
      }
    }
  )

  test(
    'APP-PAGES-POSTALADDRESS-004: should provide state or region name',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: PostalAddress with addressRegion
      const regions = ['Grand Est', 'California', 'New York', 'Tokyo']
      for (const region of regions) {
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
                    address: { '@type': 'PostalAddress', addressRegion: region },
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
        expect(scriptContent).toContain(region)
      }
    }
  )

  test(
    'APP-PAGES-POSTALADDRESS-005: should provide postal or ZIP code',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: PostalAddress with postalCode
      const postalCodes = ['67000', '94105', '10001', '75001']
      for (const postalCode of postalCodes) {
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
                    address: { '@type': 'PostalAddress', postalCode },
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
        expect(scriptContent).toContain(postalCode)
      }
    }
  )

  test(
    'APP-PAGES-POSTALADDRESS-006: should provide country code',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: PostalAddress with addressCountry
      const countryCodes = ['FR', 'US', 'GB', 'DE']
      for (const country of countryCodes) {
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
                    address: { '@type': 'PostalAddress', addressCountry: country },
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
        expect(scriptContent).toContain(country)
      }
    }
  )

  test(
    'APP-PAGES-POSTALADDRESS-007: should provide full mailing address',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: PostalAddress with complete address
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
                    streetAddress: '123 Main St',
                    addressLocality: 'Strasbourg',
                    addressRegion: 'Grand Est',
                    postalCode: '67000',
                    addressCountry: 'FR',
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: addressLocality is 'Strasbourg' or 'Paris'
      await page.goto('/')

      // THEN: it should provide city or locality name
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('123 Main St')
      expect(scriptContent).toContain('Strasbourg')
      expect(scriptContent).toContain('Grand Est')
      expect(scriptContent).toContain('67000')
      expect(scriptContent).toContain('FR')
    }
  )

  test(
    "APP-PAGES-POSTALADDRESS-008: should provide organization's physical address",
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Organization with PostalAddress
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
                  name: 'Tech Corp',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '456 Innovation Dr',
                    addressLocality: 'San Francisco',
                    addressCountry: 'US',
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: addressRegion is 'Grand Est' or 'California'
      await page.goto('/')

      // THEN: it should provide state or region name
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('456 Innovation Dr')
      expect(scriptContent).toContain('San Francisco')
    }
  )

  test(
    'APP-PAGES-POSTALADDRESS-009: should enable local business map display in search results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: PostalAddress in LocalBusiness
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
                  name: 'Local Shop',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '789 Commerce St',
                    addressLocality: 'Chicago',
                    addressRegion: 'IL',
                    postalCode: '60601',
                    addressCountry: 'US',
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: postalCode is '67000' or '94105'
      await page.goto('/')

      // THEN: it should provide postal or ZIP code
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('789 Commerce St')
      expect(scriptContent).toContain('Chicago')
    }
  )

  test(
    'APP-PAGES-POSTALADDRESS-010: should improve local search ranking and map visibility',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: PostalAddress for local SEO
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
                  name: 'SEO Optimized Business',
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: '321 Market St',
                    addressLocality: 'Boston',
                    addressRegion: 'MA',
                    postalCode: '02101',
                    addressCountry: 'US',
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: addressCountry is 'FR', 'US', 'GB', or 'DE' (ISO 3166-1 alpha-2)
      await page.goto('/')

      // THEN: it should provide country code
      await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 10 @spec tests - covers: minimal PostalAddress, street address,
  // city/locality, state/region, postal code, country code, full mailing address,
  // organization address, local business map display, local search ranking
  // ============================================================================

  test(
    'APP-PAGES-POSTALADDRESS-REGRESSION: user can complete full Postal Address workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await test.step('APP-PAGES-POSTALADDRESS-001: Validate minimal PostalAddress structured data', async () => {
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
                    address: { '@type': 'PostalAddress' },
                  },
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('"@type":"PostalAddress"')
      })

      await test.step('APP-PAGES-POSTALADDRESS-002: Provide street address', async () => {
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
                    address: { '@type': 'PostalAddress', streetAddress: '123 Main St' },
                  },
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('123 Main St')
      })

      await test.step('APP-PAGES-POSTALADDRESS-003: Provide city or locality name', async () => {
        const localities = ['Strasbourg', 'Paris', 'New York', 'Tokyo']
        for (const locality of localities) {
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
                      address: { '@type': 'PostalAddress', addressLocality: locality },
                    },
                  },
                },
                sections: [],
              },
            ],
          })
          await page.goto('/')
          const scriptContent = await page
            .locator('script[type="application/ld+json"]')
            .textContent()
          expect(scriptContent).toContain(locality)
        }
      })

      await test.step('APP-PAGES-POSTALADDRESS-004: Provide state or region name', async () => {
        const regions = ['Grand Est', 'California', 'New York', 'Tokyo']
        for (const region of regions) {
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
                      address: { '@type': 'PostalAddress', addressRegion: region },
                    },
                  },
                },
                sections: [],
              },
            ],
          })
          await page.goto('/')
          const scriptContent = await page
            .locator('script[type="application/ld+json"]')
            .textContent()
          expect(scriptContent).toContain(region)
        }
      })

      await test.step('APP-PAGES-POSTALADDRESS-005: Provide postal or ZIP code', async () => {
        const postalCodes = ['67000', '94105', '10001', '75001']
        for (const postalCode of postalCodes) {
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
                      address: { '@type': 'PostalAddress', postalCode },
                    },
                  },
                },
                sections: [],
              },
            ],
          })
          await page.goto('/')
          const scriptContent = await page
            .locator('script[type="application/ld+json"]')
            .textContent()
          expect(scriptContent).toContain(postalCode)
        }
      })

      await test.step('APP-PAGES-POSTALADDRESS-006: Provide country code', async () => {
        const countryCodes = ['FR', 'US', 'GB', 'DE']
        for (const country of countryCodes) {
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
                      address: { '@type': 'PostalAddress', addressCountry: country },
                    },
                  },
                },
                sections: [],
              },
            ],
          })
          await page.goto('/')
          const scriptContent = await page
            .locator('script[type="application/ld+json"]')
            .textContent()
          expect(scriptContent).toContain(country)
        }
      })

      await test.step('APP-PAGES-POSTALADDRESS-007: Provide full mailing address', async () => {
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
                      streetAddress: '123 Main St',
                      addressLocality: 'Strasbourg',
                      addressRegion: 'Grand Est',
                      postalCode: '67000',
                      addressCountry: 'FR',
                    },
                  },
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('123 Main St')
        expect(scriptContent).toContain('Strasbourg')
        expect(scriptContent).toContain('Grand Est')
        expect(scriptContent).toContain('67000')
        expect(scriptContent).toContain('FR')
      })

      await test.step("APP-PAGES-POSTALADDRESS-008: Provide organization's physical address", async () => {
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
                    name: 'Tech Corp',
                    address: {
                      '@type': 'PostalAddress',
                      streetAddress: '456 Innovation Dr',
                      addressLocality: 'San Francisco',
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
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('456 Innovation Dr')
        expect(scriptContent).toContain('San Francisco')
      })

      await test.step('APP-PAGES-POSTALADDRESS-009: Enable local business map display in search results', async () => {
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
                    name: 'Local Shop',
                    address: {
                      '@type': 'PostalAddress',
                      streetAddress: '789 Commerce St',
                      addressLocality: 'Chicago',
                      addressRegion: 'IL',
                      postalCode: '60601',
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
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('789 Commerce St')
        expect(scriptContent).toContain('Chicago')
      })

      await test.step('APP-PAGES-POSTALADDRESS-010: Improve local search ranking and map visibility', async () => {
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
                    name: 'SEO Optimized Business',
                    address: {
                      '@type': 'PostalAddress',
                      streetAddress: '321 Market St',
                      addressLocality: 'Boston',
                      addressRegion: 'MA',
                      postalCode: '02101',
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
        await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
      })
    }
  )
})
