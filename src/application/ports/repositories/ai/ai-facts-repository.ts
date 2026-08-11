/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for AI facts-memory operations.
 *
 * Wraps any failure raised while reading or writing the `system.ai_facts`
 * table. The agent-chat route treats fact extraction as best-effort — a
 * failure here never breaks the chat turn — so this error is normally caught
 * and discarded at the call site.
 */
export class AiFactsDatabaseError extends Data.TaggedError('AiFactsDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * A single learned fact (port-level shape).
 *
 * Structurally compatible with the Drizzle `ai_facts` row inference but
 * declared here so the application layer never imports from infrastructure.
 */
export interface AiFact {
  readonly fact: string
  readonly namespace: string
  readonly agentName: string
  readonly userId: string
  readonly createdAt: Date
}

/**
 * AI Facts Repository Port.
 *
 * Backs persistent learned-facts memory:
 * `system.ai_facts` holds one row per atomic fact, scoped by `namespace`
 * (declared on the agent's `memory.facts.namespace`), `agentName`, and
 * `userId` so facts never leak across namespaces or users.
 *
 * `storeFact` appends a fact and enforces the per-namespace `maxFacts` cap
 * FIFO (oldest by `created_at` evicted). `recallFacts` reads back the facts
 * for a `(namespace, userId)` pair — the per-user filter guarantees user X
 * never recalls user Y's facts even within a shared namespace.
 */
export class AiFactsRepository extends Context.Tag('AiFactsRepository')<
  AiFactsRepository,
  {
    /**
     * Persist a learned fact for `(namespace, agentName, userId)`, then evict
     * the oldest facts in the namespace until at most `maxFacts` remain.
     */
    readonly storeFact: (input: {
      readonly namespace: string
      readonly agentName: string
      readonly userId: string
      readonly fact: string
      readonly maxFacts: number
    }) => Effect.Effect<void, AiFactsDatabaseError>
    /**
     * Return the facts stored for a `(namespace, userId)` pair, oldest first.
     * Scoped per-user so a caller never recalls another user's facts even
     * within a shared namespace.
     */
    readonly recallFacts: (input: {
      readonly namespace: string
      readonly userId: string
    }) => Effect.Effect<ReadonlyArray<AiFact>, AiFactsDatabaseError>
  }
>() {}
