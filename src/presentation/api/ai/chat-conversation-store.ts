/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-memory per-session conversation store for the generic `/api/ai/chat`
 * endpoint.
 *
 * Drives [internal ref]: a chat turn that reuses an earlier
 * `sessionId` must carry the prior user/assistant messages forward so the AI
 * provider sees the full conversation context (not just the latest message).
 *
 * The store is a module-level `Map<sessionId, Message[]>` — the same discipline
 * as `webhook-rate-limit.ts` and the multi-step form draft store. It is
 * deliberately process-local and ephemeral: chat history is conversational
 * working memory, not durable data, and a fresh process legitimately starts
 * with empty history. A bounded window (`MAX_TURNS`) caps memory growth so a
 * long-running conversation cannot leak unboundedly.
 */

/** A single conversation message in OpenAI chat-completion shape. */
export interface ConversationMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/**
 * Maximum number of user+assistant message pairs retained per session. Older
 * turns are evicted FIFO so the prompt sent to the provider stays bounded.
 */
const MAX_TURNS = 20

/** Module-level history store, keyed by the caller-supplied `sessionId`. */
const conversations = new Map<string, ReadonlyArray<ConversationMessage>>()

/**
 * Return the recorded message history for a session (empty when the session
 * has no prior turns).
 */
export const getConversationHistory = (sessionId: string): ReadonlyArray<ConversationMessage> =>
  conversations.get(sessionId) ?? []

/**
 * Append a completed user/assistant exchange to a session's history, trimming
 * to the most recent {@link MAX_TURNS} pairs.
 */
export const appendConversationTurn = (
  sessionId: string,
  userMessage: string,
  assistantReply: string
): void => {
  const previous = conversations.get(sessionId) ?? []
  const next: ReadonlyArray<ConversationMessage> = [
    ...previous,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantReply },
  ]
  const trimmed = next.length > MAX_TURNS * 2 ? next.slice(next.length - MAX_TURNS * 2) : next
  // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- module-local mutable Map, mirrors webhook-rate-limit.ts pattern
  conversations.set(sessionId, trimmed)
}
