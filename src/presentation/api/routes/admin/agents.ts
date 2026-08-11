/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin read endpoints for the **Agents Conversations** family (the ChatGPT-style
 * conversation-history viewer that backs `/_admin/data/agents`):
 *
 *   - GET /api/admin/agents/:name/conversations      — cursor-paginated list,
 *     newest-first by `lastActivityAt`, optional `from`/`to` date window.
 *   - GET /api/admin/agents/:name/conversations/:id  — a single conversation's
 *     header + chronologically-ordered message transcript.
 *
 * Both read `system.ai_conversations` + `system.ai_messages` CROSS-USER and
 * AGENT-SCOPED (by the `agent_name` column). Both emit exactly ONE
 * `agent.conversation.{list|detail}.queried` audit-log entry on success, with
 * the canonical `resource.type === 'agent'` (derived by the emit use-case from
 * the action catalog — NOT `agent.conversation`).
 *
 * Auth gating is wired upstream by `requireAdminTier()` on the
 * `/api/admin/agents/*` wildcard in `infrastructure/server/route-setup/
 * api-routes.ts`, which 404s both missing-session and wrong-role callers (S1
 * anti-enumeration). These handlers add only the per-agent anti-enum 404 (an
 * undeclared agent is not an enumerable resource — `hasAgent` gate), the
 * cross-agent conversation-ownership 404, and the success path.
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
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideAdminAgentConversationsLive } from '@/presentation/api/routes/admin/agents/effect-runner'
import { hasAgent } from '@/presentation/api/routes/agents/agent-lookup'
import { requestLogAttributes } from '@/presentation/api/utils/context-helpers'
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

/**
 * GET /api/admin/agents/:name/conversations handler — the cursor-paginated
 * conversation list.
 */
async function handleListConversations(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const name = c.req.param('name')
  if (!name || !hasAgent(app, name)) return c.json(NOT_FOUND, 404)

  // Parse the cursor/limit/from/to knobs. Defaults are applied by the schema
  // (limit=50). An invalid date bound or out-of-range limit → 400.
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

  const result = await runRequestEffect(
    c,
    program.pipe(provideAdminAgentConversationsLive, Effect.either)
  )
  if (result._tag === 'Left') {
    logError('[admin] agent conversation-list lookup failed', result.left, requestLogAttributes(c))
    return c.json(INTERNAL_ERROR, 500)
  }
  if (result.right._tag === 'ValidationFailed') {
    logError(
      '[admin] agent conversation-list response validation failed',
      result.right.error,
      requestLogAttributes(c)
    )
    return c.json(INTERNAL_ERROR, 500)
  }

  // Emit one audit entry per call (canonical resource.type 'agent' — derived by
  // the emit use-case from the ACTION_CATALOG entry for the list action).
  const actor = await resolveActor(session.userId)
  // eslint-disable-next-line functional/no-expression-statements -- audit-log side effect; emit funnels through the use-case so the catalog lookup runs
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

/**
 * GET /api/admin/agents/:name/conversations/:id handler — the conversation
 * header + chronological message transcript.
 */
async function handleConversationDetail(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const name = c.req.param('name')
  const id = c.req.param('id')
  if (!name || !hasAgent(app, name)) return c.json(NOT_FOUND, 404)
  if (!id) return c.json(NOT_FOUND, 404)

  const program = BuildAgentConversationDetail(name, id)
  const result = await runRequestEffect(
    c,
    program.pipe(provideAdminAgentConversationsLive, Effect.either)
  )
  if (result._tag === 'Left') {
    logError(
      '[admin] agent conversation-detail lookup failed',
      result.left,
      requestLogAttributes(c)
    )
    return c.json(INTERNAL_ERROR, 500)
  }
  // Cross-agent / non-existent conversation → anti-enum 404 (no audit emit on a
  // miss — only successful reads are audited).
  if (result.right._tag === 'NotFound') {
    return c.json(NOT_FOUND, 404)
  }
  if (result.right._tag === 'ValidationFailed') {
    logError(
      '[admin] agent conversation-detail response validation failed',
      result.right.error,
      requestLogAttributes(c)
    )
    return c.json(INTERNAL_ERROR, 500)
  }

  // Emit one audit entry per call (canonical resource.type 'agent').
  const actor = await resolveActor(session.userId)
  // eslint-disable-next-line functional/no-expression-statements -- audit-log side effect; emit funnels through the use-case so the catalog lookup runs
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

/**
 * Chain the admin/agents conversation routes onto a Hono app.
 *
 * Auth gating is wired upstream in `createApiRoutes` (authMiddleware +
 * requireAdminTier on `/api/admin/agents/*`). The handlers resolve the live App
 * via the `resolveApp` thunk so a `POST /draft/publish` (which swaps the live App
 * without a restart) is reflected in agent resolution.
 *
 * Order matters — the more-specific `/conversations/:id` path is registered
 * before the bare `/conversations` path so Hono routes the detail request to the
 * detail handler (Hono routes by registration order for `.get` overlaps).
 */
export function chainAdminAgentsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp
    .get('/api/admin/agents/:name/conversations/:id', (c) =>
      handleConversationDetail(c, resolveApp())
    )
    .get('/api/admin/agents/:name/conversations', (c) =>
      handleListConversations(c, resolveApp())
    ) as T
}
