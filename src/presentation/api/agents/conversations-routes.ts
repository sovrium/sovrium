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
import {
  conversationDeletedResponseSchema,
  conversationDetailResponseSchema,
  conversationListResponseSchema,
} from '@/domain/models/api/ai/conversations'
import { ApiErrorCode } from '@/domain/models/api/error'
import {
  branchThrough,
  currentBranch,
} from '@/domain/models/app/agents/conversation-branch-service'
import { hasCodeRoleClasses } from '@/domain/models/app/design/code-block-service'
import { logError } from '@/infrastructure/logging/logger'
import { errorBody, notFound } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { respondWith, runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import { toWireMessages } from './conversation-wire'
import type {
  ConversationDetailResponse,
  ConversationListResponse,
} from '@/domain/models/api/ai/conversations'
import type { App } from '@/domain/models/app'
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
 * `authMiddleware + requireAuth` chain installed in `middleware/api-auth-guards.ts`.
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
  const listed = listUserConversations({
    userId,
    limit,
    offset,
    ...(agent !== undefined && agent !== '' && { agentName: agent }),
  })
  return runHandlerEffect(
    c,
    Effect.match(listed, {
      onFailure: (failure) => {
        logError('[ai] list-conversations failed', failure)
        return c.json(
          errorBody({ error: 'Failed to load conversations.', code: ApiErrorCode.INTERNAL_ERROR }),
          500
        )
      },
      onSuccess: (page) => {
        const body: ConversationListResponse = {
          conversations: page.conversations.map((conv) => ({
            sessionId: conv.sessionId ?? '',
            title: conv.title,
            agentName: conv.agentName,
            createdAt: conv.createdAt.toISOString(),
            updatedAt: conv.updatedAt.toISOString(),
          })),
          total: page.total,
        }
        return shapedJson(c, body, conversationListResponseSchema)
      },
    })
  )
}

/**
 * GET /api/ai/conversations/:sessionId — one branch of a thread: the current
 * one, or with `?branch=<messageId>` the one running through that message.
 */
const handleGetConversation = async (c: Context, app: App | undefined): Promise<Response> => {
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
  return runHandlerEffect(c, conversationBranch(c, userId, sessionId, app))
}

/** The branch of the caller's thread `sessionId` the request asks, as its wire body. */
const conversationBranch = (c: Context, userId: string, sessionId: string, app: App | undefined) =>
  Effect.gen(function* () {
    const result = yield* Effect.result(
      Effect.gen(function* () {
        const thread = yield* loadConversationTree({ userId, sessionId })
        const tree = thread?.messages ?? []
        // The caller's own uploads its messages name, to give each its name and type.
        const ids = tree.flatMap((message) =>
          (message.parts ?? []).flatMap((part) => (part.type === 'text' ? [] : [part.attachmentId]))
        )
        const uploads = yield* findOwnedChatAttachments({ userId, ids })
        return { tree, uploads }
      })
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
    const messages = yield* toWireMessages(tree, branch, uploads, {
      roleClasses: hasCodeRoleClasses(app?.design),
    })
    const body: ConversationDetailResponse = { sessionId, messages: [...messages] }
    return yield* respondWith(c, Effect.succeed(body), conversationDetailResponseSchema)
  })

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
  const deleted = Effect.all([
    deleteUserConversation({ userId, sessionId }),
    // The files sent in the thread go with it, bytes and rows (GDPR Art. 17).
    deleteConversationAttachments({ userId, sessionId }),
  ])
  return runHandlerEffect(
    c,
    Effect.match(deleted, {
      onFailure: (failure) => {
        logError('[ai] delete-conversation failed', failure)
        return c.json(
          errorBody({ error: 'Failed to delete conversation.', code: ApiErrorCode.INTERNAL_ERROR }),
          500
        )
      },
      // A thread the caller does not own answers as one that does not exist (S1).
      onSuccess: ([threadDeleted, attachmentsDeleted]) =>
        !threadDeleted && attachmentsDeleted === 0
          ? notFound(c, 'Conversation not found.')
          : shapedJson(c, { deleted: true, sessionId }, conversationDeletedResponseSchema),
    })
  )
}

/**
 * Chain the AI conversation-history routes onto the given Hono app. Always
 * registered — the handlers themselves return 401 when no session is present.
 */
export function chainAiConversationRoutes(honoApp: Hono, app?: App): Hono {
  return honoApp
    .get('/api/ai/conversations', (c) => handleListConversations(c))
    .get('/api/ai/conversations/:sessionId', (c) => handleGetConversation(c, app))
    .delete('/api/ai/conversations/:sessionId', (c) => handleDeleteConversation(c))
}
