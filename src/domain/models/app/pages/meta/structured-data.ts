/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'


export const SchemaOrgContext = Schema.Literal('https://schema.org').annotations({
  description: 'Schema.org context',
})

export const SchemaOrgEmail = Schema.String.annotations({
  description: 'Email address',
  format: 'email',
})

export const SchemaOrgTelephone = Schema.String.annotations({
  description: 'Phone number',
})

export const SchemaOrgSameAs = Schema.Array(
  Schema.String.annotations({
    description: 'Social media profile URL',
    format: 'uri',
  })
).annotations({
  description: 'Social media profile URLs',
  examples: [
    [
      'https://twitter.com/example',
      'https://linkedin.com/in/example',
      'https://facebook.com/example',
    ],
  ],
})

export const SchemaOrgUrl = Schema.String.annotations({
  description: 'URL',
  format: 'uri',
})

export const SchemaOrgImageUrl = Schema.String.annotations({
  description: 'Image URL',
  format: 'uri',
})

export const optional = <A, I, R>(schema: Schema.Schema<A, I, R>) => Schema.optional(schema)

export const schemaType = <T extends string>(type: T) =>
  Schema.Literal(type).annotations({
    description: 'Schema.org type',
  })

export const positiveInt = (description: string) =>
  Schema.Int.pipe(Schema.greaterThanOrEqualTo(1)).annotations({
    description,
  })


export const CountryCodeSchema = Schema.String.pipe(
  Schema.pattern(/^[A-Z]{2}$/, {
    message: () =>
      'Country code must be ISO 3166-1 alpha-2 format (2 uppercase letters, e.g., US, FR, GB, DE, JP)',
  })
).annotations({
  description: 'ISO 3166-1 alpha-2 country code',
  examples: ['US', 'FR', 'GB', 'DE'],
})

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


export const ArticleTypeSchema = Schema.Literal(
  'Article',
  'NewsArticle',
  'BlogPosting'
).annotations({
  description: 'Article type',
})

export const ArticleAuthorSchema = Schema.Union(
  Schema.String,
  Schema.Struct({
    '@type': Schema.Literal('Person', 'Organization').annotations({
      description: 'Author type',
    }),
    name: Schema.optional(
      Schema.String.annotations({
        description: 'Author name',
      })
    ),
    url: Schema.optional(
      Schema.String.annotations({
        description: 'Author profile URL',
        format: 'uri',
      })
    ),
  })
).annotations({
  description: 'Article author',
})

export const PublisherLogoSchema = Schema.Struct({
  '@type': schemaType('ImageObject'),
  url: Schema.optional(
    Schema.String.annotations({
      description: 'Logo URL',
      format: 'uri',
    })
  ),
}).annotations({
  description: 'Publisher logo',
})

export const ArticlePublisherSchema = Schema.Struct({
  '@type': schemaType('Organization'),
  name: Schema.optional(
    Schema.String.annotations({
      description: 'Publisher name',
    })
  ),
  logo: Schema.optional(PublisherLogoSchema),
}).annotations({
  description: 'Article publisher',
})

export const ArticleSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': ArticleTypeSchema,
  headline: Schema.String.annotations({
    description: 'Article title',
  }),
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Article summary',
    })
  ),
  image: Schema.optional(
    Schema.Union(
      Schema.String.annotations({
        description: 'Article image URL',
        format: 'uri',
      }),
      Schema.Array(
        Schema.String.annotations({
          description: 'Article image URL',
          format: 'uri',
        })
      )
    ).annotations({
      description: 'Article image(s)',
    })
  ),
  author: Schema.optional(ArticleAuthorSchema),
  datePublished: Schema.optional(
    Schema.String.annotations({
      description: 'Publication date',
      format: 'date-time',
    })
  ),
  dateModified: Schema.optional(
    Schema.String.annotations({
      description: 'Last modification date',
      format: 'date-time',
    })
  ),
  publisher: Schema.optional(ArticlePublisherSchema),
  mainEntityOfPage: Schema.optional(
    Schema.String.annotations({
      description: "Article's canonical URL",
      format: 'uri',
    })
  ),
}).annotations({
  title: 'Article Schema',
  description: 'Schema.org Article structured data',
})

