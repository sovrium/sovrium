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

export const loadChatHistory = (input: {
  readonly userId: string
  readonly sessionId: string
}): Effect.Effect<ReadonlyArray<AiMemoryMessage>, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    return yield* repo.getHistory(input)
  })

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

export const deleteUserConversation = (input: {
  readonly userId: string
  readonly sessionId: string
}): Effect.Effect<void, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    yield* repo.deleteConversation(input)
  })

export const enforceRetentionPolicy = (input: {
  readonly userId: string
  readonly maxAgeDays: number
}): Effect.Effect<number, AiMemoryDatabaseError, AiMemoryRepository> =>
  Effect.gen(function* () {
    const repo = yield* AiMemoryRepository
    return yield* repo.purgeExpired(input)
  })
