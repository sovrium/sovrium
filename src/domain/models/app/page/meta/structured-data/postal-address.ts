/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { schemaType } from './common-fields'

/**
 * ISO 3166-1 alpha-2 country code
 *
 * Two-letter country code format (uppercase).
 * - Pattern: ^[A-Z]{2}$ (exactly 2 uppercase letters)
 * - Examples: US (United States), FR (France), GB (United Kingdom), DE (Germany), JP (Japan)
 * - Standard: ISO 3166-1 alpha-2 (international standard for country codes)
 */
export const CountryCodeSchema = Schema.String.pipe(
  Schema.pattern(/^[A-Z]{2}$/, {
    message: () =>
      'Country code must be ISO 3166-1 alpha-2 format (2 uppercase letters, e.g., US, FR, GB, DE, JP)',
  })
).annotations({
  description: 'ISO 3166-1 alpha-2 country code',
  examples: ['US', 'FR', 'GB', 'DE'],
})

/**
 * Schema.org PostalAddress structured data
 *
 * Represents a physical mailing address for organizations, businesses, and persons.
 * Used in LocalBusiness, Organization, and Person schemas to provide location information
 * for local SEO and map display in search results.
 *
 * Required properties:
 * - @type: Must be "PostalAddress" (Schema.org type identifier)
 *
 * Optional properties:
 * - streetAddress: Street address (e.g., "123 Main St", "45 Rue de la Paix")
 * - addressLocality: City or locality name (e.g., "Strasbourg", "Paris", "San Francisco")
 * - addressRegion: State, province, or region (e.g., "Grand Est", "California", "Ontario")
 * - postalCode: Postal or ZIP code (e.g., "67000", "94105", "SW1A 1AA")
 * - addressCountry: ISO 3166-1 alpha-2 country code (e.g., "FR", "US", "GB")
 *
 * Address format examples:
 * - US: "123 Main St, San Francisco, CA 94105, US"
 * - FR: "45 Rue de la Paix, Strasbourg, Grand Est 67000, FR"
 * - GB: "10 Downing St, London, England SW1A 1AA, GB"
 *
 * Use cases:
 * - **LocalBusiness**: Enable map display and directions in search results
 * - **Organization**: Provide company headquarters address for Knowledge Graph
 * - **Person**: Include contact address for notable persons
 * - **EducationEvent**: Specify venue address for event listings
 *
 * SEO impact:
 * - Local search ranking: Complete addresses improve local SEO
 * - Map visibility: Address + geo coordinates enable map pins in search results
 * - Rich snippets: Address shown in business listings and Knowledge Graph panels
 * - Mobile search: "Near me" searches prioritize businesses with addresses
 *
 * @example
 * ```typescript
 * const address = {
 *   "@type": "PostalAddress",
 *   streetAddress: "123 Main St",
 *   addressLocality: "Strasbourg",
 *   addressRegion: "Grand Est",
 *   postalCode: "67000",
 *   addressCountry: "FR"
 * }
 * ```
 *
 * @see specs/app/pages/meta/structured-data/postal-address.schema.json
 */
export const PostalAddressSchema = Schema.Struct({
  '@type': schemaType('PostalAddress'),
  streetAddress: Schema.optional(
    Schema.String.annotations({
      description: 'Street address',
    })
  ),
  addressLocality: Schema.optional(
    Schema.String.annotations({
      description: 'City or locality',
    })
  ),
  addressRegion: Schema.optional(
    Schema.String.annotations({
      description: 'State or region',
    })
  ),
  postalCode: Schema.optional(
    Schema.String.annotations({
      description: 'Postal or ZIP code',
    })
  ),
  addressCountry: Schema.optional(CountryCodeSchema),
}).annotations({
  title: 'Postal Address',
  description: 'Schema.org PostalAddress structured data',
})

export type CountryCode = Schema.Schema.Type<typeof CountryCodeSchema>
export type PostalAddress = Schema.Schema.Type<typeof PostalAddressSchema>
