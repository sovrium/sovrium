/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'

// ---------------------------------------------------------------------------
// RAG rebuild request schema
// ---------------------------------------------------------------------------

/**
 * Request schema for the knowledge base rebuild endpoint.
 *
 * Publishes the request in the OpenAPI document; the handler reads the body itself.
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
// RAG configuration and status readback schemas
// ---------------------------------------------------------------------------

/** Response schema for `GET /api/ai/rag/config`. */
export const ragConfigResponseSchema = Schema.Struct({
  similarity: Schema.Finite.annotate({ description: 'Minimum cosine similarity of a match' }),
  maxResults: Schema.Int.annotate({ description: 'Maximum number of matches a search returns' }),
  chunkSize: Schema.Int.annotate({ description: 'Target size of a knowledge chunk' }),
  chunkOverlap: Schema.Int.annotate({ description: 'Overlap between neighbouring chunks' }),
  embeddingModel: Schema.String.annotate({ description: 'Model that computes the embeddings' }),
  dimensions: Schema.Int.annotate({ description: 'Width of an embedding vector' }),
})

/** Response schema for `GET /api/ai/rag/status`. */
export const ragStatusResponseSchema = Schema.Struct({
  documents: Schema.Array(
    Schema.Struct({
      path: Schema.String.annotate({ description: 'Path of the document in the knowledge folder' }),
    })
  ).annotate({ description: 'The knowledge documents the caller may read' }),
})

/** Response schema for `GET /api/ai/agents/:name/config`. */
export const agentKnowledgeConfigResponseSchema = Schema.Struct({
  name: Schema.String.annotate({ description: 'Agent name' }),
  knowledge: Schema.Struct({
    tables: Schema.Array(
      Schema.Struct({
        table: Schema.String.annotate({ description: 'Table the agent knows' }),
        fields: Schema.Array(Schema.String).annotate({ description: 'Fields it embeds' }),
        filter: optionalField(
          Schema.Record(Schema.String, Schema.Unknown).annotate({
            description: 'Conditions limiting which rows are embedded',
          })
        ),
      })
    ).annotate({ description: 'Table data sources, empty when none is declared' }),
    documents: Schema.Array(
      Schema.Struct({
        path: Schema.String.annotate({ description: 'Path of the document' }),
        label: optionalField(Schema.String.annotate({ description: 'Label of the document' })),
      })
    ).annotate({ description: 'Document data sources, empty when none is declared' }),
  }),
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type RagRebuildRequest = typeof ragRebuildRequestSchema.Type
export type RagRebuildStats = typeof ragRebuildStatsSchema.Type
export type RagRebuildResponse = typeof ragRebuildResponseSchema.Type
