/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class AiMemoryDatabaseError extends Data.TaggedError('AiMemoryDatabaseError')<{
  readonly cause: unknown
}> {}

export interface AiMemoryMessage {
  readonly role: string
  readonly content: string
  readonly status: string
  readonly createdAt: Date
}

export interface AiMemoryConversationSummary {
  readonly id: string
  readonly sessionId: string | null
  readonly title: string | null
  readonly agentName: string | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export class AiMemoryRepository extends Context.Tag('AiMemoryRepository')<
  AiMemoryRepository,
  {
    readonly recordTurn: (input: {
      readonly userId: string
      readonly sessionId: string
      readonly userMessage: string
      readonly assistantReply: string
      readonly agentName?: string
      readonly model?: string
    }) => Effect.Effect<void, AiMemoryDatabaseError>
    readonly getHistory: (input: {
      readonly userId: string
      readonly sessionId: string
    }) => Effect.Effect<ReadonlyArray<AiMemoryMessage>, AiMemoryDatabaseError>
    readonly listConversations: (input: {
      readonly userId: string
    }) => Effect.Effect<ReadonlyArray<AiMemoryConversationSummary>, AiMemoryDatabaseError>
    readonly deleteConversation: (input: {
      readonly userId: string
      readonly sessionId: string
    }) => Effect.Effect<void, AiMemoryDatabaseError>
    readonly purgeExpired: (input: {
      readonly userId: string
      readonly maxAgeDays: number
    }) => Effect.Effect<number, AiMemoryDatabaseError>
  }
>() {}
