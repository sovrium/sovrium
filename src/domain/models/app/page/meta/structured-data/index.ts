/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ArticleSchema } from './article'
import { BreadcrumbSchema } from './breadcrumb'
import { EducationEventSchema } from './education-event'
import { FaqPageSchema } from './faq-page'
import { LocalBusinessSchema } from './local-business'
import { OrganizationSchema } from './organization'
import { PersonSchema } from './person'
import { ProductSchema } from './product'

/**
 * Schema.org structured data for search engine understanding
 *
 * Orchestrator schema that combines all 8 structured data types into a single configuration.
 * Each property is optional, allowing pages to include only the relevant structured data types.
 *
 * Available structured data types:
 * - **organization**: Company/organization information for Knowledge Graph
 * - **person**: Individual person profiles for author attribution
 * - **localBusiness**: Local business for maps and local SEO
 * - **product**: E-commerce products for shopping rich results
 * - **article**: Articles/blog posts for content rich results
 * - **breadcrumb**: Navigation hierarchy for breadcrumb trails
 * - **faqPage**: FAQ pages for Q&A rich results
 * - **educationEvent**: Educational events for event discovery
 *
 * Usage patterns:
 * - **Homepage**: organization (company info in Knowledge Graph)
 * - **About page**: organization + person (company + team members)
 * - **Blog post**: article + breadcrumb + person (content with navigation and author)
 * - **Product page**: product + breadcrumb (e-commerce with navigation)
 * - **FAQ page**: faqPage + breadcrumb (Q&A with navigation)
 * - **Event page**: educationEvent + breadcrumb (event with navigation)
 * - **Local business**: localBusiness + organization (location + company info)
 *
 * SEO impact:
 * - **Rich results**: Enables rich snippets in Google search results
 * - **Knowledge Graph**: Company/person information panels
 * - **Maps integration**: Local business map pins and directions
 * - **Event discovery**: Events in Google Search and Google Maps
 * - **E-commerce**: Product cards with pricing and ratings
 * - **Navigation**: Breadcrumb trails replace URLs in search results
 *
 * @example
 * ```typescript
 * const structuredData = {
 *   organization: {
 *     "@context": "https://schema.org",
 *     "@type": "Organization",
 *     name: "Acme Inc",
 *     url: "https://acme.com"
 *   },
 *   breadcrumb: {
 *     "@context": "https://schema.org",
 *     "@type": "BreadcrumbList",
 *     itemListElement: [...]
 *   }
 * }
 * ```
 *
 * @see specs/app/pages/meta/structured-data/structured-data.schema.json
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
}).annotations({
  title: 'Structured Data',
  description: 'Schema.org structured data for search engine understanding',
})

export type StructuredData = Schema.Schema.Type<typeof StructuredDataSchema>

// Re-export all structured data schemas for convenience
export * from './postal-address'
export * from './person'
export * from './breadcrumb'
export * from './faq-page'
export * from './article'
export * from './organization'
export * from './local-business'
export * from './product'
export * from './education-event'
