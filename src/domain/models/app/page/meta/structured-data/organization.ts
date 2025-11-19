/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { EducationEventSchema } from './education-event'
import { PostalAddressSchema } from './postal-address'

/**
 * Schema.org Organization structured data
 *
 * Represents a company, business, or organization for knowledge graphs and rich results.
 * Enables Google Knowledge Graph panel with company information, logo, and social profiles.
 *
 * Required properties:
 * - @context: "https://schema.org" (Schema.org vocabulary)
 * - @type: "Organization" (Schema.org type identifier)
 * - name: Organization name (e.g., "Acme Inc", "Google")
 *
 * Optional properties:
 * - description: Organization description/tagline
 * - url: Organization website URL
 * - logo: Organization logo URL (shown in Knowledge Graph)
 * - image: Organization image(s) - string or array (photos, headquarters, products)
 * - email: Contact email address
 * - telephone: Contact phone number
 * - address: Mailing address (PostalAddress object)
 * - sameAs: Array of social media profile URLs (Facebook, Twitter, LinkedIn, etc.)
 * - founder: Founder name
 * - foundingDate: Date organization was founded (YYYY-MM-DD format)
 * - employees: Number of employees (integer)
 * - event: Associated event (EducationEvent reference)
 *
 * Common use cases:
 * - **Knowledge Graph**: Company information panel in Google search results
 * - **Publisher attribution**: Link articles to publishing organization
 * - **Brand identity**: Establish company presence across search results
 * - **Social verification**: Link organization to official social profiles
 *
 * SEO impact:
 * - **Knowledge Graph panel**: Rich company information panel in search results (right side)
 * - **Logo display**: Organization logo shown in search results and Knowledge Graph
 * - **Social profiles**: sameAs links verify official social media accounts
 * - **Brand search**: Improves brand search results with structured information
 * - **Publisher credibility**: Used in Article schema for publisher attribution
 *
 * @example
 * ```typescript
 * const organization = {
 *   "@context": "https://schema.org",
 *   "@type": "Organization",
 *   name: "Acme Inc",
 *   description: "Leading provider of business software solutions",
 *   url: "https://acme.com",
 *   logo: "https://acme.com/logo.png",
 *   email: "contact@acme.com",
 *   telephone: "+1-555-123-4567",
 *   address: {
 *     "@type": "PostalAddress",
 *     streetAddress: "123 Main St",
 *     addressLocality: "San Francisco",
 *     addressRegion: "CA",
 *     postalCode: "94105",
 *     addressCountry: "US"
 *   },
 *   sameAs: [
 *     "https://facebook.com/acmeinc",
 *     "https://twitter.com/acmeinc",
 *     "https://linkedin.com/company/acmeinc"
 *   ],
 *   founder: "Jane Doe",
 *   foundingDate: "2015-01-15",
 *   employees: 150
 * }
 * ```
 *
 * @see specs/app/pages/meta/structured-data/organization.schema.json
 */
export const OrganizationSchema = Schema.Struct({
  '@context': Schema.Literal('https://schema.org').annotations({
    description: 'Schema.org context',
  }),
  '@type': Schema.Literal('Organization').annotations({
    description: 'Schema.org type',
  }),
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
