/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// Search engine enum (mirrors Effect Schema SearchEngineSchema)
// ---------------------------------------------------------------------------

export const searchEngineEnum = Schema.Literals(['client', 'fts', 'trigram', 'hybrid']).annotate({
  description: 'Search backend engine used for the query',
})

// ---------------------------------------------------------------------------
// Search request schema
// ---------------------------------------------------------------------------

/**
 * Search request schema for the search API endpoint.
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API request validation via `effectValidator`
 * - Hono RPC client type inference
 */
export const searchRequestSchema = Schema.Struct({
  query: Schema.String.annotate({ description: 'Search query string' }).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
  table: Schema.String.annotate({ description: 'Table name to search' }).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
  fields: optionalField(
    Schema.Array(Schema.String.pipe(Schema.check(Schema.isMinLength(1))))
      .annotate({ description: 'Specific fields to search (defaults to all indexed fields)' })
      .pipe(Schema.check(Schema.isMinLength(1)))
  ),
  engine: optionalField(
    searchEngineEnum.annotate({ description: 'Search engine override (defaults to client)' })
  ),
  limit: optionalField(
    Schema.Int.annotate({ description: 'Maximum results to return' }).pipe(
      Schema.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(200))
    )
  ),
  offset: optionalField(
    Schema.Int.annotate({ description: 'Pagination offset' }).pipe(
      Schema.check(Schema.isGreaterThanOrEqualTo(0))
    )
  ),
  highlight: optionalField(
    Schema.Boolean.annotate({ description: 'Return highlight snippets for matched terms' })
  ),
})

// ---------------------------------------------------------------------------
// Search result item schema
// ---------------------------------------------------------------------------

/**
 * A single search result with optional relevance score and highlights.
 */
export const searchResultItemSchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Record primary key' }),
  score: optionalField(
    Schema.Finite.annotate({ description: 'Relevance score (FTS/hybrid engine only)' })
  ),
  highlights: optionalField(
    Schema.Record(Schema.String, Schema.String).annotate({
      description: 'Map of field name to highlighted snippet with <mark> tags',
    })
  ),
  record: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'Full or partial record data',
  }),
})

// ---------------------------------------------------------------------------
// Search response schema
// ---------------------------------------------------------------------------

/**
 * Search response schema for the search API endpoint.
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API response validation
 * - Hono RPC client type inference
 */
export const searchResponseSchema = Schema.Struct({
  results: Schema.Array(searchResultItemSchema).annotate({ description: 'Matching records' }),
  total: Schema.Int.annotate({ description: 'Total number of matching records' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  query: Schema.String.annotate({ description: 'Echo of the search query' }),
  engine: searchEngineEnum.annotate({ description: 'Engine that was used for the query' }),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type SearchRequest = typeof searchRequestSchema.Type
export type SearchResultItem = typeof searchResultItemSchema.Type
export type SearchResponse = typeof searchResponseSchema.Type
