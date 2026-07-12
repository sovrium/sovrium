/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import {
  BuildAgentConversations,
  BuildAgentConversationDetail,
} from '@/application/use-cases/admin/agent-conversations'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { agentConversationsListQuerySchema } from '@/domain/models/api/admin/agents/conversations'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { provideAdminAgentConversationsLive } from '@/presentation/api/routes/admin/agents/effect-runner'
import { hasAgent } from '@/presentation/api/routes/agents/agent-lookup'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

const NOT_FOUND = { success: false, message: 'Not found', code: 'NOT_FOUND' } as const
const INTERNAL_ERROR = {
  success: false,
  message: 'Internal error',
  code: 'INTERNAL_ERROR',
} as const
const BAD_REQUEST = {
  success: false,
  message: 'Invalid query parameters',
  code: 'BAD_REQUEST',
} as const

async function handleListConversations(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const name = c.req.param('name')
  if (!name || !hasAgent(app, name)) return c.json(NOT_FOUND, 404)

  const parsedQuery = agentConversationsListQuerySchema.safeParse({
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
    from: c.req.query('from'),
    to: c.req.query('to'),
  })
  if (!parsedQuery.success) {
    return c.json(BAD_REQUEST, 400)
  }
  const { cursor, limit, from, to } = parsedQuery.data

  const program = BuildAgentConversations({
    agentName: name,
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
    limit,
  })

  const result = await Effect.runPromise(
    program.pipe(provideAdminAgentConversationsLive, Effect.either)
  )
  if (result._tag === 'Left') {
    console.error('[admin] agent conversation-list lookup failed', result.left)
    return c.json(INTERNAL_ERROR, 500)
  }
  if (result.right._tag === 'ValidationFailed') {
    console.error('[admin] agent conversation-list response validation failed', result.right.error)
    return c.json(INTERNAL_ERROR, 500)
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AGENT_CONVERSATION_LIST_QUERIED,
    actor,
    resourceId: name,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(result.right.body, 200)
}

async function handleConversationDetail(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const name = c.req.param('name')
  const id = c.req.param('id')
  if (!name || !hasAgent(app, name)) return c.json(NOT_FOUND, 404)
  if (!id) return c.json(NOT_FOUND, 404)

  const program = BuildAgentConversationDetail(name, id)
  const result = await Effect.runPromise(
    program.pipe(provideAdminAgentConversationsLive, Effect.either)
  )
  if (result._tag === 'Left') {
    console.error('[admin] agent conversation-detail lookup failed', result.left)
    return c.json(INTERNAL_ERROR, 500)
  }
  if (result.right._tag === 'NotFound') {
    return c.json(NOT_FOUND, 404)
  }
  if (result.right._tag === 'ValidationFailed') {
    console.error(
      '[admin] agent conversation-detail response validation failed',
      result.right.error
    )
    return c.json(INTERNAL_ERROR, 500)
  }

  const actor = await resolveActor(session.userId)
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AGENT_CONVERSATION_DETAIL_QUERIED,
    actor,
    resourceId: id,
    severity: 'info',
    result: 'success',
  })

  c.header('Cache-Control', 'no-store')
  return c.json(result.right.body, 200)
}

export function chainAdminAgentsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp
    .get('/api/admin/agents/:name/conversations/:id', (c) =>
      handleConversationDetail(c, resolveApp())
    )
    .get('/api/admin/agents/:name/conversations', (c) =>
      handleListConversations(c, resolveApp())
    ) as T
}
