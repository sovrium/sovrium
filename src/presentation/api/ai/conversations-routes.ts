/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  deleteUserConversation,
  listUserConversations,
  loadChatHistory,
} from '@/application/use-cases/ai/conversation-memory'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { logError } from '@/infrastructure/logging/logger'
import { requireDomainContext, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import type { Hono, Context } from 'hono'

/**
 * AI Conversation history routes:
 *
 *  - `GET    /api/ai/conversations`            — paginated list of the
 *    authenticated user's conversation threads (an AI memory spec).
 *  - `GET    /api/ai/conversations/:sessionId` — all messages in one thread.
 *  - `DELETE /api/ai/conversations/:sessionId` — delete a thread and (by
 *    ON DELETE CASCADE) all its messages.
 *
 * All three are scoped by the acting user's id, so a caller can only ever
 * see or delete their own conversations. Auth is enforced by the
 * `authMiddleware + requireAuth` chain installed in `api-routes.ts`.
 */

/** Resolve the authenticated user's id, or undefined when no session. */
const resolveUserId = (c: Context): string | undefined => {
  const session = getSessionContext(c)
  return session?.userId
}

/** GET /api/ai/conversations — list the user's conversation threads. */
const handleListConversations = async (c: Context): Promise<Response> => {
  const userId = resolveUserId(c)
  if (userId === undefined) {
    return c.json(
      errorBody({ error: 'Authentication required.', code: ApiErrorCode.UNAUTHORIZED }),
      401
    )
  }
  const result = await runRequestEffect(
    c,
    listUserConversations({ userId }).pipe(Effect.provide(requireDomainContext(c)), Effect.result)
  )
  if (result._tag === 'Failure') {
    logError('[ai] list-conversations failed', result.failure)
    return c.json(
      errorBody({ error: 'Failed to load conversations.', code: ApiErrorCode.INTERNAL_ERROR }),
      500
    )
  }
  const conversations = result.success.map((conv) => ({
    sessionId: conv.sessionId,
    title: conv.title,
    agentName: conv.agentName,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
  }))
  return c.json({ conversations, total: conversations.length }, 200)
}

/** GET /api/ai/conversations/:sessionId — all messages in one thread. */
const handleGetConversation = async (c: Context): Promise<Response> => {
  const userId = resolveUserId(c)
  if (userId === undefined) {
    return c.json(
      errorBody({ error: 'Authentication required.', code: ApiErrorCode.UNAUTHORIZED }),
      401
    )
  }
  const sessionId = c.req.param('sessionId')
  if (sessionId === undefined || sessionId.length === 0) {
    return notFound(c, 'Conversation not found.')
  }
  const result = await runRequestEffect(
    c,
    loadChatHistory({ userId, sessionId }).pipe(
      Effect.provide(requireDomainContext(c)),
      Effect.result
    )
  )
  if (result._tag === 'Failure') {
    logError('[ai] get-conversation failed', result.failure)
    return c.json(
      errorBody({ error: 'Failed to load conversation.', code: ApiErrorCode.INTERNAL_ERROR }),
      500
    )
  }
  if (result.success.length === 0) {
    return notFound(c, 'Conversation not found.')
  }
  const messages = result.success.map((msg) => ({
    role: msg.role,
    content: msg.content,
    status: msg.status,
    createdAt: msg.createdAt.toISOString(),
  }))
  return c.json({ sessionId, messages }, 200)
}

/** DELETE /api/ai/conversations/:sessionId — delete a thread + its messages. */
const handleDeleteConversation = async (c: Context): Promise<Response> => {
  const userId = resolveUserId(c)
  if (userId === undefined) {
    return c.json(
      errorBody({ error: 'Authentication required.', code: ApiErrorCode.UNAUTHORIZED }),
      401
    )
  }
  const sessionId = c.req.param('sessionId')
  if (sessionId === undefined || sessionId.length === 0) {
    return notFound(c, 'Conversation not found.')
  }
  const result = await runRequestEffect(
    c,
    deleteUserConversation({ userId, sessionId }).pipe(
      Effect.provide(requireDomainContext(c)),
      Effect.result
    )
  )
  if (result._tag === 'Failure') {
    logError('[ai] delete-conversation failed', result.failure)
    return c.json(
      errorBody({ error: 'Failed to delete conversation.', code: ApiErrorCode.INTERNAL_ERROR }),
      500
    )
  }
  // A thread the caller does not own answers as one that does not exist (S1).
  if (!result.success) return notFound(c, 'Conversation not found.')
  return c.json({ deleted: true, sessionId }, 200)
}

/**
 * Chain the AI conversation-history routes onto the given Hono app. Always
 * registered — the handlers themselves return 401 when no session is present.
 */
export function chainAiConversationRoutes(honoApp: Hono): Hono {
  return honoApp
    .get('/api/ai/conversations', (c) => handleListConversations(c))
    .get('/api/ai/conversations/:sessionId', (c) => handleGetConversation(c))
    .delete('/api/ai/conversations/:sessionId', (c) => handleDeleteConversation(c))
}
