/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * In-memory conversation store for the signed-out callers of the generic
 * `/api/ai/chat` endpoint — an app without `auth`, where every caller is
 * `anonymous`. A signed-in caller's history is the durable conversation store
 * (`chat-durable-memory.ts`); nothing of hers is kept here.
 *
 * A chat turn that reuses an earlier `sessionId` carries the prior
 * user/assistant messages forward so the provider sees the conversation, not
 * just the latest message. The `sessionId` is the client's own label, so it
 * only picks a conversation WITHIN a browser: the history is keyed by a
 * random id the server hands that browser in an HttpOnly cookie
 * ({@link VISITOR_COOKIE_NAME}). Another browser naming the same `sessionId`
 * holds another id, and so reads a conversation of its own — empty.
 *
 * The store is module-level and process-local, like the multi-step form draft
 * store: chat history is conversational working memory, not durable data, and
 * a fresh process legitimately starts with empty history. A bounded window
 * (`MAX_TURNS`) caps each conversation's growth, and `MAX_CONVERSATIONS` caps
 * how many it holds.
 */

import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'

/** A single conversation message in OpenAI chat-completion shape. */
export interface ConversationMessage {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/**
 * Maximum number of user+assistant message pairs retained per conversation.
 * Older turns are evicted FIFO so the prompt sent to the provider stays bounded.
 */
const MAX_TURNS = 20

/**
 * Maximum number of conversations the store holds at once. Signed-out chat is
 * open to anyone on an app without `auth`, and every new browser or
 * `sessionId` opens a conversation, so without a bound the process would keep
 * them all until it restarts. Past it, the conversation used least recently
 * goes first; it then simply starts over, as after a restart.
 */
export const MAX_CONVERSATIONS = 1000

/** The cookie naming a signed-out browser's own conversations. */
export const VISITOR_COOKIE_NAME = 'sovrium_chat_visitor'

/** 32 random bytes, base64url: what the server mints, and all it accepts back. */
const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/

/** Module-level history store, keyed by {@link conversationKey}. */
const conversations = new Map<string, ReadonlyArray<ConversationMessage>>()

/**
 * The id minted for a request that arrived without one, so the turn's read and
 * its write — one request, before the browser has the cookie — agree.
 */
const mintedThisRequest = new WeakMap<Request, string>()

const mintVisitorId = (): string =>
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')

/**
 * The calling browser's visitor id: the one its cookie carries when it is one
 * the server could have minted, otherwise a fresh one, set as a session cookie
 * scoped to the AI routes.
 */
const visitorIdOf = (c: Context): string => {
  const sent = getCookie(c, VISITOR_COOKIE_NAME)
  if (sent !== undefined && VISITOR_ID_PATTERN.test(sent)) return sent
  const minted = mintedThisRequest.get(c.req.raw)
  if (minted !== undefined) return minted
  const fresh = mintVisitorId()
  mintedThisRequest.set(c.req.raw, fresh)
  setCookie(c, VISITOR_COOKIE_NAME, fresh, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/api/ai',
  })
  return fresh
}

const conversationKey = (c: Context, sessionId: string): string => `${visitorIdOf(c)}\n${sessionId}`

/** The prefix a signed-out caller's key carries, beside her browser's id. */
const ANONYMOUS_CALLER_PREFIX = 'anonymous:'

/**
 * Whose a chat turn is, for the state a turn keeps while it runs (its stop
 * signal): a signed-in caller's user id, or a signed-out caller's browser —
 * minted now if the request carries none, so the browser receives it with the
 * answer.
 */
export const chatCallerKey = (c: Context, userId: string): string =>
  userId === 'anonymous' ? `${ANONYMOUS_CALLER_PREFIX}${visitorIdOf(c)}` : userId

/**
 * {@link chatCallerKey} without minting: `undefined` for a signed-out request
 * whose browser carries no id the server could have minted — a browser that
 * started no turn, so there is nothing of hers to find.
 */
export const sentChatCallerKey = (c: Context, userId: string): string | undefined => {
  if (userId !== 'anonymous') return userId
  const sent = getCookie(c, VISITOR_COOKIE_NAME)
  return sent !== undefined && VISITOR_ID_PATTERN.test(sent)
    ? `${ANONYMOUS_CALLER_PREFIX}${sent}`
    : undefined
}

/**
 * The calling browser's earlier messages in the conversation `sessionId` names
 * (empty when it has none there).
 */
export const getConversationHistory = (
  c: Context,
  sessionId: string
): ReadonlyArray<ConversationMessage> => {
  const key = conversationKey(c, sessionId)
  const history = conversations.get(key)
  if (history === undefined) return []
  // Read is use: move it to the newest end, so eviction takes the idlest one.
  conversations.delete(key)
  conversations.set(key, history)
  return history
}

/**
 * Append a completed user/assistant exchange to a signed-out caller's
 * conversation, trimming to the most recent {@link MAX_TURNS} pairs. A
 * signed-in caller's turn is kept by the durable store instead, so it is not
 * recorded here.
 */
export const appendConversationTurn = (
  c: Context,
  thread: { readonly actorName: string; readonly sessionId: string },
  userMessage: string,
  assistantReply: string
): void => {
  if (thread.actorName !== 'anonymous') return
  const key = conversationKey(c, thread.sessionId)
  const previous = conversations.get(key) ?? []
  const next: ReadonlyArray<ConversationMessage> = [
    ...previous,
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantReply },
  ]
  const trimmed = next.length > MAX_TURNS * 2 ? next.slice(next.length - MAX_TURNS * 2) : next
  // Re-inserted at the newest end; past the bound, the least recently used goes.
  conversations.delete(key)
  conversations.set(key, trimmed)
  if (conversations.size > MAX_CONVERSATIONS) {
    const idlest = conversations.keys().next().value
    if (idlest !== undefined) conversations.delete(idlest)
  }
}
