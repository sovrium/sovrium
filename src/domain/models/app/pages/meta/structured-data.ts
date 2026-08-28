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

// ============================================================================
// Structured Data — Article
// ============================================================================

/**
 * Article type
 */
export const ArticleTypeSchema = Schema.Literals([
  'Article',
  'NewsArticle',
  'BlogPosting',
]).annotate({
  description: 'Article type',
})

/**
 * Article author
 */
export const ArticleAuthorSchema = Schema.Union([
  Schema.String,
  Schema.Struct({
    '@type': Schema.Literals(['Person', 'Organization']).annotate({
      description: 'Author type',
    }),
    name: Schema.optional(
      Schema.String.annotate({
        description: 'Author name',
      })
    ),
    url: Schema.optional(
      Schema.String.annotate({
        description: 'Author profile URL',
        format: 'uri',
      })
    ),
  }),
]).annotate({
  description: 'Article author',
})

/**
 * Publisher logo
 */
export const PublisherLogoSchema = Schema.Struct({
  '@type': schemaType('ImageObject'),
  url: Schema.optional(
    Schema.String.annotate({
      description: 'Logo URL',
      format: 'uri',
    })
  ),
}).annotate({
  description: 'Publisher logo',
})

/**
 * Article publisher
 */
export const ArticlePublisherSchema = Schema.Struct({
  '@type': schemaType('Organization'),
  name: Schema.optional(
    Schema.String.annotate({
      description: 'Publisher name',
    })
  ),
  logo: Schema.optional(PublisherLogoSchema),
}).annotate({
  description: 'Article publisher',
})

/**
 * Schema.org Article structured data
 */
export const ArticleSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': ArticleTypeSchema,
  headline: Schema.String.annotate({
    description: 'Article title',
  }),
  description: Schema.optional(
    Schema.String.annotate({
      description: 'Article summary',
    })
  ),
  image: Schema.optional(
    Schema.Union([
      Schema.String.annotate({
        description: 'Article image URL',
        format: 'uri',
      }),
      Schema.Array(
        Schema.String.annotate({
          description: 'Article image URL',
          format: 'uri',
        })
      ),
    ]).annotate({
      description: 'Article image(s)',
    })
  ),
  author: Schema.optional(ArticleAuthorSchema),
  datePublished: Schema.optional(
    Schema.String.annotate({
      description: 'Publication date',
      format: 'date-time',
    })
  ),
  dateModified: Schema.optional(
    Schema.String.annotate({
      description: 'Last modification date',
      format: 'date-time',
    })
  ),
  publisher: Schema.optional(ArticlePublisherSchema),
  mainEntityOfPage: Schema.optional(
    Schema.String.annotate({
      description: "Article's canonical URL",
      format: 'uri',
    })
  ),
}).annotate({
  title: 'Article Schema',
  description: 'Schema.org Article structured data',
})

/** @public */
export type ArticleType = Schema.Schema.Type<typeof ArticleTypeSchema>
/** @public */
export type ArticleAuthor = Schema.Schema.Type<typeof ArticleAuthorSchema>
/** @public */
export type PublisherLogo = Schema.Schema.Type<typeof PublisherLogoSchema>
/** @public */
export type ArticlePublisher = Schema.Schema.Type<typeof ArticlePublisherSchema>
/** @public */
export type Article = Schema.Schema.Type<typeof ArticleSchema>

// ============================================================================
// Structured Data — Breadcrumb
// ============================================================================

/**
 * Breadcrumb list item
 */
export const BreadcrumbListItemSchema = Schema.Struct({
  '@type': schemaType('ListItem'),
  position: positiveInt('Item position in breadcrumb trail'),
  name: Schema.String.annotate({
    description: 'Breadcrumb label',
  }),
  item: Schema.optional(
    Schema.String.annotate({
      description: 'URL to the breadcrumb page',
      format: 'uri',
    })
  ),
}).annotate({
  description: 'Breadcrumb list item',
})

/**
 * Schema.org BreadcrumbList structured data
 */
export const BreadcrumbSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('BreadcrumbList'),
  itemListElement: Schema.Array(BreadcrumbListItemSchema).annotate({
    description: 'Array of breadcrumb items',
  }),
}).annotate({
  title: 'Breadcrumb Schema',
  description: 'Schema.org BreadcrumbList structured data',
})

/** @public */
export type BreadcrumbListItem = Schema.Schema.Type<typeof BreadcrumbListItemSchema>
/** @public */
export type Breadcrumb = Schema.Schema.Type<typeof BreadcrumbSchema>

// ============================================================================
// Structured Data — FAQ Page
// ============================================================================

/**
 * FAQ answer
 */
export const FaqAnswerSchema = Schema.Struct({
  '@type': schemaType('Answer'),
  text: Schema.String.annotate({
    description: 'The answer text',
  }),
}).annotate({
  description: 'FAQ answer',
})

