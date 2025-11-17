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
 * Source: specs/app/pages/meta/structured-data/product.schema.json
 * Spec Count: 12
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (12 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Product Schema', () => {
  test.fixme(
    'APP-PAGES-PRODUCT-001: should validate minimal Product structured data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with required properties
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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

  test.fixme(
    'APP-PAGES-PRODUCT-002: should provide product identity',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with name and description
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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

  test.fixme(
    'APP-PAGES-PRODUCT-003: should support single or multiple product images',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with image
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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

  test.fixme(
    'APP-PAGES-PRODUCT-004: should identify product manufacturer',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with brand
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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

  test.fixme(
    'APP-PAGES-PRODUCT-005: should provide stock keeping unit',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with sku
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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

  test.fixme(
    'APP-PAGES-PRODUCT-006: should provide standardized product identifier',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with gtin
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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

  test.fixme(
    'APP-PAGES-PRODUCT-007: should provide pricing information',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with offers
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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

  test.fixme(
    'APP-PAGES-PRODUCT-008: should specify product price with currency',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with price and priceCurrency
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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

  test.fixme(
    'APP-PAGES-PRODUCT-009: should show product availability in search results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with availability
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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

  test.fixme(
    'APP-PAGES-PRODUCT-010: should display star ratings in search results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product with aggregateRating
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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

  test.fixme(
    'APP-PAGES-PRODUCT-011: should enable Google Shopping rich results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product for e-commerce SEO
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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
      await expect(page.locator('script[type="application/ld+json"]')).toBeVisible()
    }
  )

  test.fixme(
    'APP-PAGES-PRODUCT-012: should display price, availability, and ratings in SERPs',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: Product for rich snippets
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

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

  test(
    'APP-PAGES-META-STRUCTURED-DATA-PRODUCT-REGRESSION-001: user can complete full Product workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'Test',
            name: 'home',

            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                product: {
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name: 'Complete Product Test',
                  description: 'Premium wireless headphones with active noise cancellation',
                  image: [
                    'https://example.com/headphones-1.jpg',
                    'https://example.com/headphones-2.jpg',
                  ],
                  brand: { '@type': 'Brand', name: 'AudioTech' },
                  sku: 'ATP-WH1000-BLK',
                  gtin: '0123456789012',
                  offers: {
                    '@type': 'Offer',
                    price: '299.99',
                    priceCurrency: 'USD',
                    availability: 'https://schema.org/InStock',
                    url: 'https://example.com/buy/headphones',
                  },
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: 4.7,
                    reviewCount: 543,
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
      expect(jsonLd).toHaveProperty('@type', 'Product')
      expect(jsonLd).toHaveProperty('name', 'Complete Product Test')
      expect(jsonLd).toHaveProperty(
        'description',
        'Premium wireless headphones with active noise cancellation'
      )
      expect(jsonLd).toHaveProperty('sku', 'ATP-WH1000-BLK')
      expect(jsonLd).toHaveProperty('gtin', '0123456789012')

      // Validate product images
      expect(Array.isArray(jsonLd.image)).toBe(true)
      expect(jsonLd.image).toHaveLength(2)
      expect(jsonLd.image).toContain('https://example.com/headphones-1.jpg')
      expect(jsonLd.image).toContain('https://example.com/headphones-2.jpg')

      // Validate brand structure
      expect(jsonLd.brand).toMatchObject({
        '@type': 'Brand',
        name: 'AudioTech',
      })

      // Validate offers structure
      expect(jsonLd.offers).toMatchObject({
        '@type': 'Offer',
        price: '299.99',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: 'https://example.com/buy/headphones',
      })

      // Validate aggregate rating structure
      expect(jsonLd.aggregateRating).toMatchObject({
        '@type': 'AggregateRating',
        ratingValue: 4.7,
        reviewCount: 543,
      })

      // Backwards compatibility: string containment checks
      expect(scriptContent).toContain('"@type":"Product"')
      expect(scriptContent).toContain('Complete Product Test')
      expect(scriptContent).toContain('AudioTech')
      expect(scriptContent).toContain('299.99')
      expect(scriptContent).toContain('4.7')
    }
  )
})
