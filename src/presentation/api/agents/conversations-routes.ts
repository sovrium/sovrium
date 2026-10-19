/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  deleteConversationAttachments,
  findOwnedChatAttachments,
} from '@/application/use-cases/ai/chat-attachments'
import {
  deleteUserConversation,
  listUserConversations,
  loadConversationTree,
} from '@/application/use-cases/ai/conversation-memory'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import {
  branchThrough,
  currentBranch,
} from '@/domain/models/app/agents/conversation-branch-service'
import { logError } from '@/infrastructure/logging/logger'
import { requireDomainContext, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { toWireMessages } from './conversation-wire'
import type {
  ConversationDetailResponse,
  ConversationListResponse,
} from '@/domain/models/api/ai/conversations'
import type { Hono, Context } from 'hono'

/**
 * AI Conversation history routes:
 *
 *  - `GET    /api/ai/conversations`            — the authenticated user's
 *    conversation threads, newest activity first, one page at a time
 *    (`?limit`, `?offset`), optionally one agent's (`?agent`): the window's
 *    conversation switcher.
 *  - `GET    /api/ai/conversations/:sessionId` — one branch of a thread: the
 *    current one, or the one through `?branch=<messageId>`.
 *  - `DELETE /api/ai/conversations/:sessionId` — delete a thread and (by
 *    ON DELETE CASCADE) all its messages, and hard-delete the files sent in it.
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

/** Default and largest page of the conversation list. */
const DEFAULT_PAGE = 50
const MAX_PAGE = 100

/**
 * A non-negative integer query parameter, or `fallback` when absent or
 * malformed — a value past the safe integers included, which the database
 * would refuse as a bigint.
 */
const intParam = (raw: string | undefined, fallback: number): number => {
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback
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
  const agent = c.req.query('agent')
  const limit = Math.min(Math.max(intParam(c.req.query('limit'), DEFAULT_PAGE), 1), MAX_PAGE)
  const offset = intParam(c.req.query('offset'), 0)
  const result = await runRequestEffect(
    c,
    listUserConversations({
      userId,
      limit,
      offset,
      ...(agent !== undefined && agent !== '' && { agentName: agent }),
    }).pipe(Effect.provide(requireDomainContext(c)), Effect.result)
  )
  if (result._tag === 'Failure') {
    logError('[ai] list-conversations failed', result.failure)
    return c.json(
      errorBody({ error: 'Failed to load conversations.', code: ApiErrorCode.INTERNAL_ERROR }),
      500
    )
  }
  const body: ConversationListResponse = {
    conversations: result.success.conversations.map((conv) => ({
      sessionId: conv.sessionId ?? '',
      title: conv.title,
      agentName: conv.agentName,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    })),
    total: result.success.total,
  }
  return c.json(body, 200)
}

/**
 * GET /api/ai/conversations/:sessionId — one branch of a thread: the current
 * one, or with `?branch=<messageId>` the one running through that message.
 */
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
    Effect.gen(function* () {
      const thread = yield* loadConversationTree({ userId, sessionId })
      const tree = thread?.messages ?? []
      // The caller's own uploads its messages name, to give each its name and type.
      const ids = tree.flatMap((message) =>
        (message.parts ?? []).flatMap((part) => (part.type === 'text' ? [] : [part.attachmentId]))
      )
      const uploads = yield* findOwnedChatAttachments({ userId, ids })
      return { tree, uploads }
    }).pipe(Effect.provide(requireDomainContext(c)), Effect.result)
  )
  if (result._tag === 'Failure') {
    logError('[ai] get-conversation failed', result.failure)
    return c.json(
      errorBody({ error: 'Failed to load conversation.', code: ApiErrorCode.INTERNAL_ERROR }),
      500
    )
  }
  const { tree, uploads } = result.success
  const through = c.req.query('branch')
  const branch = through === undefined ? currentBranch(tree) : branchThrough(tree, through)
  if (branch === undefined || branch.length === 0) {
    return notFound(c, 'Conversation not found.')
  }
  const messages = await runRequestEffect(c, toWireMessages(tree, branch, uploads))
  const body: ConversationDetailResponse = { sessionId, messages: [...messages] }
  return c.json(body, 200)
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
    Effect.all([
      deleteUserConversation({ userId, sessionId }),
      // The files sent in the thread go with it, bytes and rows (GDPR Art. 17).
      deleteConversationAttachments({ userId, sessionId }),
    ]).pipe(Effect.provide(requireDomainContext(c)), Effect.result)
  )
  if (result._tag === 'Failure') {
    logError('[ai] delete-conversation failed', result.failure)
    return c.json(
      errorBody({ error: 'Failed to delete conversation.', code: ApiErrorCode.INTERNAL_ERROR }),
      500
    )
  }
  // A thread the caller does not own answers as one that does not exist (S1).
  const [threadDeleted, attachmentsDeleted] = result.success
  if (!threadDeleted && attachmentsDeleted === 0) return notFound(c, 'Conversation not found.')
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
