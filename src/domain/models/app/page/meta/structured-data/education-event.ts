/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { positiveInt, schemaType } from './common-fields'
import { PostalAddressSchema } from './postal-address'
import { CurrencyCodeSchema } from './product'

/**
 * Event attendance mode
 *
 * 3 attendance modes for events:
 * - OfflineEventAttendanceMode: In-person event at physical location
 * - OnlineEventAttendanceMode: Virtual/online event (Zoom, livestream)
 * - MixedEventAttendanceMode: Hybrid event (both in-person and online)
 */
export const EventAttendanceModeSchema = Schema.Literal(
  'https://schema.org/OfflineEventAttendanceMode',
  'https://schema.org/OnlineEventAttendanceMode',
  'https://schema.org/MixedEventAttendanceMode'
).annotations({
  description: 'Event attendance mode',
})

/**
 * Event status
 *
 * 4 event statuses:
 * - EventScheduled: Event is scheduled and happening as planned
 * - EventCancelled: Event has been cancelled
 * - EventPostponed: Event postponed to later date (TBD)
 * - EventRescheduled: Event rescheduled to specific new date
 */
export const EventStatusSchema = Schema.Literal(
  'https://schema.org/EventScheduled',
  'https://schema.org/EventCancelled',
  'https://schema.org/EventPostponed',
  'https://schema.org/EventRescheduled'
).annotations({
  description: 'Event status',
})

/**
 * Event location (Place)
 *
 * Physical location for in-person or hybrid events.
 * - @type: "Place"
 * - name: Venue name (e.g., "Convention Center", "Library Hall")
 * - address: Venue address (PostalAddress object)
 */
export const EventLocationSchema = Schema.Struct({
  '@type': schemaType('Place'),
  name: Schema.optional(
    Schema.String.annotations({
      description: 'Venue name',
    })
  ),
  address: Schema.optional(PostalAddressSchema),
}).annotations({
  description: 'Event location',
})

/**
 * Event organizer
 *
 * Organization or Person organizing the event.
 * - @type: "Organization" or "Person"
 * - name: Organizer name
 * - url: Organizer website/profile URL
 */
export const EventOrganizerSchema = Schema.Struct({
  '@type': Schema.Literal('Organization', 'Person').annotations({
    description: 'Organizer type',
  }),
  name: Schema.optional(
    Schema.String.annotations({
      description: 'Organizer name',
    })
  ),
  url: Schema.optional(
    Schema.String.annotations({
      description: 'Organizer URL',
      format: 'uri',
    })
  ),
}).annotations({
  description: 'Event organizer',
})

/**
 * Ticket availability status
 *
 * 4 availability statuses for event tickets:
 * - InStock: Tickets available
 * - OutOfStock: Sold out (temporarily)
 * - PreOrder: Tickets available for pre-order
 * - SoldOut: Permanently sold out
 */
export const TicketAvailabilitySchema = Schema.Literal(
  'https://schema.org/InStock',
  'https://schema.org/OutOfStock',
  'https://schema.org/PreOrder',
  'https://schema.org/SoldOut'
).annotations({
  description: 'Ticket availability status',
})

/**
 * Event ticket offer
 *
 * Pricing and availability for event tickets.
 * - @type: "Offer"
 * - price: Ticket price (string or number, "0" for free events)
 * - priceCurrency: ISO 4217 currency code (e.g., "USD", "EUR")
 * - availability: Stock status (InStock, OutOfStock, PreOrder, SoldOut)
 * - url: URL to ticket purchase page
 */
export const EventOfferSchema = Schema.Struct({
  '@type': schemaType('Offer'),
  price: Schema.optional(
    Schema.Union(Schema.String, Schema.Number).annotations({
      description: 'Ticket price',
    })
  ),
  priceCurrency: Schema.optional(CurrencyCodeSchema),
  availability: Schema.optional(TicketAvailabilitySchema),
  url: Schema.optional(
    Schema.String.annotations({
      description: 'Ticket purchase URL',
      format: 'uri',
    })
  ),
}).annotations({
  description: 'Event ticket offer',
})

