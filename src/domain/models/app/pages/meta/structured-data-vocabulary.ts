/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ============================================================================
// Structured Data — Common Fields
// ============================================================================

/**
 * Schema.org @context field
 *
 * Required in all Schema.org structured data to indicate the vocabulary being used.
 */
export const SchemaOrgContext = Schema.Literal('https://schema.org').annotate({
  description: 'Schema.org context',
})

/**
 * Email address field
 */
export const SchemaOrgEmail = Schema.String.annotate({
  description: 'Email address',
  format: 'email',
})

/**
 * Telephone number field
 */
export const SchemaOrgTelephone = Schema.String.annotate({
  description: 'Phone number',
})

/**
 * Array of social media profile URLs
 */
export const SchemaOrgSameAs = Schema.Array(
  Schema.String.annotate({
    description: 'Social media profile URL',
    format: 'uri',
  })
).annotate({
  description: 'Social media profile URLs',
  examples: [
    [
      'https://twitter.com/example',
      'https://linkedin.com/in/example',
      'https://facebook.com/example',
    ],
  ],
})

/**
 * URL field for web resources
 */
export const SchemaOrgUrl = Schema.String.annotate({
  description: 'URL',
  format: 'uri',
})

/**
 * Image URL field
 */
export const SchemaOrgImageUrl = Schema.String.annotate({
  description: 'Image URL',
  format: 'uri',
})

/**
 * Helper: Create optional field
 */
export const optional = <A, I, R>(schema: Schema.Codec<A, I, R>) => Schema.optional(schema)

/**
 * Helper: Create Schema.org @type field
 */
export const schemaType = <T extends string>(type: T) =>
  Schema.Literal(type).annotate({
    description: 'Schema.org type',
  })

/**
 * Helper: Create positive integer field
 */
export const positiveInt = (description: string) =>
  Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))).annotate({
    description,
  })

// ============================================================================
// Structured Data — Postal Address
// ============================================================================

/**
 * ISO 3166-1 alpha-2 country code
 */
export const CountryCodeSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[A-Z]{2}$/, {
      message:
        'Country code must be ISO 3166-1 alpha-2 format (2 uppercase letters, e.g., US, FR, GB, DE, JP)',
    })
  )
).annotate({
  description: 'ISO 3166-1 alpha-2 country code',
  examples: ['US', 'FR', 'GB', 'DE'],
})

/**
 * Schema.org PostalAddress structured data
 */
export const PostalAddressSchema = Schema.Struct({
  '@type': schemaType('PostalAddress'),
  streetAddress: Schema.optional(
    Schema.String.annotate({
      description: 'Street address',
    })
  ),
  addressLocality: Schema.optional(
    Schema.String.annotate({
      description: 'City or locality',
    })
  ),
  addressRegion: Schema.optional(
    Schema.String.annotate({
      description: 'State or region',
    })
  ),
  postalCode: Schema.optional(
    Schema.String.annotate({
      description: 'Postal or ZIP code',
    })
  ),
  addressCountry: Schema.optional(CountryCodeSchema),
}).annotate({
  title: 'Postal Address',
  description: 'Schema.org PostalAddress structured data',
})

/** @public */
export type CountryCode = Schema.Schema.Type<typeof CountryCodeSchema>
/** @public */
export type PostalAddress = Schema.Schema.Type<typeof PostalAddressSchema>
