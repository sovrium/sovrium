/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// RAG rebuild request schema
// ---------------------------------------------------------------------------

/**
 * Request schema for the knowledge base rebuild endpoint.
 *
 * Used for:
 * - OpenAPI documentation generation
 * - Runtime API request validation via @hono/zod-validator
 */
export const ragRebuildRequestSchema = Schema.Struct({
  agent: optionalField(
    Schema.String.annotate({
      description: 'Agent name to rebuild knowledge for (rebuilds all agents if omitted)',
    })
  ),
})

// ---------------------------------------------------------------------------
// RAG rebuild stats schema
// ---------------------------------------------------------------------------

/**
 * Statistics returned after a knowledge base rebuild.
 */
export const ragRebuildStatsSchema = Schema.Struct({
  tables: Schema.Record(Schema.String, Schema.Int).annotate({
    description: 'Map of table name to number of chunks generated',
  }),
  documents: Schema.Record(Schema.String, Schema.Int).annotate({
    description: 'Map of document path to number of chunks generated',
  }),
  totalChunks: Schema.Int.annotate({
    description: 'Total number of chunks across all sources',
  }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  duration: Schema.Finite.annotate({ description: 'Rebuild duration in milliseconds' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
})

// ---------------------------------------------------------------------------
// RAG rebuild response schema
// ---------------------------------------------------------------------------

/**
 * Response schema for the knowledge base rebuild endpoint.
 */
export const ragRebuildResponseSchema = Schema.Struct({
  status: Schema.Literals(['completed', 'failed']).annotate({
    description: 'Whether the rebuild completed successfully',
  }),
  agent: optionalField(
    Schema.String.annotate({ description: 'Agent name that was rebuilt (absent if all agents)' })
  ),
  stats: ragRebuildStatsSchema.annotate({ description: 'Rebuild statistics' }),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type RagRebuildRequest = typeof ragRebuildRequestSchema.Type
export type RagRebuildStats = typeof ragRebuildStatsSchema.Type
export type RagRebuildResponse = typeof ragRebuildResponseSchema.Type
