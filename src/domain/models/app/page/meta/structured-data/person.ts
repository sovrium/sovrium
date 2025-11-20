/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  SchemaOrgContext,
  SchemaOrgEmail,
  SchemaOrgImageUrl,
  SchemaOrgSameAs,
  SchemaOrgTelephone,
  SchemaOrgUrl,
} from './common-fields'
import { PostalAddressSchema } from './postal-address'

/**
 * Organization reference for Person's employer
 *
 * Simplified Organization object with @type and name.
 * Links person to their employer organization.
 */
export const PersonWorksForSchema = Schema.Struct({
  '@type': Schema.Literal('Organization').annotations({
    description: 'Schema.org type',
  }),
  name: Schema.optional(
    Schema.String.annotations({
      description: 'Organization name',
    })
  ),
}).annotations({
  description: "Person's employer organization",
})

/**
 * Schema.org Person structured data
 *
 * Represents an individual person with contact information, professional details,
 * and social profiles. Used for author attribution, knowledge graphs, and notable persons.
 *
 * Required properties:
 * - @context: "https://schema.org" (Schema.org vocabulary)
 * - @type: "Person" (Schema.org type identifier)
 * - name: Person's full name (e.g., "John Doe")
 *
 * Optional properties:
 * - givenName: First name (e.g., "John")
 * - familyName: Last name (e.g., "Doe")
 * - email: Email address (format validated)
 * - telephone: Phone number
 * - url: Personal website or profile URL
 * - image: Photo URL (headshot, profile picture)
 * - jobTitle: Professional role (e.g., "CEO", "Software Engineer")
 * - worksFor: Employer organization (Organization object with name)
 * - sameAs: Array of social media profile URLs (LinkedIn, Twitter, GitHub, etc.)
 * - address: Mailing address (PostalAddress object)
 *
 * Common use cases:
 * - **Author attribution**: Link articles to specific authors (article.author)
 * - **Knowledge Graph**: Enable Google Knowledge Graph panel for notable persons
 * - **Contact information**: Provide structured contact details for business persons
 * - **Social profiles**: Link person to their social media presence
 *
 * SEO impact:
 * - Author attribution: Improves content credibility and E-E-A-T signals
 * - Knowledge Graph: Notable persons get rich panel in search results
 * - Social verification: sameAs links verify person's online identity
 * - Professional context: jobTitle and worksFor provide professional context
 *
 * @example
 * ```typescript
 * const person = {
 *   "@context": "https://schema.org",
 *   "@type": "Person",
 *   name: "John Doe",
 *   givenName: "John",
 *   familyName: "Doe",
 *   jobTitle: "CEO",
 *   email: "john@example.com",
 *   url: "https://johndoe.com",
 *   worksFor: {
 *     "@type": "Organization",
 *     name: "Acme Inc"
 *   },
 *   sameAs: [
 *     "https://linkedin.com/in/johndoe",
 *     "https://twitter.com/johndoe"
 *   ]
 * }
 * ```
 *
 * @see specs/app/pages/meta/structured-data/person.schema.json
 */
export const PersonSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': Schema.Literal('Person').annotations({
    description: 'Schema.org type',
  }),
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
