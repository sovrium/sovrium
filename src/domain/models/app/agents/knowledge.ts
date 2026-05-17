/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ─── Knowledge Table Filter ──────────────────────────────────────────────────

/**
 * Filter conditions for knowledge table rows.
 *
 * Simple key-value equality filters that determine which table rows
 * are included in the embedding pipeline.
 *
 * @example
 * ```typescript
 * { status: 'published' }
 * ```
 */
const KnowledgeTableFilterSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).pipe(
  Schema.annotations({
    identifier: 'KnowledgeTableFilter',
    title: 'Knowledge Table Filter',
    description: 'Key-value filter conditions for knowledge table rows',
  })
)

// ─── Knowledge Table ─────────────────────────────────────────────────────────

/**
 * Table data source configuration for agent knowledge embedding.
 *
 * Defines which table and fields to embed for RAG-based retrieval.
 * Only text-like fields should be specified (single-line-text, long-text,
 * rich-text, markdown).
 *
 * @example
 * ```typescript
 * { table: 'faq', fields: ['question', 'answer'] }
 * { table: 'docs', fields: ['content'], filter: { status: 'published' } }
 * ```
 */
const KnowledgeTableSchema = Schema.Struct({
  /** Table name to embed (must reference a table defined in app.tables) */
  table: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Table name to embed for knowledge retrieval',
    })
  ),

  /** Field names to include in embeddings (at least one required) */
  fields: Schema.Array(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({ description: 'Field name to include in embedding' })
    )
  ).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Fields to embed from this table',
    })
  ),

  /** Optional filter to limit which rows are embedded */
  filter: Schema.optional(KnowledgeTableFilterSchema),
}).pipe(
  Schema.annotations({
    identifier: 'KnowledgeTable',
    title: 'Knowledge Table',
    description: 'Table data source configuration for agent knowledge embedding',
  })
)

/** @public */
export type KnowledgeTable = Schema.Schema.Type<typeof KnowledgeTableSchema>

// ─── Knowledge Document ──────────────────────────────────────────────────────

/**
 * Document file data source for agent knowledge embedding.
 *
 * Points to a document file (PDF, text, etc.) that should be embedded
 * for RAG-based retrieval by the agent.
 *
 * @example
 * ```typescript
 * { path: '/knowledge/product-manual.pdf', label: 'Product Manual' }
 * ```
 */
const KnowledgeDocumentSchema = Schema.Struct({
  /** File path to the document */
  path: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      description: 'Path to the document file for knowledge embedding',
    })
  ),

  /** Human-readable label for the document */
  label: Schema.optional(
    Schema.String.pipe(
      Schema.minLength(1),
      Schema.annotations({
        description: 'Human-readable label for the knowledge document',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'KnowledgeDocument',
    title: 'Knowledge Document',
    description: 'Document file data source for agent knowledge embedding',
  })
)

/** @public */
export type KnowledgeDocument = Schema.Schema.Type<typeof KnowledgeDocumentSchema>

// ─── Agent Knowledge ─────────────────────────────────────────────────────────

/**
 * Knowledge configuration defining what data sources to embed for RAG-based retrieval.
 *
 * Distinct from `memory.knowledge` which configures runtime retrieval behavior.
 * This schema defines the *input* data sources (tables and documents) that are
 * processed through the embedding pipeline and made available for semantic search.
 *
 * @example
 * ```typescript
 * {
 *   tables: [
 *     { table: 'faq', fields: ['question', 'answer'] },
 *     { table: 'docs', fields: ['content'], filter: { status: 'published' } }
 *   ],
 *   documents: [
 *     { path: '/knowledge/manual.pdf', label: 'Product Manual' }
 *   ]
 * }
 * ```
 */
export const AgentKnowledgeSchema = Schema.Struct({
  /** Table data sources to embed */
  tables: Schema.optional(
    Schema.Array(KnowledgeTableSchema).pipe(
      Schema.annotations({
        description: 'Table data sources for knowledge embedding',
      })
    )
  ),

  /** Document file sources to embed */
  documents: Schema.optional(
    Schema.Array(KnowledgeDocumentSchema).pipe(
      Schema.annotations({
        description: 'Document file sources for knowledge embedding',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'AgentKnowledge',
    title: 'Agent Knowledge',
    description:
      'Knowledge configuration defining what data sources to embed for RAG-based retrieval.',
  })
)

/** @public */
export type AgentKnowledge = Schema.Schema.Type<typeof AgentKnowledgeSchema>
