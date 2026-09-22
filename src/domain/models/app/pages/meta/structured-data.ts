/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/*
 * The eight Schema.org structured-data types a page may declare, assembled
 * from the per-type siblings. This module is the one the `meta` manifest
 * re-exports, so it publishes the whole vocabulary: the split is a file
 * boundary, never a change to what `structured-data` exports.
 *
 * - `structured-data-vocabulary.ts` — the Schema.org primitives (@context, url, PostalAddress) and the three field helpers
 * - `structured-data-content.ts`    — Article, Breadcrumb, FAQPage (what the page says)
 * - `structured-data-offering.ts`   — Product, EducationEvent (the two types that carry offers)
 * - `structured-data-entity.ts`     — Person, LocalBusiness, Organization (who publishes it)
 */

import { Schema } from 'effect'
import { BreadcrumbSchema, ArticleSchema, FaqPageSchema } from './structured-data-content'
import { LocalBusinessSchema, OrganizationSchema, PersonSchema } from './structured-data-entity'
import { EducationEventSchema, ProductSchema } from './structured-data-offering'

export * from './structured-data-vocabulary'
export * from './structured-data-content'
export * from './structured-data-offering'
export * from './structured-data-entity'

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
