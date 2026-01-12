/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Product Schema
 *
 * Source: src/domain/models/app/page/meta.ts
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Product Schema', () => {
  test(
    'APP-PAGES-PRODUCT-001: should validate minimal Product structured data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with required properties
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Amazing Widget',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @context is 'https://schema.org', @type is 'Product', and name is provided
      await page.goto('/')

      // THEN: it should validate minimal Product structured data
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Product"')
      expect(scriptContent).toContain('Amazing Widget')
    }
  )

  test(
    'APP-PAGES-PRODUCT-002: should provide product identity',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with name and description
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Premium Headphones',
                  description: 'High-quality wireless headphones with noise cancellation',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: name and description describe the product
      await page.goto('/')

      // THEN: it should provide product identity
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('Premium Headphones')
      expect(scriptContent).toContain('noise cancellation')
    }
  )

  test(
    'APP-PAGES-PRODUCT-003: should support single or multiple product images',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with image
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Widget',
                  image: [
                    'https://example.com/widget-front.jpg',
                    'https://example.com/widget-back.jpg',
                    'https://example.com/widget-side.jpg',
                  ],
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: image is string URL or array of URLs
      await page.goto('/')

      // THEN: it should support single or multiple product images
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('widget-front.jpg')
      expect(scriptContent).toContain('widget-back.jpg')
      expect(scriptContent).toContain('widget-side.jpg')
    }
  )

  test(
    'APP-PAGES-PRODUCT-004: should identify product manufacturer',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with brand
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Widget',
                  brand: { '@type': 'Brand', name: 'TechBrand' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: brand is object with @type 'Brand' and name
      await page.goto('/')

      // THEN: it should identify product manufacturer
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Brand"')
      expect(scriptContent).toContain('TechBrand')
    }
  )

  test(
    'APP-PAGES-PRODUCT-005: should provide stock keeping unit',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with sku
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Widget',
                  sku: 'WDG-12345-BLU',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: sku is unique product identifier
      await page.goto('/')

      // THEN: it should provide stock keeping unit
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('WDG-12345-BLU')
    }
  )

  test(
    'APP-PAGES-PRODUCT-006: should provide standardized product identifier',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with gtin
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Widget',
                  gtin: '0123456789012',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: gtin is global trade item number (UPC, EAN, ISBN)
      await page.goto('/')

      // THEN: it should provide standardized product identifier
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('0123456789012')
    }
  )

  test(
    'APP-PAGES-PRODUCT-007: should provide pricing information',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with offers
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Widget',
                  offers: { '@type': 'Offer', price: '149.99', priceCurrency: 'USD' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: offers is object with @type 'Offer', price, priceCurrency
      await page.goto('/')

      // THEN: it should provide pricing information
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"Offer"')
      expect(scriptContent).toContain('149.99')
    }
  )

  test(
    'APP-PAGES-PRODUCT-008: should specify product price with currency',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with price and priceCurrency
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Widget',
                  offers: { '@type': 'Offer', price: '29.99', priceCurrency: 'USD' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: price is '29.99' and priceCurrency is 'USD' (ISO 4217)
      await page.goto('/')

      // THEN: it should specify product price with currency
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('29.99')
      expect(scriptContent).toContain('USD')
    }
  )

  test(
    'APP-PAGES-PRODUCT-009: should show product availability in search results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with availability
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Widget',
                  offers: {
                    '@type': 'Offer',
                    price: '99',
                    priceCurrency: 'USD',
                    availability: 'https://schema.org/InStock',
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: offers.availability indicates stock status
      await page.goto('/')

      // THEN: it should show product availability in search results
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('availability')
      expect(scriptContent).toContain('InStock')
    }
  )

  test(
    'APP-PAGES-PRODUCT-010: should display star ratings in search results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with aggregateRating
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Widget',
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: 4.5,
                    reviewCount: 127,
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: aggregateRating has @type 'AggregateRating', ratingValue, reviewCount
      await page.goto('/')

      // THEN: it should display star ratings in search results
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"AggregateRating"')
      expect(scriptContent).toContain('4.5')
      expect(scriptContent).toContain('127')
    }
  )

  test(
    'APP-PAGES-PRODUCT-011: should enable Google Shopping rich results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product for e-commerce SEO
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Complete Product',
                  description: 'Full product details',
                  image: 'https://example.com/product.jpg',
                  brand: { '@type': 'Brand', name: 'BrandName' },
                  offers: {
                    '@type': 'Offer',
                    price: '199.99',
                    priceCurrency: 'USD',
                    availability: 'https://schema.org/InStock',
                  },
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: 4.8,
                    reviewCount: 250,
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: complete product data with price, availability, and ratings is provided
      await page.goto('/')

      // THEN: it should enable Google Shopping rich results
      await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-PRODUCT-012: should display price, availability, and ratings in SERPs',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product for rich snippets
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
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'SERP Optimized Product',
                  offers: {
                    '@type': 'Offer',
                    price: '79.99',
                    priceCurrency: 'EUR',
                    availability: 'https://schema.org/InStock',
                    url: 'https://example.com/buy',
                  },
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: 4.3,
                    reviewCount: 89,
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: Product structured data is included in page metadata
      await page.goto('/')

      // THEN: it should display price, availability, and ratings in SERPs
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('Product')
      expect(scriptContent).toContain('79.99')
      expect(scriptContent).toContain('4.3')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 12 @spec tests - covers: minimal Product, product identity, images,
  // brand, SKU, GTIN, offers, price with currency, availability, star ratings,
  // Google Shopping rich results, SERP display
  //
  // OPTIMIZATION: Consolidated from 12 startServerWithSchema calls to 1
  // All Product properties are ADDITIVE (non-conflicting)
  // Comprehensive schema covers: name, description, image, brand, sku, gtin,
  // offers (Offer with price, priceCurrency, availability, url), aggregateRating
  // ============================================================================

  test(
    'APP-PAGES-PRODUCT-REGRESSION: user can complete full Product workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // Setup: ONE comprehensive Product configuration covering all test scenarios
      await test.step('Setup: Start server with comprehensive Product configuration', async () => {
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
                  product: {
                    '@context': 'https://schema.org',
                    '@type': 'Product',
                    // Steps 001-002: name and description for product identity
                    name: 'Premium Headphones',
                    description: 'High-quality wireless headphones with noise cancellation',
                    // Step 003: image array for multiple product images
                    image: [
                      'https://example.com/widget-front.jpg',
                      'https://example.com/widget-back.jpg',
                      'https://example.com/widget-side.jpg',
                    ],
                    // Step 004: brand for manufacturer
                    brand: { '@type': 'Brand', name: 'TechBrand' },
                    // Step 005: sku for stock keeping unit
                    sku: 'WDG-12345-BLU',
                    // Step 006: gtin for standardized product identifier
                    gtin: '0123456789012',
                    // Steps 007-009, 011-012: offers with price, currency, availability
                    offers: {
                      '@type': 'Offer',
                      price: '149.99',
                      priceCurrency: 'USD',
                      availability: 'https://schema.org/InStock',
                      url: 'https://example.com/buy',
                    },
                    // Steps 010-012: aggregateRating for star ratings
                    aggregateRating: {
                      '@type': 'AggregateRating',
                      ratingValue: 4.5,
                      reviewCount: 127,
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

      // All subsequent steps are assertions-only (no server restart needed)

      await test.step('APP-PAGES-PRODUCT-001: Validate minimal Product structured data', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('"@type":"Product"')
        expect(scriptContent).toContain('Premium Headphones')
      })

      await test.step('APP-PAGES-PRODUCT-002: Provide product identity', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('Premium Headphones')
        expect(scriptContent).toContain('noise cancellation')
      })

      await test.step('APP-PAGES-PRODUCT-003: Support single or multiple product images', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('widget-front.jpg')
        expect(scriptContent).toContain('widget-back.jpg')
        expect(scriptContent).toContain('widget-side.jpg')
      })

      await test.step('APP-PAGES-PRODUCT-004: Identify product manufacturer', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('"@type":"Brand"')
        expect(scriptContent).toContain('TechBrand')
      })

      await test.step('APP-PAGES-PRODUCT-005: Provide stock keeping unit', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('WDG-12345-BLU')
      })

      await test.step('APP-PAGES-PRODUCT-006: Provide standardized product identifier', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('0123456789012')
      })

      await test.step('APP-PAGES-PRODUCT-007: Provide pricing information', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('"@type":"Offer"')
        expect(scriptContent).toContain('149.99')
      })

      await test.step('APP-PAGES-PRODUCT-008: Specify product price with currency', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('149.99')
        expect(scriptContent).toContain('USD')
      })

      await test.step('APP-PAGES-PRODUCT-009: Show product availability in search results', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('availability')
        expect(scriptContent).toContain('InStock')
      })

      await test.step('APP-PAGES-PRODUCT-010: Display star ratings in search results', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('"@type":"AggregateRating"')
        expect(scriptContent).toContain('4.5')
        expect(scriptContent).toContain('127')
      })

      await test.step('APP-PAGES-PRODUCT-011: Enable Google Shopping rich results', async () => {
        await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
      })

      await test.step('APP-PAGES-PRODUCT-012: Display price, availability, and ratings in SERPs', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('Product')
        expect(scriptContent).toContain('149.99')
        expect(scriptContent).toContain('4.5')
      })
    }
  )
})
