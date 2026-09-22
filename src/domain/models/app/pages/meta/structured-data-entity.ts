/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { EducationEventSchema } from './structured-data-offering'
import {
  PostalAddressSchema,
  schemaType,
  SchemaOrgContext,
  SchemaOrgEmail,
  SchemaOrgImageUrl,
  SchemaOrgSameAs,
  SchemaOrgTelephone,
  SchemaOrgUrl,
} from './structured-data-vocabulary'

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
