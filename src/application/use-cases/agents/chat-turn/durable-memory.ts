/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The durable memory of a chat turn: the history it replays, the exchange it
 * writes, and the retention sweep it runs first.
 *
 * Each step is best-effort: a store that cannot be read or written leaves the
 * turn answering, never failing, and the cause is logged. Each is skipped for
 * the defensive sessionless `anonymous` caller, whose conversation lives only
 * in the in-memory store.
 */

import { Effect } from 'effect'
import {
  enforceRetentionPolicy,
  loadChatHistory,
  persistChatTurn,
} from '@/application/use-cases/ai/conversation-memory'
import { logError } from '@/infrastructure/logging/logger'
import type {
  AiMemoryMessage,
  AiMemoryRepository,
  AiMessageElicitation,
  AiMessagePart,
} from '@/application/ports/repositories/ai/ai-memory-repository'
import type { ChatAttachmentRepository } from '@/application/ports/repositories/ai/chat-attachment-repository'
import type { StorageService } from '@/application/ports/services/storage-service'
import type { StoredToolCall } from '@/domain/models/app/agents/stored-tool-call-service'

/** The signed-out caller with no session, who keeps no durable memory. */
const ANONYMOUS = 'anonymous'

/** One conversation thread: whose, and which session. */
export interface ChatThread {
  readonly userId: string
  readonly sessionId: string
}

/** One completed exchange, as it is written to durable memory. */
export interface ChatTurnToPersist extends ChatThread {
  readonly userMessage: string
  readonly assistantReply: string
  readonly agentName?: string
  /** The question the reply asked, for a turn saved while paused on it. */
  readonly assistantElicitation?: AiMessageElicitation
  /** What the reply's turn ran, one line per call — never its arguments or result. */
  readonly assistantToolCalls?: ReadonlyArray<StoredToolCall>
  /** The message the turn follows, for a turn asked on a branch other than the current one. */
  readonly parentId?: string | undefined
  /** The ids the question and the answer are written under, when the caller already told them. */
  readonly ids?: { readonly question: string; readonly answer: string } | undefined
  /** The question's parts, for a message sent as parts: references only. */
  readonly userParts?: ReadonlyArray<AiMessagePart> | undefined
}

/**
 * The questions and answers stored for a thread, from
 * `system.ai_conversations` / `system.ai_messages`, in order. A history that
 * cannot be read is recalled as none — logged with its cause — so the turn
 * answers without it rather than failing.
 */
export const recallDurableHistory = Effect.fn('agents.chat.recall-durable-history')(function* (
  thread: ChatThread
): Effect.fn.Return<ReadonlyArray<AiMemoryMessage>, never, AiMemoryRepository> {
  if (thread.userId === ANONYMOUS) return []
  const stored = yield* loadChatHistory(thread).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[ai-chat] loading the conversation history failed; none is replayed', cause)
      })
    ),
    // effect-swallow: the turn answers without its history rather than failing; the cause is logged above.
    Effect.orElseSucceed((): ReadonlyArray<AiMemoryMessage> => [])
  )
  return stored.filter((m) => m.role === 'user' || m.role === 'assistant')
})

/**
 * Delete the caller's conversations older than `maxAgeDays`, lazily at the
 * start of a turn rather than on a scheduler. No window means retention is
 * off. A failed sweep is logged and never breaks the turn; the next one
 * retries.
 */
export const sweepExpiredConversations = Effect.fn('agents.chat.sweep-expired-conversations')(
  function* (input: {
    readonly userId: string
    readonly maxAgeDays: number | undefined
  }): Effect.fn.Return<
    void,
    never,
    AiMemoryRepository | ChatAttachmentRepository | StorageService
  > {
    const { userId, maxAgeDays } = input
    if (userId === ANONYMOUS || maxAgeDays === undefined) return
    yield* enforceRetentionPolicy({ userId, maxAgeDays }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => logError('[ai-chat] the conversation retention sweep failed', cause))
      ),
      // effect-swallow: logged above; a failed sweep never breaks the turn, and the next one retries
      Effect.result,
      Effect.asVoid
    )
  }
)

/**
 * Write a completed exchange to durable memory, tagging the conversation with
 * the agent that answered when there is one. The single writer for every
 * transport: attribution is an optional field of one writer, so a turn bound
 * to an agent is attributed whichever route carried it. A failed write never
 * breaks the turn.
 */
export const rememberChatTurn = Effect.fn('agents.chat.remember-turn')(function* (
  turn: ChatTurnToPersist
): Effect.fn.Return<void, never, AiMemoryRepository> {
  if (turn.userId === ANONYMOUS) return
  yield* persistChatTurn(turn).pipe(
    // effect-swallow: the answer is already given; an exchange that cannot be written leaves the conversation without it, never the turn failing.
    Effect.result,
    Effect.asVoid
  )
})
