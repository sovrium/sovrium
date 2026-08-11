/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Durable AI chat-memory glue for the `/api/ai/chat` route
 *.
 *
 * Bridges the chat handlers in `ai-chat.ts` to the `AiMemoryRepository`
 * use-cases: loading prior turns for context injection, persisting completed
 * turns, and applying the `AI_MEMORY_MAX_AGE_DAYS` retention sweep. Extracted
 * into its own module so `ai-chat.ts` stays under the `max-lines` cap.
 *
 * Every function is best-effort — a persistence failure yields an empty
 * result rather than breaking the chat turn — and is skipped for the
 * defensive sessionless `anonymous` case, which keeps only the in-memory
 * conversation store.
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

/**
 * Resolve the operator-tunable `AI_MEMORY_CONTEXT_MESSAGES` cap — the maximum
 * number of prior persisted messages injected into the AI context window
 *. Unset / unparseable → no extra cap beyond the
 * in-memory store's own window.
 */
const resolveMemoryContextLimit = (): number | undefined => {
  const raw = process.env.AI_MEMORY_CONTEXT_MESSAGES
  if (raw === undefined) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * Resolve the operator-tunable `AI_MEMORY_MAX_AGE_DAYS` retention window — the
 * maximum age (in days) a conversation thread is kept before the retention
 * sweep deletes it. Unset / unparseable → retention off.
 */
const resolveMemoryMaxAgeDays = (): number | undefined => {
  const raw = process.env.AI_MEMORY_MAX_AGE_DAYS
  if (raw === undefined) return undefined
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * Load the durable conversation history for a `(userId, sessionId)` thread
 * from `system.ai_conversations` / `system.ai_messages`, projected onto the
 * OpenAI chat-completion message shape. Best-effort — a persistence failure
 * yields the in-memory history rather than breaking the turn. Falls back to
 * the in-memory store for the defensive `anonymous` (sessionless) case.
 *
 * Honours `AI_MEMORY_CONTEXT_MESSAGES` by keeping only the most recent N
 * messages.
 */
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

/**
 * Apply the `AI_MEMORY_MAX_AGE_DAYS` retention policy for a user. Best-effort
 * — invoked at the start of every chat turn so stale conversations are swept
 * lazily without a separate scheduler. A failure here is
 * swallowed so it never breaks the chat turn.
 */
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

/**
 * Persist a completed user/assistant exchange to durable PostgreSQL storage.
 * Best-effort — a persistence failure is swallowed so it never breaks the
 * chat turn (mirrors the activity-log side effect's discipline). Skipped for
 * the defensive sessionless `anonymous` case, which keeps only the in-memory
 * store.
 */
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

/**
 * Persist a completed agent-bound user/assistant exchange, tagging the
 * conversation row with `agentName` so agent threads are distinguished from
 * generic chat turns in the conversation list. Best-effort
 * and `anonymous`-skipped, exactly like {@link persistTurnDurably}.
 */
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
