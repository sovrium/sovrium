/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SchemaOrgContext, schemaType } from './common-fields'

/**
 * Product brand
 *
 * Brand object with @type "Brand" and name.
 * Identifies the product manufacturer or brand.
 */
export const ProductBrandSchema = Schema.Struct({
  '@type': schemaType('Brand'),
  name: Schema.optional(
    Schema.String.annotations({
      description: 'Brand name',
    })
  ),
}).annotations({
  description: 'Product brand',
})

/**
 * ISO 4217 currency code
 *
 * 3-letter currency code (uppercase).
 * - Pattern: ^[A-Z]{3}$ (exactly 3 uppercase letters)
 * - Examples: USD (US Dollar), EUR (Euro), GBP (British Pound), JPY (Japanese Yen)
 */
export const CurrencyCodeSchema = Schema.String.pipe(
  Schema.pattern(/^[A-Z]{3}$/, {
    message: () =>
      'Currency code must be ISO 4217 format (3 uppercase letters, e.g., USD, EUR, GBP, JPY)',
  })
).annotations({
  description: 'ISO 4217 currency code',
  examples: ['USD', 'EUR', 'GBP'],
})

/**
 * Product offer
 *
 * Pricing and availability information for a product.
 * - @type: "Offer"
 * - price: Price as string or number (e.g., "29.99", 29.99)
 * - priceCurrency: ISO 4217 currency code (e.g., "USD", "EUR")
 * - availability: Stock status URL (e.g., "https://schema.org/InStock")
 * - url: URL to purchase page
 */
export const ProductOfferSchema = Schema.Struct({
  '@type': schemaType('Offer'),
  price: Schema.optional(
    Schema.Union(Schema.String, Schema.Number).annotations({
      description: 'Product price',
    })
  ),
  priceCurrency: Schema.optional(CurrencyCodeSchema),
  availability: Schema.optional(
    Schema.String.annotations({
      description: 'Stock availability status',
    })
  ),
  url: Schema.optional(
    Schema.String.annotations({
      description: 'URL to purchase page',
      format: 'uri',
    })
  ),
}).annotations({
  description: 'Product offer',
})

/**
 * Aggregate rating
 *
 * Average rating and review count for a product.
 * - @type: "AggregateRating"
 * - ratingValue: Average rating (e.g., 4.5 out of 5)
 * - reviewCount: Total number of reviews (integer)
 */
export const AggregateRatingSchema = Schema.Struct({
  '@type': schemaType('AggregateRating'),
  ratingValue: Schema.optional(
    Schema.Number.annotations({
      description: 'Average rating value',
    })
  ),
  reviewCount: Schema.optional(
    Schema.Int.annotations({
      description: 'Total number of reviews',
    })
  ),
}).annotations({
  description: 'Aggregate rating',
})

/**
 * Schema.org Product structured data
 *
 * Represents a product for e-commerce rich results in Google Search.
 * Enables product cards with images, prices, availability, and star ratings
 * directly in search results, dramatically increasing click-through rates.
 *
 * Required properties:
 * - @context: "https://schema.org" (Schema.org vocabulary)
 * - @type: "Product" (Schema.org type identifier)
 * - name: Product name (e.g., "iPhone 15 Pro", "Nike Air Max 90")
 *
 * Optional properties:
 * - description: Product description
 * - image: Product image(s) - string or array (photos, angles, colors)
 * - brand: Product brand (Brand object with name)
 * - sku: Stock Keeping Unit (internal product ID)
 * - gtin: Global Trade Item Number (UPC, EAN, ISBN - standardized ID)
 * - offers: Pricing information (Offer object with price, currency, availability, URL)
 * - aggregateRating: Average rating (AggregateRating object with ratingValue, reviewCount)
 *
 * E-commerce SEO impact:
 * - **Product rich results**: Cards with image, price, availability, ratings in search
 * - **Google Shopping**: Eligible for Google Shopping results (with additional requirements)
 * - **Star ratings**: Visual star ratings increase CTR by 20-30%
 * - **Price display**: Price shown directly in search results
 * - **Availability**: "In Stock" / "Out of Stock" status shown in results
 * - **Mobile optimization**: Tap to purchase, quick product comparison
 *
 * @example
 * ```typescript
 * const product = {
 *   "@context": "https://schema.org",
 *   "@type": "Product",
 *   name: "iPhone 15 Pro",
 *   description: "Advanced camera system, A17 Pro chip, titanium design",
 *   image: [
 *     "https://example.com/iphone-front.jpg",
 *     "https://example.com/iphone-back.jpg"
 *   ],
 *   brand: {
 *     "@type": "Brand",
 *     name: "Apple"
 *   },
 *   sku: "IPHONE15PRO-256-TIT",
 *   gtin: "0194253779999",
 *   offers: {
 *     "@type": "Offer",
 *     price: "999.00",
 *     priceCurrency: "USD",
 *     availability: "https://schema.org/InStock",
 *     url: "https://example.com/products/iphone-15-pro"
 *   },
 *   aggregateRating: {
 *     "@type": "AggregateRating",
 *     ratingValue: 4.8,
 *     reviewCount: 2547
 *   }
 * }
 * ```
 *
 * @see specs/app/pages/meta/structured-data/product.schema.json
 */
export const ProductSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('Product'),
  name: Schema.String.annotations({
    description: 'Product name',
  }),
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Product description',
    })
  ),
  image: Schema.optional(
    Schema.Union(
      Schema.String.annotations({
        description: 'Product image URL',
        format: 'uri',
      }),
      Schema.Array(
        Schema.String.annotations({
          description: 'Product image URL',
          format: 'uri',
        })
      )
    ).annotations({
      description: 'Product image(s)',
    })
  ),
  brand: Schema.optional(ProductBrandSchema),
  sku: Schema.optional(
    Schema.String.annotations({
      description: 'Stock Keeping Unit',
    })
  ),
  gtin: Schema.optional(
    Schema.String.annotations({
      description: 'Global Trade Item Number (UPC, EAN, ISBN)',
    })
  ),
  offers: Schema.optional(ProductOfferSchema),
  aggregateRating: Schema.optional(AggregateRatingSchema),
}).annotations({
  title: 'Product Schema',
  description: 'Schema.org Product structured data',
})

export type ProductBrand = Schema.Schema.Type<typeof ProductBrandSchema>
export type CurrencyCode = Schema.Schema.Type<typeof CurrencyCodeSchema>
export type ProductOffer = Schema.Schema.Type<typeof ProductOfferSchema>
export type AggregateRating = Schema.Schema.Type<typeof AggregateRatingSchema>
export type Product = Schema.Schema.Type<typeof ProductSchema>
