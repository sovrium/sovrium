/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// RAG similarity search request schema
// ---------------------------------------------------------------------------

/**
 * Request schema for the RAG similarity search endpoint (`POST /api/ai/rag/search`).
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API request validation via @hono/zod-validator
 */
export const ragSearchRequestSchema = Schema.Struct({
  query: Schema.String.annotate({
    description: 'Natural-language query to embed and match against the knowledge base',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  agent: optionalField(
    Schema.String.annotate({
      description: 'Agent name to scope the search to (searches all agents if omitted)',
    })
  ),
})

export type RagSearchRequest = typeof ragSearchRequestSchema.Type

// ---------------------------------------------------------------------------
// RAG similarity search result schemas
// ---------------------------------------------------------------------------

/** A single pgvector cosine-similarity match returned by the search endpoint. */
export const ragSearchResultSchema = Schema.Struct({
  agentName: Schema.String.annotate({
    description: 'Name of the agent the matched knowledge belongs to',
  }),
  sourceRef: Schema.String.annotate({
    description: 'Reference to the source document or table record',
  }),
  content: Schema.String.annotate({ description: 'The matched knowledge chunk content' }),
  similarity: Schema.Finite.annotate({
    description: 'Cosine similarity score in the range 0..1 (higher is more relevant)',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1))),
})

export type RagSearchResult = typeof ragSearchResultSchema.Type

/**
 * Response schema for the RAG similarity search endpoint.
 *
 * On a provider or database failure the endpoint degrades gracefully and
 * returns an empty `results` array rather than a 5xx error.
 */
export const ragSearchResponseSchema = Schema.Struct({
  results: Schema.Array(ragSearchResultSchema).annotate({
    description: 'Matched knowledge chunks ordered by descending similarity',
  }),
})

export type RagSearchResponse = typeof ragSearchResponseSchema.Type
