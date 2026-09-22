/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  PostalAddressSchema,
  positiveInt,
  schemaType,
  SchemaOrgContext,
} from './structured-data-vocabulary'

// ============================================================================
// Structured Data — Product
// ============================================================================

/**
 * Product brand
 */
export const ProductBrandSchema = Schema.Struct({
  '@type': schemaType('Brand'),
  name: Schema.optional(
    Schema.String.annotate({
      description: 'Brand name',
    })
  ),
}).annotate({
  description: 'Product brand',
})

/**
 * ISO 4217 currency code
 */
export const CurrencyCodeSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[A-Z]{3}$/, {
      message:
        'Currency code must be ISO 4217 format (3 uppercase letters, e.g., USD, EUR, GBP, JPY)',
    })
  )
).annotate({
  description: 'ISO 4217 currency code',
  examples: ['USD', 'EUR', 'GBP'],
})

/**
 * Product offer
 */
export const ProductOfferSchema = Schema.Struct({
  '@type': schemaType('Offer'),
  price: Schema.optional(
    Schema.Union([Schema.String, Schema.Finite]).annotate({
      description: 'Product price',
    })
  ),
  priceCurrency: Schema.optional(CurrencyCodeSchema),
  availability: Schema.optional(
    Schema.String.annotate({
      description: 'Stock availability status',
    })
  ),
  url: Schema.optional(
    Schema.String.annotate({
      description: 'URL to purchase page',
      format: 'uri',
    })
  ),
}).annotate({
  description: 'Product offer',
})

/**
 * Aggregate rating
 */
export const AggregateRatingSchema = Schema.Struct({
  '@type': schemaType('AggregateRating'),
  ratingValue: Schema.optional(
    Schema.Finite.annotate({
      description: 'Average rating value',
    })
  ),
  reviewCount: Schema.optional(
    Schema.Int.annotate({
      description: 'Total number of reviews',
    })
  ),
}).annotate({
  description: 'Aggregate rating',
})

/**
 * Schema.org Product structured data
 */
export const ProductSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('Product'),
  name: Schema.String.annotate({
    description: 'Product name',
  }),
  description: Schema.optional(
    Schema.String.annotate({
      description: 'Product description',
    })
  ),
  image: Schema.optional(
    Schema.Union([
      Schema.String.annotate({
        description: 'Product image URL',
        format: 'uri',
      }),
      Schema.Array(
        Schema.String.annotate({
          description: 'Product image URL',
          format: 'uri',
        })
      ),
    ]).annotate({
      description: 'Product image(s)',
    })
  ),
  brand: Schema.optional(ProductBrandSchema),
  sku: Schema.optional(
    Schema.String.annotate({
      description: 'Stock Keeping Unit',
    })
  ),
  gtin: Schema.optional(
    Schema.String.annotate({
      description: 'Global Trade Item Number (UPC, EAN, ISBN)',
    })
  ),
  offers: Schema.optional(ProductOfferSchema),
  aggregateRating: Schema.optional(AggregateRatingSchema),
}).annotate({
  title: 'Product Schema',
  description: 'Schema.org Product structured data',
})

/** @public */
export type ProductBrand = Schema.Schema.Type<typeof ProductBrandSchema>
/** @public */
export type CurrencyCode = Schema.Schema.Type<typeof CurrencyCodeSchema>
/** @public */
export type ProductOffer = Schema.Schema.Type<typeof ProductOfferSchema>
/** @public */
export type AggregateRating = Schema.Schema.Type<typeof AggregateRatingSchema>
/** @public */
export type Product = Schema.Schema.Type<typeof ProductSchema>

// ============================================================================
// Structured Data — Education Event
// ============================================================================

/**
 * Event attendance mode
 */
export const EventAttendanceModeSchema = Schema.Literals([
  'https://schema.org/OfflineEventAttendanceMode',
  'https://schema.org/OnlineEventAttendanceMode',
  'https://schema.org/MixedEventAttendanceMode',
]).annotate({
  description: 'Event attendance mode',
})

