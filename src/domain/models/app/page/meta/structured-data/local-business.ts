/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SchemaOrgContext, schemaType } from './common-fields'
import { PostalAddressSchema } from './postal-address'

/**
 * Day of week for opening hours
 *
 * 7 days of the week (full names, capitalized).
 * Used in openingHoursSpecification to specify which days hours apply to.
 */
export const DayOfWeekSchema = Schema.Literal(
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
).annotations({
  description: 'Day of the week',
})

/**
 * Time in HH:MM format (24-hour)
 *
 * Pattern: ^[0-9]{2}:[0-9]{2}$ (e.g., "09:00", "18:30", "23:59")
 * Examples: "09:00" (9 AM), "13:30" (1:30 PM), "18:00" (6 PM)
 */
export const TimeSchema = Schema.String.pipe(
  Schema.pattern(/^[0-9]{2}:[0-9]{2}$/, {
    message: () => 'Time must be in HH:MM format (24-hour, e.g., 09:00, 18:30, 23:59)',
  })
).annotations({
  description: 'Time in HH:MM format',
  examples: ['09:00', '18:00'],
})

/**
 * Opening hours specification
 *
 * Defines opening hours for specific days of the week.
 * - @type: "OpeningHoursSpecification"
 * - dayOfWeek: Array of days these hours apply to (e.g., ["Monday", "Tuesday", "Wednesday"])
 * - opens: Opening time in HH:MM format (e.g., "09:00")
 * - closes: Closing time in HH:MM format (e.g., "18:00")
 */
export const OpeningHoursSpecificationSchema = Schema.Struct({
  '@type': schemaType('OpeningHoursSpecification'),
  dayOfWeek: Schema.optional(
    Schema.Array(DayOfWeekSchema).annotations({
      description: 'Days these hours apply to',
    })
  ),
  opens: Schema.optional(TimeSchema.annotations({ description: 'Opening time' })),
  closes: Schema.optional(TimeSchema.annotations({ description: 'Closing time' })),
}).annotations({
  description: 'Opening hours specification',
})

/**
 * Geographic coordinates
 *
 * Latitude and longitude for precise map location.
 * - @type: "GeoCoordinates"
 * - latitude: Latitude as string (e.g., "48.5734", "-37.8136")
 * - longitude: Longitude as string (e.g., "7.7521", "144.9631")
 */
export const GeoCoordinatesSchema = Schema.Struct({
  '@type': schemaType('GeoCoordinates'),
  latitude: Schema.optional(
    Schema.String.annotations({
      description: 'Latitude',
    })
  ),
  longitude: Schema.optional(
    Schema.String.annotations({
      description: 'Longitude',
    })
  ),
}).annotations({
  description: 'Geographic coordinates',
})

