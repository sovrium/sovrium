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
import { provideAiMemoryRepoLive } from '@/presentation/api/routes/ai/effect-runner'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { Hono, Context } from 'hono'


const resolveUserId = (c: Readonly<Context>): string | undefined => {
  const session = getSessionContext(c as unknown as Context)
  return session?.userId
}

const handleListConversations = async (c: Readonly<Context>): Promise<Response> => {
  const userId = resolveUserId(c)
  if (userId === undefined) {
    return c.json({ error: 'Authentication required.' }, 401)
  }
  const result = await Effect.runPromise(
    listUserConversations({ userId }).pipe(provideAiMemoryRepoLive, Effect.either)
  )
  if (result._tag === 'Left') {
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

const handleGetConversation = async (c: Readonly<Context>): Promise<Response> => {
  const userId = resolveUserId(c)
  if (userId === undefined) {
    return c.json({ error: 'Authentication required.' }, 401)
  }
  const sessionId = c.req.param('sessionId')
  if (sessionId === undefined || sessionId.length === 0) {
    return c.json({ error: 'Conversation not found.' }, 404)
  }
  const result = await Effect.runPromise(
    loadChatHistory({ userId, sessionId }).pipe(provideAiMemoryRepoLive, Effect.either)
  )
  if (result._tag === 'Left') {
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

const handleDeleteConversation = async (c: Readonly<Context>): Promise<Response> => {
  const userId = resolveUserId(c)
  if (userId === undefined) {
    return c.json({ error: 'Authentication required.' }, 401)
  }
  const sessionId = c.req.param('sessionId')
  if (sessionId === undefined || sessionId.length === 0) {
    return c.json({ error: 'Conversation not found.' }, 404)
  }
  const result = await Effect.runPromise(
    deleteUserConversation({ userId, sessionId }).pipe(provideAiMemoryRepoLive, Effect.either)
  )
  if (result._tag === 'Left') {
    return c.json({ error: 'Failed to delete conversation.' }, 500)
  }
  return c.json({ deleted: true, sessionId }, 200)
}

export function chainAiConversationRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/ai/conversations', (c) => handleListConversations(c as unknown as Readonly<Context>))
    .get('/api/ai/conversations/:sessionId', (c) =>
      handleGetConversation(c as unknown as Readonly<Context>)
    )
    .delete('/api/ai/conversations/:sessionId', (c) =>
      handleDeleteConversation(c as unknown as Readonly<Context>)
    ) as unknown as T
}
