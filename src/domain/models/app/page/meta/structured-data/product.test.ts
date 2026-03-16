/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { ProductSchema } from './product'

describe('ProductSchema', () => {
  test('should accept minimal product with required properties', () => {
    // GIVEN: Minimal product with only required fields
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'iPhone 15 Pro',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ProductSchema)(product)

    // THEN: Minimal product should be accepted
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('Product')
    expect(result.name).toBe('iPhone 15 Pro')
  })

  test('should accept product with description', () => {
    // GIVEN: Product with description
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'iPhone 15 Pro',
      description: 'Advanced camera system, A17 Pro chip, titanium design',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ProductSchema)(product)

    // THEN: Description should be accepted
    expect(result.description).toContain('camera')
  })

  test('should accept product with single image', () => {
    // GIVEN: Product with single image URL
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'iPhone 15 Pro',
      image: 'https://example.com/iphone-front.jpg',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ProductSchema)(product)

    // THEN: Single image should be accepted
    expect(result.image).toBe('https://example.com/iphone-front.jpg')
  })

  test('should accept product with multiple images', () => {
    // GIVEN: Product with multiple images
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'iPhone 15 Pro',
      image: [
        'https://example.com/iphone-front.jpg',
        'https://example.com/iphone-back.jpg',
        'https://example.com/iphone-side.jpg',
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ProductSchema)(product)

    // THEN: Multiple images should be accepted
    expect(Array.isArray(result.image)).toBe(true)
    if (Array.isArray(result.image)) {
      expect(result.image).toHaveLength(3)
    }
  })

  test('should accept product with brand', () => {
    // GIVEN: Product with brand
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'iPhone 15 Pro',
      brand: {
        '@type': 'Brand' as const,
        name: 'Apple',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ProductSchema)(product)

    // THEN: Brand should be accepted
    expect(result.brand?.['@type']).toBe('Brand')
    expect(result.brand?.name).toBe('Apple')
  })

  test('should accept product with SKU and GTIN', () => {
    // GIVEN: Product with SKU and GTIN identifiers
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'iPhone 15 Pro',
      sku: 'IPHONE15PRO-256-TIT',
      gtin: '0194253779999',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ProductSchema)(product)

    // THEN: SKU and GTIN should be accepted
    expect(result.sku).toBe('IPHONE15PRO-256-TIT')
    expect(result.gtin).toBe('0194253779999')
  })

  test('should accept valid ISO 4217 currency codes', () => {
    // GIVEN: Various valid currency codes
    const currencyCodes = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD']

    currencyCodes.forEach((currency) => {
      const product = {
        '@context': 'https://schema.org' as const,
        '@type': 'Product' as const,
        name: 'Test Product',
        offers: {
          '@type': 'Offer' as const,
          price: '99.99',
          priceCurrency: currency,
        },
      }

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(ProductSchema)(product)

      // THEN: Currency code should be accepted
      expect(result.offers?.priceCurrency).toBe(currency)
    })
  })

  test('should reject invalid currency code', () => {
    // GIVEN: Invalid currency code (lowercase)
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'Test Product',
      offers: {
        '@type': 'Offer' as const,
        price: '99.99',
        priceCurrency: 'usd',
      },
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (must be uppercase)
    expect(() => Schema.decodeUnknownSync(ProductSchema)(product)).toThrow()
  })

  test('should accept price as string', () => {
    // GIVEN: Product with string price
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'iPhone 15 Pro',
      offers: {
        '@type': 'Offer' as const,
        price: '999.00',
        priceCurrency: 'USD',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ProductSchema)(product)

    // THEN: String price should be accepted
    expect(result.offers?.price).toBe('999.00')
  })

  test('should accept price as number', () => {
    // GIVEN: Product with number price
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'iPhone 15 Pro',
      offers: {
        '@type': 'Offer' as const,
        price: 999.0,
        priceCurrency: 'USD',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ProductSchema)(product)

    // THEN: Number price should be accepted
    expect(result.offers?.price).toBe(999.0)
  })

  test('should accept product with availability status', () => {
    // GIVEN: Product with InStock availability
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'iPhone 15 Pro',
      offers: {
        '@type': 'Offer' as const,
        price: '999.00',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: 'https://example.com/products/iphone-15-pro',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ProductSchema)(product)

    // THEN: Availability and URL should be accepted
    expect(result.offers?.availability).toBe('https://schema.org/InStock')
    expect(result.offers?.url).toBe('https://example.com/products/iphone-15-pro')
  })

  test('should accept product with aggregate rating', () => {
    // GIVEN: Product with star rating
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'iPhone 15 Pro',
      aggregateRating: {
        '@type': 'AggregateRating' as const,
        ratingValue: 4.8,
        reviewCount: 2547,
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ProductSchema)(product)

    // THEN: Aggregate rating should be accepted
    expect(result.aggregateRating?.['@type']).toBe('AggregateRating')
    expect(result.aggregateRating?.ratingValue).toBe(4.8)
    expect(result.aggregateRating?.reviewCount).toBe(2547)
  })

  test('should accept complete product configuration', () => {
    // GIVEN: Complete product with all properties
    const product = {
      '@context': 'https://schema.org' as const,
      '@type': 'Product' as const,
      name: 'iPhone 15 Pro',
      description: 'Advanced camera system, A17 Pro chip, titanium design',
      image: ['https://example.com/iphone-front.jpg', 'https://example.com/iphone-back.jpg'],
      brand: {
        '@type': 'Brand' as const,
        name: 'Apple',
      },
      sku: 'IPHONE15PRO-256-TIT',
      gtin: '0194253779999',
      offers: {
        '@type': 'Offer' as const,
        price: '999.00',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: 'https://example.com/products/iphone-15-pro',
      },
      aggregateRating: {
        '@type': 'AggregateRating' as const,
        ratingValue: 4.8,
        reviewCount: 2547,
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ProductSchema)(product)

    // THEN: Complete configuration should be accepted
    expect(result.name).toBe('iPhone 15 Pro')
    expect(result.brand?.name).toBe('Apple')
    expect(result.offers?.price).toBe('999.00')
    expect(result.aggregateRating?.ratingValue).toBe(4.8)
  })
})