/**
 * FAQ question with accepted answer
 */
export const FaqQuestionSchema = Schema.Struct({
  '@type': schemaType('Question'),
  name: Schema.String.annotate({
    description: 'The question text',
  }),
  acceptedAnswer: FaqAnswerSchema,
}).annotate({
  description: 'FAQ question',
})

/**
 * Schema.org FAQPage structured data
 */
export const FaqPageSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('FAQPage'),
  mainEntity: Schema.Array(FaqQuestionSchema).annotate({
    description: 'Array of questions and answers',
  }),
}).annotate({
  title: 'FAQ Page Schema',
  description: 'Schema.org FAQPage structured data',
})

/** @public */
export type FaqAnswer = Schema.Schema.Type<typeof FaqAnswerSchema>
/** @public */
export type FaqQuestion = Schema.Schema.Type<typeof FaqQuestionSchema>
/** @public */
export type FaqPage = Schema.Schema.Type<typeof FaqPageSchema>

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

// ============================================================================
// Structured Data — Person
// ============================================================================

/**
 * Organization reference for Person's employer
 */
export const PersonWorksForSchema = Schema.Struct({
  '@type': schemaType('Organization'),
  name: Schema.optional(
    Schema.String.annotate({
      description: 'Organization name',
    })
  ),
}).annotate({
  description: "Person's employer organization",
})

/**
 * Schema.org Person structured data
 */
export const PersonSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('Person'),
  name: Schema.String.annotate({
    description: "Person's full name",
  }),
  givenName: Schema.optional(
    Schema.String.annotate({
      description: 'First name',
    })
  ),
  familyName: Schema.optional(
    Schema.String.annotate({
      description: 'Last name',
    })
  ),
  email: Schema.optional(SchemaOrgEmail),
  telephone: Schema.optional(SchemaOrgTelephone),
  url: Schema.optional(
    SchemaOrgUrl.annotate({
      description: "Person's website or profile",
    })
  ),
  image: Schema.optional(
    SchemaOrgImageUrl.annotate({
      description: "Person's photo URL",
    })
  ),
  jobTitle: Schema.optional(
    Schema.String.annotate({
      description: 'Professional role',
    })
  ),
  worksFor: Schema.optional(PersonWorksForSchema),
  sameAs: Schema.optional(SchemaOrgSameAs),
  address: Schema.optional(PostalAddressSchema),
}).annotate({
  title: 'Person Schema',
  description: 'Schema.org Person structured data',
})

/** @public */
export type PersonWorksFor = Schema.Schema.Type<typeof PersonWorksForSchema>
/** @public */
export type Person = Schema.Schema.Type<typeof PersonSchema>

// ============================================================================
// Structured Data — Local Business
// ============================================================================

/**
 * Day of week for opening hours
 */
export const DayOfWeekSchema = Schema.Literals([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]).annotate({
  description: 'Day of the week',
})

/**
 * Time in HH:MM format (24-hour)
 */
export const TimeSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[0-9]{2}:[0-9]{2}$/, {
      message: 'Time must be in HH:MM format (24-hour, e.g., 09:00, 18:30, 23:59)',
    })
  )
).annotate({
  description: 'Time in HH:MM format',
  examples: ['09:00', '18:00'],
})

/**
 * Opening hours specification
 */
export const OpeningHoursSpecificationSchema = Schema.Struct({
  '@type': schemaType('OpeningHoursSpecification'),
  dayOfWeek: Schema.optional(
    Schema.Array(DayOfWeekSchema).annotate({
      description: 'Days these hours apply to',
    })
  ),
  opens: Schema.optional(TimeSchema.annotate({ description: 'Opening time' })),
  closes: Schema.optional(TimeSchema.annotate({ description: 'Closing time' })),
}).annotate({
  description: 'Opening hours specification',
})

/**
 * Geographic coordinates
 */
export const GeoCoordinatesSchema = Schema.Struct({
  '@type': schemaType('GeoCoordinates'),
  latitude: Schema.optional(
    Schema.String.annotate({
      description: 'Latitude',
    })
  ),
  longitude: Schema.optional(
    Schema.String.annotate({
      description: 'Longitude',
    })
  ),
}).annotate({
  description: 'Geographic coordinates',
})

/**
 * Schema.org LocalBusiness structured data
 */