/**
 * Event status
 */
export const EventStatusSchema = Schema.Literals([
  'https://schema.org/EventScheduled',
  'https://schema.org/EventCancelled',
  'https://schema.org/EventPostponed',
  'https://schema.org/EventRescheduled',
]).annotate({
  description: 'Event status',
})

/**
 * Event location (Place)
 */
export const EventLocationSchema = Schema.Struct({
  '@type': schemaType('Place'),
  name: Schema.optional(
    Schema.String.annotate({
      description: 'Venue name',
    })
  ),
  address: Schema.optional(PostalAddressSchema),
}).annotate({
  description: 'Event location',
})

/**
 * Event organizer
 */
export const EventOrganizerSchema = Schema.Struct({
  '@type': Schema.Literals(['Organization', 'Person']).annotate({
    description: 'Organizer type',
  }),
  name: Schema.optional(
    Schema.String.annotate({
      description: 'Organizer name',
    })
  ),
  url: Schema.optional(
    Schema.String.annotate({
      description: 'Organizer URL',
      format: 'uri',
    })
  ),
}).annotate({
  description: 'Event organizer',
})

/**
 * Ticket availability status
 */
export const TicketAvailabilitySchema = Schema.Literals([
  'https://schema.org/InStock',
  'https://schema.org/OutOfStock',
  'https://schema.org/PreOrder',
  'https://schema.org/SoldOut',
]).annotate({
  description: 'Ticket availability status',
})

/**
 * Event ticket offer
 */
export const EventOfferSchema = Schema.Struct({
  '@type': schemaType('Offer'),
  price: Schema.optional(
    Schema.Union([Schema.String, Schema.Finite]).annotate({
      description: 'Ticket price',
    })
  ),
  priceCurrency: Schema.optional(CurrencyCodeSchema),
  availability: Schema.optional(TicketAvailabilitySchema),
  url: Schema.optional(
    Schema.String.annotate({
      description: 'Ticket purchase URL',
      format: 'uri',
    })
  ),
}).annotate({
  description: 'Event ticket offer',
})

/**
 * Schema.org EducationEvent structured data
 */
export const EducationEventSchema = Schema.Struct({
  '@type': schemaType('EducationEvent'),
  name: Schema.String.annotate({
    description: 'Event name',
  }),
  description: Schema.optional(
    Schema.String.annotate({
      description: 'Event description',
    })
  ),
  startDate: Schema.String.annotate({
    description: 'Event start date/time (ISO 8601)',
    format: 'date-time',
  }),
  endDate: Schema.optional(
    Schema.String.annotate({
      description: 'Event end date/time (ISO 8601)',
      format: 'date-time',
    })
  ),
  eventAttendanceMode: Schema.optional(EventAttendanceModeSchema),
  eventStatus: Schema.optional(EventStatusSchema),
  location: Schema.optional(EventLocationSchema),
  organizer: Schema.optional(EventOrganizerSchema),
  offers: Schema.optional(EventOfferSchema),
  maximumAttendeeCapacity: Schema.optional(positiveInt('Maximum number of attendees')),
  minimumAttendeeCapacity: Schema.optional(positiveInt('Minimum number of attendees')),
}).annotate({
  title: 'Education Event Schema',
  description: 'Schema.org EducationEvent structured data',
})

/** @public */
export type EventAttendanceMode = Schema.Schema.Type<typeof EventAttendanceModeSchema>
/** @public */
export type EventStatus = Schema.Schema.Type<typeof EventStatusSchema>
/** @public */
export type EventLocation = Schema.Schema.Type<typeof EventLocationSchema>
/** @public */
export type EventOrganizer = Schema.Schema.Type<typeof EventOrganizerSchema>
/** @public */
export type TicketAvailability = Schema.Schema.Type<typeof TicketAvailabilitySchema>
/** @public */
export type EventOffer = Schema.Schema.Type<typeof EventOfferSchema>
/** @public */
export type EducationEvent = Schema.Schema.Type<typeof EducationEventSchema>