export type ArticleType = Schema.Schema.Type<typeof ArticleTypeSchema>
export type ArticleAuthor = Schema.Schema.Type<typeof ArticleAuthorSchema>
export type PublisherLogo = Schema.Schema.Type<typeof PublisherLogoSchema>
export type ArticlePublisher = Schema.Schema.Type<typeof ArticlePublisherSchema>
export type Article = Schema.Schema.Type<typeof ArticleSchema>


export const BreadcrumbListItemSchema = Schema.Struct({
  '@type': schemaType('ListItem'),
  position: positiveInt('Item position in breadcrumb trail'),
  name: Schema.String.annotations({
    description: 'Breadcrumb label',
  }),
  item: Schema.optional(
    Schema.String.annotations({
      description: 'URL to the breadcrumb page',
      format: 'uri',
    })
  ),
}).annotations({
  description: 'Breadcrumb list item',
})

export const BreadcrumbSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('BreadcrumbList'),
  itemListElement: Schema.Array(BreadcrumbListItemSchema).annotations({
    description: 'Array of breadcrumb items',
  }),
}).annotations({
  title: 'Breadcrumb Schema',
  description: 'Schema.org BreadcrumbList structured data',
})

export type BreadcrumbListItem = Schema.Schema.Type<typeof BreadcrumbListItemSchema>
export type Breadcrumb = Schema.Schema.Type<typeof BreadcrumbSchema>


export const FaqAnswerSchema = Schema.Struct({
  '@type': schemaType('Answer'),
  text: Schema.String.annotations({
    description: 'The answer text',
  }),
}).annotations({
  description: 'FAQ answer',
})

export const FaqQuestionSchema = Schema.Struct({
  '@type': schemaType('Question'),
  name: Schema.String.annotations({
    description: 'The question text',
  }),
  acceptedAnswer: FaqAnswerSchema,
}).annotations({
  description: 'FAQ question',
})

export const FaqPageSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('FAQPage'),
  mainEntity: Schema.Array(FaqQuestionSchema).annotations({
    description: 'Array of questions and answers',
  }),
}).annotations({
  title: 'FAQ Page Schema',
  description: 'Schema.org FAQPage structured data',
})

export type FaqAnswer = Schema.Schema.Type<typeof FaqAnswerSchema>
export type FaqQuestion = Schema.Schema.Type<typeof FaqQuestionSchema>
export type FaqPage = Schema.Schema.Type<typeof FaqPageSchema>


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

export const CurrencyCodeSchema = Schema.String.pipe(
  Schema.pattern(/^[A-Z]{3}$/, {
    message: () =>
      'Currency code must be ISO 4217 format (3 uppercase letters, e.g., USD, EUR, GBP, JPY)',
  })
).annotations({
  description: 'ISO 4217 currency code',
  examples: ['USD', 'EUR', 'GBP'],
})

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


export const EventAttendanceModeSchema = Schema.Literal(
  'https://schema.org/OfflineEventAttendanceMode',
  'https://schema.org/OnlineEventAttendanceMode',
  'https://schema.org/MixedEventAttendanceMode'
).annotations({
  description: 'Event attendance mode',
})

export const EventStatusSchema = Schema.Literal(
  'https://schema.org/EventScheduled',
  'https://schema.org/EventCancelled',
  'https://schema.org/EventPostponed',
  'https://schema.org/EventRescheduled'
).annotations({
  description: 'Event status',
})

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

export const TicketAvailabilitySchema = Schema.Literal(
  'https://schema.org/InStock',
  'https://schema.org/OutOfStock',
  'https://schema.org/PreOrder',
  'https://schema.org/SoldOut'
).annotations({
  description: 'Ticket availability status',
})

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


export const PersonWorksForSchema = Schema.Struct({
  '@type': schemaType('Organization'),
  name: Schema.optional(
    Schema.String.annotations({
      description: 'Organization name',
    })
  ),
}).annotations({
  description: "Person's employer organization",
})

