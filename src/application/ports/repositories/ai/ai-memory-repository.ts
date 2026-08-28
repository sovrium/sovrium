/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for AI memory operations.
 *
 * Wraps any failure raised while reading or writing the
 * `system.ai_conversations` / `system.ai_messages` tables. The chat route
 * treats persistence as best-effort — a failure here never breaks the chat
 * turn — so this error is normally caught and discarded at the call site.
 */
export class AiMemoryDatabaseError extends Data.TaggedError('AiMemoryDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * A single persisted chat message (port-level shape).
 *
 * Structurally compatible with the Drizzle `ai_messages` row inference but
 * declared here so the application layer never imports from infrastructure.
 */
export interface AiMemoryMessage {
  readonly role: string
  readonly content: string
  readonly status: string
  readonly createdAt: Date
}

/**
 * A conversation thread summary (port-level shape) for the list endpoint.
 */
export interface AiMemoryConversationSummary {
  readonly id: string
  readonly sessionId: string | null
  readonly title: string | null
  readonly agentName: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * AI Memory Repository Port.
 *
 * Backs durable chat persistence:
 * `system.ai_conversations` holds one row per `(userId, sessionId)` thread,
 * `system.ai_messages` holds every user/assistant message in chronological
 * order.
 *
 * `recordTurn` is the primary write primitive — it upserts the conversation
 * row for the session and appends the user + assistant message pair in a
 * single call. `appendMessage` persists a single message (used by the
 * streaming path, where the assistant message is only known once the stream
 * completes). All reads are scoped by `userId` so users only see their own
 * conversations.
 */
export class AiMemoryRepository extends Context.Service<
  AiMemoryRepository,
  {
    /**
     * Persist a completed user/assistant exchange. Upserts the conversation
     * row for `(userId, sessionId)` — creating it (and auto-deriving a title
     * from the first user message) on the first turn, bumping `updatedAt`
     * afterwards — then appends the user message and the assistant reply.
     */
    readonly recordTurn: (input: {
      readonly userId: string
      readonly sessionId: string
      readonly userMessage: string
      readonly assistantReply: string
      readonly agentName?: string
      readonly model?: string
    }) => Effect.Effect<void, AiMemoryDatabaseError>
    /**
     * Return the recorded message history for a `(userId, sessionId)` thread
     * in chronological order. Empty when the session has no prior turns.
     */
    readonly getHistory: (input: {
      readonly userId: string
      readonly sessionId: string
    }) => Effect.Effect<ReadonlyArray<AiMemoryMessage>, AiMemoryDatabaseError>
    /**
     * List the conversation threads owned by `userId`, most-recently-updated
     * first. Scoped per-user so a caller never sees another user's threads.
     */
    readonly listConversations: (input: {
      readonly userId: string
    }) => Effect.Effect<ReadonlyArray<AiMemoryConversationSummary>, AiMemoryDatabaseError>
    /**
     * Delete a conversation (and, by ON DELETE CASCADE, all its messages) for
     * a `(userId, sessionId)` pair. A no-op when no matching thread exists.
     */
    readonly deleteConversation: (input: {
      readonly userId: string
      readonly sessionId: string
    }) => Effect.Effect<void, AiMemoryDatabaseError>
    /**
     * Delete every conversation owned by `userId` whose `updatedAt` is older
     * than `maxAgeDays` days. Returns the number of threads removed. Drives
     * the `AI_MEMORY_MAX_AGE_DAYS` retention policy.
     */
    readonly purgeExpired: (input: {
      readonly userId: string
      readonly maxAgeDays: number
    }) => Effect.Effect<number, AiMemoryDatabaseError>
  }
>()('AiMemoryRepository') {}
