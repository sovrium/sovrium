/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

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
      Schema.annotate({
        defaultNote: 'false',
        description: 'Whether knowledge memory is enabled',
      })
    )
  ),

  /** Knowledge source names to search (must reference configured knowledge bases) */
  sources: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.annotate({ description: 'Knowledge source name' }),
        Schema.check(Schema.isMinLength(1))
      )
    ).pipe(
      Schema.annotate({
        description: 'Knowledge source names to search (must reference configured knowledge bases)',
      })
    )
  ),

  /** Maximum number of documents to retrieve per query (default: 5) */
  retrievalLimit: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: '5',
        description: 'Maximum number of documents to retrieve per query',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),

  /** Minimum similarity score (0-1) for retrieved documents (default: 0.7) */
  similarityThreshold: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: '0.7',
        description: 'Minimum similarity score (0-1) a retrieved document must reach',
      }),
      Schema.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(1))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'KnowledgeMemory',
    title: 'Knowledge Memory',
    description:
      'RAG-based semantic retrieval from the configured knowledge sources. Vectors are stored by the active database — a pgvector column on PostgreSQL, a packed float blob on SQLite.',
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
      Schema.annotate({
        defaultNote: 'false',
        description: 'Whether facts memory is enabled',
      })
    )
  ),

  /** Maximum number of facts the agent can store (default: 100) */
  maxFacts: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: '100',
        description: 'Maximum number of facts the agent can store',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),

  /** Namespace for fact isolation (default: agent name) */
  namespace: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: 'the agent name',
        description: "Namespace that isolates this agent's facts from every other agent's",
      }),
      Schema.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'FactsMemory',
    title: 'Facts Memory',
    description:
      'Persistent AI-managed key-value facts learned across sessions, retrieved by semantic relevance',
  })
)

/**
 * AgentMemorySchema defines the memory configuration for an AI agent.
 *
 * Two memory tiers provide increasing levels of persistence:
 * - `knowledge`: RAG-based retrieval from configured knowledge sources (read-only)
 * - `facts`: Persistent learned facts across sessions (read-write, AI-managed)
 *
 * Both tiers are optional and disabled by default. When the `ai:agent` automation
 * action dispatches a task, the runtime assembles context from enabled memory
 * tiers before invoking the LLM.
 *
 * Session-level chat history is NOT configured here: it is durable and
 * operator-tuned, keyed on `(userId, sessionId)` and capped by the
 * `AI_MEMORY_CONTEXT_MESSAGES` environment variable.
 */
export const AgentMemorySchema = Schema.Struct({
  /** RAG-based knowledge retrieval from configured sources */
  knowledge: Schema.optional(KnowledgeMemorySchema),

  /** Persistent AI-managed facts learned across sessions */
  facts: Schema.optional(FactsMemorySchema),
}).pipe(
  Schema.annotate({
    identifier: 'AgentMemory',
    title: 'Agent Memory',
    description: 'Memory configuration for an AI agent: knowledge retrieval and learned facts',
  })
)

/** @public */
export type AgentMemory = Schema.Schema.Type<typeof AgentMemorySchema>
