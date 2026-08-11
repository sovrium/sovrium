/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  AiMemoryRepository,
  type AiMemoryConversationSummary,
  type AiMemoryDatabaseError,
  type AiMemoryMessage,
} from '@/application/ports/repositories/ai/ai-memory-repository'

/**
 * Application use-cases for durable AI chat memory
 *.
 *
 * Each function is an `Effect.gen` program orchestrating the
 * `AiMemoryRepository` port — the presentation layer consumes them via
 * `Effect.runPromise`, the infrastructure layer supplies the live Drizzle
 * implementation. No direct database access happens here.
 */

/**
 * Persist a completed user/assistant chat exchange to durable storage,
 * upserting the conversation thread for `(userId, sessionId)`.
 */
export const persistChatTurn = (input: {
  readonly userId: string
  readonly sessionId: string
  readonly userMessage: string
  readonly assistantReply: string
  readonly agentName?: string
  readonly model?: string
}): Effect.Effect<void, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    yield* repo.recordTurn(input)
  })

/**
 * Load the persisted message history for a `(userId, sessionId)` thread, in
 * chronological order. Drives both the context-injection of prior turns
 * and the `GET /api/ai/conversations/:sessionId`
 * endpoint.
 */
export const loadChatHistory = (input: {
  readonly userId: string
  readonly sessionId: string
}): Effect.Effect<ReadonlyArray<AiMemoryMessage>, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    return yield* repo.getHistory(input)
  })

/**
 * List the conversation threads owned by a user, most-recently-updated
 * first.
 */
export const listUserConversations = (input: {
  readonly userId: string
}): Effect.Effect<
  ReadonlyArray<AiMemoryConversationSummary>,
  AiMemoryDatabaseError,
  AiMemoryRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    return yield* repo.listConversations(input)
  })

/**
 * Delete a conversation thread and (by ON DELETE CASCADE) all its messages
 *.
 */
export const deleteUserConversation = (input: {
  readonly userId: string
  readonly sessionId: string
}): Effect.Effect<void, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    yield* repo.deleteConversation(input)
  })

/**
 * Apply the retention policy: delete every conversation owned by `userId`
 * whose `updatedAt` is older than `maxAgeDays` days.
 * Returns the number of threads removed.
 */
export const enforceRetentionPolicy = (input: {
  readonly userId: string
  readonly maxAgeDays: number
}): Effect.Effect<number, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    return yield* repo.purgeExpired(input)
  })
