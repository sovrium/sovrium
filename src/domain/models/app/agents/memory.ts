/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

const KnowledgeMemorySchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Whether knowledge memory is enabled (default: false)' })
    )
  ),

  sources: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.minLength(1),
        Schema.annotations({ description: 'Knowledge source name' })
      )
    ).pipe(
      Schema.annotations({
        description: 'Knowledge source names to search (must reference configured knowledge bases)',
      })
    )
  ),

  retrievalLimit: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum number of documents to retrieve per query (default: 5)',
      })
    )
  ),

  similarityThreshold: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(1),
      Schema.annotations({
        description: 'Minimum similarity score (0-1) for retrieved documents (default: 0.7)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'KnowledgeMemory',
    title: 'Knowledge Memory',
    description: 'RAG-based semantic retrieval from configured knowledge sources via pgvector',
  })
)

const FactsMemorySchema = Schema.Struct({
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Whether facts memory is enabled (default: false)' })
    )
  ),

  maxFacts: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum number of facts the agent can store (default: 100)',
      })
    )
  ),

  namespace: Schema.optional(
    Schema.String.pipe(
      Schema.pattern(/^[a-z][a-z0-9-]*$/),
      Schema.annotations({
        description: 'Namespace for fact isolation (default: agent name)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'FactsMemory',
    title: 'Facts Memory',
    description:
      'Persistent AI-managed key-value facts learned across sessions, retrieved by semantic relevance',
  })
)

export const AgentMemorySchema = Schema.Struct({
  knowledge: Schema.optional(KnowledgeMemorySchema),

  facts: Schema.optional(FactsMemorySchema),
}).pipe(
  Schema.annotations({
    identifier: 'AgentMemory',
    title: 'Agent Memory',
    description: 'Memory configuration for an AI agent: knowledge retrieval and learned facts',
  })
)

export type AgentMemory = Schema.Schema.Type<typeof AgentMemorySchema>
