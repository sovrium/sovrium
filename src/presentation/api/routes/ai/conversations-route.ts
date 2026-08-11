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
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideAiMemoryRepoLive } from '@/presentation/api/routes/ai/effect-runner'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Hono, Context } from 'hono'

/**
 * AI Conversation history routes:
 *
 *  - `GET    /api/ai/conversations`            — paginated list of the
 * authenticated user's conversation threads.
 *  - `GET    /api/ai/conversations/:sessionId` — all messages in one thread
 *.
 *  - `DELETE /api/ai/conversations/:sessionId` — delete a thread and (by
 * ON DELETE CASCADE) all its messages.
 *
 * All three are scoped by the acting user's id, so a caller can only ever
 * see or delete their own conversations. Auth is enforced by the
 * `authMiddleware + requireAuth` chain installed in `api-routes.ts`.
 */

/** Resolve the authenticated user's id, or undefined when no session. */
const resolveUserId = (c: Readonly<Context>): string | undefined => {
  const session = getSessionContext(c as unknown as Context)
  return session?.userId
}

/** GET /api/ai/conversations — list the user's conversation threads. */
const handleListConversations = async (c: Readonly<Context>): Promise<Response> => {
  const userId = resolveUserId(c)
  if (userId === undefined) {
    return c.json({ error: 'Authentication required.' }, 401)
  }
  const result = await runRequestEffect(
    c,
    listUserConversations({ userId }).pipe(provideAiMemoryRepoLive, Effect.either)
  )
  if (result._tag === 'Left') {
    logError('[ai] list-conversations failed', result.left)
    return c.json({ error: 'Failed to load conversations.' }, 500)
  }
  const conversations = result.right.map((conv) => ({
    sessionId: conv.sessionId,
    title: conv.title,
    agentName: conv.agentName,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
  }))
  return c.json({ conversations, total: conversations.length }, 200)
}

/** GET /api/ai/conversations/:sessionId — all messages in one thread. */
const handleGetConversation = async (c: Readonly<Context>): Promise<Response> => {
  const userId = resolveUserId(c)
  if (userId === undefined) {
    return c.json({ error: 'Authentication required.' }, 401)
  }
  const sessionId = c.req.param('sessionId')
  if (sessionId === undefined || sessionId.length === 0) {
    return c.json({ error: 'Conversation not found.' }, 404)
  }
  const result = await runRequestEffect(
    c,
    loadChatHistory({ userId, sessionId }).pipe(provideAiMemoryRepoLive, Effect.either)
  )
  if (result._tag === 'Left') {
    logError('[ai] get-conversation failed', result.left)
    return c.json({ error: 'Failed to load conversation.' }, 500)
  }
  if (result.right.length === 0) {
    return c.json({ error: 'Conversation not found.' }, 404)
  }
  const messages = result.right.map((msg) => ({
    role: msg.role,
    content: msg.content,
    status: msg.status,
    createdAt: msg.createdAt.toISOString(),
  }))
  return c.json({ sessionId, messages }, 200)
}

/** DELETE /api/ai/conversations/:sessionId — delete a thread + its messages. */
const handleDeleteConversation = async (c: Readonly<Context>): Promise<Response> => {
  const userId = resolveUserId(c)
  if (userId === undefined) {
    return c.json({ error: 'Authentication required.' }, 401)
  }
  const sessionId = c.req.param('sessionId')
  if (sessionId === undefined || sessionId.length === 0) {
    return c.json({ error: 'Conversation not found.' }, 404)
  }
  const result = await runRequestEffect(
    c,
    deleteUserConversation({ userId, sessionId }).pipe(provideAiMemoryRepoLive, Effect.either)
  )
  if (result._tag === 'Left') {
    logError('[ai] delete-conversation failed', result.left)
    return c.json({ error: 'Failed to delete conversation.' }, 500)
  }
  return c.json({ deleted: true, sessionId }, 200)
}

/**
 * Chain the AI conversation-history routes onto the given Hono app. Always
 * registered — the handlers themselves return 401 when no session is present.
 */
export function chainAiConversationRoutes<T extends Hono>(honoApp: T): T {
  /* eslint-disable drizzle/enforce-delete-with-where -- Hono route registration, `.delete()` is a route verb not a Drizzle delete */
  return honoApp
    .get('/api/ai/conversations', (c) => handleListConversations(c as unknown as Readonly<Context>))
    .get('/api/ai/conversations/:sessionId', (c) =>
      handleGetConversation(c as unknown as Readonly<Context>)
    )
    .delete('/api/ai/conversations/:sessionId', (c) =>
      handleDeleteConversation(c as unknown as Readonly<Context>)
    ) as unknown as T
  /* eslint-enable drizzle/enforce-delete-with-where */
}