/**
 * Schema.org LocalBusiness structured data
 *
 * Represents a local business with physical location for local SEO and map display.
 * Enables Google Business Profile rich results with map pins, directions, opening hours,
 * and contact information directly in search results.
 *
 * Required properties:
 * - @context: "https://schema.org" (Schema.org vocabulary)
 * - @type: "LocalBusiness" (Schema.org type identifier)
 * - name: Business name (e.g., "Joe's Pizza", "Acme Hardware Store")
 *
 * Optional properties:
 * - description: Business description
 * - url: Business website URL
 * - logo: Business logo URL
 * - image: Business image(s) - string or array (storefront, products, interior)
 * - email: Contact email address
 * - telephone: Contact phone number
 * - priceRange: Price level indicator (e.g., "$", "$$", "$$$", "$$$$")
 * - address: Physical address (PostalAddress object) - CRITICAL for local SEO
 * - geo: Geographic coordinates (GeoCoordinates object) - enables map pin
 * - sameAs: Array of social media profile URLs
 * - openingHoursSpecification: Array of opening hours for each day/day range
 *
 * Local SEO impact:
 * - **Map display**: Address + geo coordinates enable map pin in search results
 * - **Directions**: "Get directions" button in search results
 * - **Opening hours**: Shows current open/closed status and hours
 * - **Local pack**: Appears in local 3-pack for "near me" searches
 * - **Mobile optimization**: Click-to-call phone number, one-tap directions
 * - **Rich snippets**: Business info shown prominently in search results
 *
 * @example
 * ```typescript
 * const localBusiness = {
 *   "@context": "https://schema.org",
 *   "@type": "LocalBusiness",
 *   name: "Joe's Pizza",
 *   description: "Authentic Italian pizza restaurant",
 *   url: "https://joespizza.com",
 *   telephone: "+1-555-123-4567",
 *   priceRange: "$$",
 *   address: {
 *     "@type": "PostalAddress",
 *     streetAddress: "123 Main St",
 *     addressLocality: "Strasbourg",
 *     addressRegion: "Grand Est",
 *     postalCode: "67000",
 *     addressCountry: "FR"
 *   },
 *   geo: {
 *     "@type": "GeoCoordinates",
 *     latitude: "48.5734",
 *     longitude: "7.7521"
 *   },
 *   openingHoursSpecification: [
 *     {
 *       "@type": "OpeningHoursSpecification",
 *       dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
 *       opens: "11:00",
 *       closes: "22:00"
 *     },
 *     {
 *       "@type": "OpeningHoursSpecification",
 *       dayOfWeek: ["Saturday", "Sunday"],
 *       opens: "12:00",
 *       closes: "23:00"
 *     }
 *   ]
 * }
 * ```
 *
 * @see specs/app/pages/meta/structured-data/local-business.schema.json
 */
export const LocalBusinessSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('LocalBusiness'),
  name: Schema.String.annotations({
    description: 'Business name',
  }),
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Business description',
    })
  ),
  url: Schema.optional(
    Schema.String.annotations({
      description: 'Business website URL',
      format: 'uri',
    })
  ),
  logo: Schema.optional(
    Schema.String.annotations({
      description: 'Business logo URL',
      format: 'uri',
    })
  ),
  image: Schema.optional(
    Schema.Union(
      Schema.String.annotations({
        description: 'Business image URL',
        format: 'uri',
      }),
      Schema.Array(
        Schema.String.annotations({
          description: 'Business image URL',
          format: 'uri',
        })
      )
    ).annotations({
      description: 'Business image(s)',
    })
  ),
  email: Schema.optional(
    Schema.String.annotations({
      description: 'Contact email',
      format: 'email',
    })
  ),
  telephone: Schema.optional(
    Schema.String.annotations({
      description: 'Contact phone number',
    })
  ),
  priceRange: Schema.optional(
    Schema.String.annotations({
      description: "Price range (e.g., '$-$$$$')",
    })
  ),
  address: Schema.optional(PostalAddressSchema),
  geo: Schema.optional(GeoCoordinatesSchema),
  sameAs: Schema.optional(
    Schema.Array(
      Schema.String.annotations({
        description: 'Social media profile URL',
        format: 'uri',
      })
    ).annotations({
      description: 'Social media profile URLs',
    })
  ),
  openingHoursSpecification: Schema.optional(
    Schema.Array(OpeningHoursSpecificationSchema).annotations({
      description: 'Opening hours specifications',
    })
  ),
}).annotations({
  title: 'Local Business Schema',
  description: 'Schema.org LocalBusiness structured data',
})

export type DayOfWeek = Schema.Schema.Type<typeof DayOfWeekSchema>
export type Time = Schema.Schema.Type<typeof TimeSchema>
export type OpeningHoursSpecification = Schema.Schema.Type<typeof OpeningHoursSpecificationSchema>
export type GeoCoordinates = Schema.Schema.Type<typeof GeoCoordinatesSchema>
export type LocalBusiness = Schema.Schema.Type<typeof LocalBusinessSchema>