export const PersonSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('Person'),
  name: Schema.String.annotations({
    description: "Person's full name",
  }),
  givenName: Schema.optional(
    Schema.String.annotations({
      description: 'First name',
    })
  ),
  familyName: Schema.optional(
    Schema.String.annotations({
      description: 'Last name',
    })
  ),
  email: Schema.optional(SchemaOrgEmail),
  telephone: Schema.optional(SchemaOrgTelephone),
  url: Schema.optional(
    SchemaOrgUrl.annotations({
      description: "Person's website or profile",
    })
  ),
  image: Schema.optional(
    SchemaOrgImageUrl.annotations({
      description: "Person's photo URL",
    })
  ),
  jobTitle: Schema.optional(
    Schema.String.annotations({
      description: 'Professional role',
    })
  ),
  worksFor: Schema.optional(PersonWorksForSchema),
  sameAs: Schema.optional(SchemaOrgSameAs),
  address: Schema.optional(PostalAddressSchema),
}).annotations({
  title: 'Person Schema',
  description: 'Schema.org Person structured data',
})

export type PersonWorksFor = Schema.Schema.Type<typeof PersonWorksForSchema>
export type Person = Schema.Schema.Type<typeof PersonSchema>


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

export const TimeSchema = Schema.String.pipe(
  Schema.pattern(/^[0-9]{2}:[0-9]{2}$/, {
    message: () => 'Time must be in HH:MM format (24-hour, e.g., 09:00, 18:30, 23:59)',
  })
).annotations({
  description: 'Time in HH:MM format',
  examples: ['09:00', '18:00'],
})

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


export const OrganizationSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('Organization'),
  name: Schema.String.annotations({
    description: 'Organization name',
  }),
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Organization description',
    })
  ),
  url: Schema.optional(
    Schema.String.annotations({
      description: 'Organization website URL',
      format: 'uri',
    })
  ),
  logo: Schema.optional(
    Schema.String.annotations({
      description: 'Organization logo URL',
      format: 'uri',
    })
  ),
  image: Schema.optional(
    Schema.Union(
      Schema.String.annotations({
        description: 'Organization image URL',
        format: 'uri',
      }),
      Schema.Array(
        Schema.String.annotations({
          description: 'Organization image URL',
          format: 'uri',
        })
      )
    ).annotations({
      description: 'Organization image(s)',
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
  address: Schema.optional(PostalAddressSchema),
  sameAs: Schema.optional(
    Schema.Array(
      Schema.String.annotations({
        description: 'Social media profile URL',
        format: 'uri',
      })
    ).annotations({
      description: 'Social media profile URLs',
      examples: [['https://facebook.com/myorg', 'https://twitter.com/myorg']],
    })
  ),
  founder: Schema.optional(
    Schema.String.annotations({
      description: 'Organization founder name',
    })
  ),
  foundingDate: Schema.optional(
    Schema.String.annotations({
      description: 'Date organization was founded',
      format: 'date',
    })
  ),
  employees: Schema.optional(
    Schema.Int.pipe(Schema.greaterThanOrEqualTo(1)).annotations({
      description: 'Number of employees',
    })
  ),
  event: Schema.optional(
    EducationEventSchema.annotations({
      description: 'Associated event hosted or organized by the organization',
    })
  ),
}).annotations({
  title: 'Organization Schema',
  description: 'Schema.org Organization structured data',
})

export type Organization = Schema.Schema.Type<typeof OrganizationSchema>


export const StructuredDataSchema = Schema.Struct({
  organization: Schema.optional(OrganizationSchema),
  person: Schema.optional(PersonSchema),
  localBusiness: Schema.optional(LocalBusinessSchema),
  product: Schema.optional(ProductSchema),
  article: Schema.optional(ArticleSchema),
  breadcrumb: Schema.optional(BreadcrumbSchema),
  faqPage: Schema.optional(FaqPageSchema),
  educationEvent: Schema.optional(EducationEventSchema),
}).annotations({
  title: 'Structured Data',
  description: 'Schema.org structured data for search engine understanding',
})

export type StructuredData = Schema.Schema.Type<typeof StructuredDataSchema>