/**
 * Schema.org EducationEvent structured data
 *
 * Represents educational events (workshops, courses, training, seminars) for rich results
 * in Google Search and Google Maps. Enables event cards with dates, location, pricing,
 * and registration directly in search results.
 *
 * Required properties:
 * - @type: "EducationEvent" (Schema.org type identifier)
 * - name: Event name (e.g., "React Masterclass", "Photography Workshop")
 * - startDate: Event start date/time (ISO 8601 format)
 *
 * Optional properties:
 * - description: Event description
 * - endDate: Event end date/time (ISO 8601 format)
 * - eventAttendanceMode: In-person, online, or hybrid
 * - eventStatus: Scheduled, cancelled, postponed, or rescheduled
 * - location: Event venue (Place object with name and address)
 * - organizer: Event organizer (Organization or Person)
 * - offers: Ticket pricing (Offer object with price, currency, availability, URL)
 * - maximumAttendeeCapacity: Maximum number of attendees
 * - minimumAttendeeCapacity: Minimum number of attendees
 *
 * Common use cases:
 * - **Workshops**: Hands-on training sessions (e.g., "3-hour React Workshop")
 * - **Courses**: Educational courses (e.g., "8-week Python Bootcamp")
 * - **Seminars**: Lecture-style events (e.g., "AI in Healthcare Seminar")
 * - **Webinars**: Online educational events (eventAttendanceMode: OnlineEventAttendanceMode)
 * - **Hybrid events**: Both in-person and online (eventAttendanceMode: MixedEventAttendanceMode)
 *
 * SEO impact:
 * - **Event rich results**: Cards with date, time, location, price in search
 * - **Google Maps**: Events appear in Google Maps for local discovery
 * - **Event discovery**: Appears in Google's event discovery features
 * - **Calendar integration**: "Add to calendar" button in search results
 * - **Mobile optimization**: One-tap registration, directions, calendar add
 *
 * @example
 * ```typescript
 * const educationEvent = {
 *   "@type": "EducationEvent",
 *   name: "React Masterclass Workshop",
 *   description: "Learn advanced React patterns with hands-on exercises",
 *   startDate: "2025-02-15T14:00:00-05:00",
 *   endDate: "2025-02-15T17:00:00-05:00",
 *   eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
 *   eventStatus: "https://schema.org/EventScheduled",
 *   location: {
 *     "@type": "Place",
 *     name: "Tech Hub Conference Center",
 *     address: {
 *       "@type": "PostalAddress",
 *       streetAddress: "123 Innovation Dr",
 *       addressLocality: "San Francisco",
 *       addressRegion: "CA",
 *       postalCode: "94105",
 *       addressCountry: "US"
 *     }
 *   },
 *   organizer: {
 *     "@type": "Organization",
 *     name: "React Academy",
 *     url: "https://reactacademy.com"
 *   },
 *   offers: {
 *     "@type": "Offer",
 *     price: "149.00",
 *     priceCurrency: "USD",
 *     availability: "https://schema.org/InStock",
 *     url: "https://reactacademy.com/workshops/react-masterclass"
 *   },
 *   maximumAttendeeCapacity: 30
 * }
 * ```
 *
 * @see specs/app/pages/meta/structured-data/education-event.schema.json
 */
export const EducationEventSchema = Schema.Struct({
  '@type': schemaType('EducationEvent'),
  name: Schema.String.annotations({
    description: 'Event name',
  }),
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Event description',
    })
  ),
  startDate: Schema.String.annotations({
    description: 'Event start date/time (ISO 8601)',
    format: 'date-time',
  }),
  endDate: Schema.optional(
    Schema.String.annotations({
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
}).annotations({
  title: 'Education Event Schema',
  description: 'Schema.org EducationEvent structured data',
})

export type EventAttendanceMode = Schema.Schema.Type<typeof EventAttendanceModeSchema>
export type EventStatus = Schema.Schema.Type<typeof EventStatusSchema>
export type EventLocation = Schema.Schema.Type<typeof EventLocationSchema>
export type EventOrganizer = Schema.Schema.Type<typeof EventOrganizerSchema>
export type TicketAvailability = Schema.Schema.Type<typeof TicketAvailabilitySchema>
export type EventOffer = Schema.Schema.Type<typeof EventOfferSchema>
export type EducationEvent = Schema.Schema.Type<typeof EducationEventSchema>
