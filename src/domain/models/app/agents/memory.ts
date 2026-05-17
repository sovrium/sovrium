/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Conversation memory — retains recent messages from the agent's session.
 *
 * When enabled, the runtime loads the last `windowSize` messages into context
 * before each agent invocation. If `summarize` is true, older messages are
 * compressed into a summary rather than dropped entirely.
 */
const ConversationMemorySchema = Schema.Struct({
  /** Whether conversation memory is enabled (default: false) */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Whether conversation memory is enabled (default: false)' })
    )
  ),

  /** Number of recent messages to keep in context (default: 10) */
  windowSize: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Number of recent messages to keep in context (default: 10)',
      })
    )
  ),

  /** Compress older messages into a summary instead of dropping them (default: false) */
  summarize: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description:
          'Compress older messages into a summary instead of dropping them (default: false)',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ConversationMemory',
    title: 'Conversation Memory',
    description: 'Session-level message history for maintaining conversational context',
  })
)

/**
 * Knowledge memory — RAG-based semantic retrieval from configured sources.
 *
 * When enabled, the runtime performs a similarity search against the listed
 * knowledge sources before each agent invocation, injecting the most relevant
 * documents into context. Reuses the existing pgvector/RAG pipeline.
 */
const KnowledgeMemorySchema = Schema.Struct({
  /** Whether knowledge memory is enabled (default: false) */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Whether knowledge memory is enabled (default: false)' })
    )
  ),

  /** Knowledge source names to search (must reference configured knowledge bases) */
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

  /** Maximum number of documents to retrieve per query (default: 5) */
  retrievalLimit: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum number of documents to retrieve per query (default: 5)',
      })
    )
  ),

  /** Minimum similarity score (0-1) for retrieved documents (default: 0.7) */
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

/**
 * Facts memory — persistent key-value facts the agent learns across sessions.
 *
 * Unlike the `state` automation action (explicit developer-set KV), facts are
 * AI-managed: the agent decides what to remember. Facts are retrieved by
 * semantic relevance to the current task, not by exact key lookup.
 */
const FactsMemorySchema = Schema.Struct({
  /** Whether facts memory is enabled (default: false) */
  enabled: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({ description: 'Whether facts memory is enabled (default: false)' })
    )
  ),

  /** Maximum number of facts the agent can store (default: 100) */
  maxFacts: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.annotations({
        description: 'Maximum number of facts the agent can store (default: 100)',
      })
    )
  ),

  /** Namespace for fact isolation (default: agent name) */
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

/**
 * AgentMemorySchema defines the memory configuration for an AI agent.
 *
 * Three memory tiers provide increasing levels of persistence:
 * - `conversation`: Session-level message history (ephemeral, window-based)
 * - `knowledge`: RAG-based retrieval from configured knowledge sources (read-only)
 * - `facts`: Persistent learned facts across sessions (read-write, AI-managed)
 *
 * All tiers are optional and disabled by default. When the `ai:agent` automation
 * action dispatches a task, the runtime assembles context from enabled memory
 * tiers before invoking the LLM.
 */
export const AgentMemorySchema = Schema.Struct({
  /** Session-level conversation history */
  conversation: Schema.optional(ConversationMemorySchema),

  /** RAG-based knowledge retrieval from configured sources */
  knowledge: Schema.optional(KnowledgeMemorySchema),

  /** Persistent AI-managed facts learned across sessions */
  facts: Schema.optional(FactsMemorySchema),
}).pipe(
  Schema.annotations({
    identifier: 'AgentMemory',
    title: 'Agent Memory',
    description:
      'Memory configuration for an AI agent: conversation history, knowledge retrieval, and learned facts',
  })
)

/** @public */
export type AgentMemory = Schema.Schema.Type<typeof AgentMemorySchema>