export const LocalBusinessSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('LocalBusiness'),
  name: Schema.String.annotate({
    description: 'Business name',
  }),
  description: Schema.optional(
    Schema.String.annotate({
      description: 'Business description',
    })
  ),
  url: Schema.optional(
    Schema.String.annotate({
      description: 'Business website URL',
      format: 'uri',
    })
  ),
  logo: Schema.optional(
    Schema.String.annotate({
      description: 'Business logo URL',
      format: 'uri',
    })
  ),
  image: Schema.optional(
    Schema.Union([
      Schema.String.annotate({
        description: 'Business image URL',
        format: 'uri',
      }),
      Schema.Array(
        Schema.String.annotate({
          description: 'Business image URL',
          format: 'uri',
        })
      ),
    ]).annotate({
      description: 'Business image(s)',
    })
  ),
  email: Schema.optional(
    Schema.String.annotate({
      description: 'Contact email',
      format: 'email',
    })
  ),
  telephone: Schema.optional(
    Schema.String.annotate({
      description: 'Contact phone number',
    })
  ),
  priceRange: Schema.optional(
    Schema.String.annotate({
      description: "Price range (e.g., '$-$$$$')",
    })
  ),
  address: Schema.optional(PostalAddressSchema),
  geo: Schema.optional(GeoCoordinatesSchema),
  sameAs: Schema.optional(
    Schema.Array(
      Schema.String.annotate({
        description: 'Social media profile URL',
        format: 'uri',
      })
    ).annotate({
      description: 'Social media profile URLs',
    })
  ),
  openingHoursSpecification: Schema.optional(
    Schema.Array(OpeningHoursSpecificationSchema).annotate({
      description: 'Opening hours specifications',
    })
  ),
}).annotate({
  title: 'Local Business Schema',
  description: 'Schema.org LocalBusiness structured data',
})

/** @public */
export type DayOfWeek = Schema.Schema.Type<typeof DayOfWeekSchema>
/** @public */
export type Time = Schema.Schema.Type<typeof TimeSchema>
/** @public */
export type OpeningHoursSpecification = Schema.Schema.Type<typeof OpeningHoursSpecificationSchema>
/** @public */
export type GeoCoordinates = Schema.Schema.Type<typeof GeoCoordinatesSchema>
/** @public */
export type LocalBusiness = Schema.Schema.Type<typeof LocalBusinessSchema>

// ============================================================================
// Structured Data — Organization
// ============================================================================

/**
 * Schema.org Organization structured data
 */
export const OrganizationSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('Organization'),
  name: Schema.String.annotate({
    description: 'Organization name',
  }),
  description: Schema.optional(
    Schema.String.annotate({
      description: 'Organization description',
    })
  ),
  url: Schema.optional(
    Schema.String.annotate({
      description: 'Organization website URL',
      format: 'uri',
    })
  ),
  logo: Schema.optional(
    Schema.String.annotate({
      description: 'Organization logo URL',
      format: 'uri',
    })
  ),
  image: Schema.optional(
    Schema.Union([
      Schema.String.annotate({
        description: 'Organization image URL',
        format: 'uri',
      }),
      Schema.Array(
        Schema.String.annotate({
          description: 'Organization image URL',
          format: 'uri',
        })
      ),
    ]).annotate({
      description: 'Organization image(s)',
    })
  ),
  email: Schema.optional(
    Schema.String.annotate({
      description: 'Contact email',
      format: 'email',
    })
  ),
  telephone: Schema.optional(
    Schema.String.annotate({
      description: 'Contact phone number',
    })
  ),
  address: Schema.optional(PostalAddressSchema),
  sameAs: Schema.optional(
    Schema.Array(
      Schema.String.annotate({
        description: 'Social media profile URL',
        format: 'uri',
      })
    ).annotate({
      description: 'Social media profile URLs',
      examples: [['https://facebook.com/myorg', 'https://twitter.com/myorg']],
    })
  ),
  founder: Schema.optional(
    Schema.String.annotate({
      description: 'Organization founder name',
    })
  ),
  foundingDate: Schema.optional(
    Schema.String.annotate({
      description: 'Date organization was founded',
      format: 'date',
    })
  ),
  employees: Schema.optional(
    Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(1))).annotate({
      description: 'Number of employees',
    })
  ),
  event: Schema.optional(
    EducationEventSchema.annotate({
      description: 'Associated event hosted or organized by the organization',
    })
  ),
}).annotate({
  title: 'Organization Schema',
  description: 'Schema.org Organization structured data',
})

/** @public */
export type Organization = Schema.Schema.Type<typeof OrganizationSchema>

// ============================================================================
// Structured Data — Union
// ============================================================================

/**
 * Schema.org structured data for search engine understanding
 *
 * Orchestrator schema that combines all 8 structured data types into a single configuration.
 */
export const StructuredDataSchema = Schema.Struct({
  organization: Schema.optional(OrganizationSchema),
  person: Schema.optional(PersonSchema),
  localBusiness: Schema.optional(LocalBusinessSchema),
  product: Schema.optional(ProductSchema),
  article: Schema.optional(ArticleSchema),
  breadcrumb: Schema.optional(BreadcrumbSchema),
  faqPage: Schema.optional(FaqPageSchema),
  educationEvent: Schema.optional(EducationEventSchema),
}).annotate({
  title: 'Structured Data',
  description: 'Schema.org structured data for search engine understanding',
})

/** @public */
export type StructuredData = Schema.Schema.Type<typeof StructuredDataSchema>
