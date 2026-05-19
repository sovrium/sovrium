/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import {
  enforceRetentionPolicy,
  loadChatHistory,
  persistChatTurn,
} from '@/application/use-cases/ai/conversation-memory'
import { getConversationHistory } from '@/presentation/api/routes/ai/chat-conversation-store'
import { provideAiMemoryRepoLive } from '@/presentation/api/routes/ai/effect-runner'
import type { ConversationMessage } from '@/presentation/api/routes/ai/chat-conversation-store'

const resolveMemoryContextLimit = (): number | undefined => {
  const raw = process.env.AI_MEMORY_CONTEXT_MESSAGES
  if (raw === undefined) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const resolveMemoryMaxAgeDays = (): number | undefined => {
  const raw = process.env.AI_MEMORY_MAX_AGE_DAYS
  if (raw === undefined) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export const loadDurableHistory = async (
  userId: string,
  sessionId: string
): Promise<ReadonlyArray<ConversationMessage>> => {
  if (userId === 'anonymous') return getConversationHistory(sessionId)
  const result = await Effect.runPromise(
    loadChatHistory({ userId, sessionId }).pipe(provideAiMemoryRepoLive, Effect.either)
  )
  if (result._tag === 'Left') return getConversationHistory(sessionId)
  const all: ReadonlyArray<ConversationMessage> = result.right
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as ConversationMessage['role'], content: m.content }))
  const limit = resolveMemoryContextLimit()
  return limit !== undefined && all.length > limit ? all.slice(all.length - limit) : all
}

export const applyRetentionPolicy = async (userId: string): Promise<void> => {
  if (userId === 'anonymous') return
  const maxAgeDays = resolveMemoryMaxAgeDays()
  if (maxAgeDays === undefined) return
  return Effect.runPromise(
    enforceRetentionPolicy({ userId, maxAgeDays }).pipe(
      provideAiMemoryRepoLive,
      Effect.either,
      Effect.asVoid
    )
  )
}

export const persistTurnDurably = async (
  userId: string,
  sessionId: string,
  userMessage: string,
  assistantReply: string
): Promise<void> => {
  if (userId === 'anonymous') return
  return Effect.runPromise(
    persistChatTurn({ userId, sessionId, userMessage, assistantReply }).pipe(
      provideAiMemoryRepoLive,
      Effect.either,
      Effect.asVoid
    )
  )
}

export const persistAgentTurnDurably = async (input: {
  readonly userId: string
  readonly sessionId: string
  readonly userMessage: string
  readonly assistantReply: string
  readonly agentName: string
}): Promise<void> => {
  if (input.userId === 'anonymous') return
  return Effect.runPromise(
    persistChatTurn(input).pipe(provideAiMemoryRepoLive, Effect.either, Effect.asVoid)
  )
}
