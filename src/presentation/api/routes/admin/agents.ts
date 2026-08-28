/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admin read endpoints for the **Agents** family (the agent index + the
 * ChatGPT-style conversation-history viewer that backs `/_admin/agents`):
 *
 *   - GET /api/admin/agents                          — the agent INDEX the
 *     sidebar's Conversations disclosure lazy-loads.
 *   - GET /api/admin/agents/:name/conversations      — cursor-paginated list,
 *     newest-first by `lastActivityAt`, optional `from`/`to` date window.
 *   - GET /api/admin/agents/:name/conversations/:id  — a single conversation's
 *     header + chronologically-ordered message transcript.
 *
 * The conversation reads hit `system.ai_conversations` + `system.ai_messages`
 * CROSS-USER and AGENT-SCOPED. Each of the three emits exactly ONE
 * `agent.{list|conversation.list|conversation.detail}.queried` audit-log entry
 * on success, with the canonical `resource.type === 'agent'` (derived by the
 * emit use-case from the action catalog — NOT `agent.conversation`).
 *
 * Auth gating is wired upstream by `requireAdminTier()` in
 * `infrastructure/server/route-setup/api-routes.ts`, which 404s both
 * missing-session and wrong-role callers (S1 anti-enumeration): the
 * `/api/admin/agents/*` wildcard covers the per-agent paths, and the trailing
 * `/api/admin/*` defence-in-depth guard covers the SEGMENT-LESS index (Hono's
 * `/*` needs at least one further segment). These handlers add only the
 * per-agent anti-enum 404 (a name outside `isConversationSourceAgent` is not an
 * enumerable resource), the cross-agent conversation-ownership 404, and the
 * success path.
 */

import { Effect } from 'effect'
import {
  BuildAgentConversations,
  BuildAgentConversationDetail,
} from '@/application/use-cases/admin/agent-conversations'
import { emitAuditEvent } from '@/application/use-cases/admin/audit-log/emit'
import { resolveActor } from '@/application/use-cases/admin/resolve-actor'
import { agentConversationsListQuerySchema } from '@/domain/models/api/admin/agents/conversations'
import { agentsListResponseSchema } from '@/domain/models/api/admin/agents/list'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import {
  DEFAULT_AGENT_NAME,
  declaredAgentNames,
  isConversationSourceAgent,
  isDefaultAgentName,
} from '@/domain/utils/agent-identity'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideAdminAgentConversationsLive } from '@/presentation/api/routes/admin/agents/effect-runner'
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
 * Parse the cursor/limit/from/to/q knobs. Defaults are applied by the schema
 * (limit=50). An invalid date bound, an out-of-range limit, or a search term
 * past the 200-character ceiling fails, so the caller answers 400 (rejected,
 * never truncated).
 *
 * The object literal is an explicit ALLOW-LIST, which is how `?q=` used to
 * vanish: Hono discards an unlisted query param silently, so the search was
 * accepted, ignored, and answered with the unfiltered page.
 */
const parseConversationsQuery = (
  c: Context
): ReturnType<typeof agentConversationsListQuerySchema.safeParse> =>
  agentConversationsListQuerySchema.safeParse({
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    q: c.req.query('q'),
  })

/**
 * Page the projected agent names with the same opaque-base64 cursor the buckets
 * index uses (`{ afterName }`). A malformed or stale cursor rewinds to the first
 * page rather than erroring — the token is an internal contract, so a caller has
 * no way to have "fixed" it, and answering 400 would only strand them.
 */
const encodeAgentCursor = (afterName: string): string =>
  Buffer.from(JSON.stringify({ afterName }), 'utf8').toString('base64')

const decodeAgentCursor = (cursor: string, names: ReadonlyArray<string>): number => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly afterName?: unknown
    }
    if (typeof decoded.afterName !== 'string') return 0
    const index = names.indexOf(decoded.afterName)
    return index === -1 ? 0 : index + 1
  } catch {
    return 0
  }
}

/** Read the `?limit` knob (default 50, clamped to the shared 1..200 ceiling). */
const parseAgentsLimit = (c: Context): number => {
  const raw = Number(c.req.query('limit') ?? '50')
  return Number.isFinite(raw) && raw >= 1 && raw <= 200 ? raw : 50
}

/**
 * GET /api/admin/agents handler — the agent INDEX the sidebar's Conversations
 * disclosure lazy-loads.
 *
 * The enumerated set comes from `declaredAgentNames`, the SAME projection
 * `buildDataAgentsPage` builds its page from. That shared projection is the
 * point of the endpoint: the sidebar's object list is an HTTP read while the
 * page is built from config, and two independent enumerations are exactly how
 * the disclosure came to render "No items." beside a page that had agents.
 */
async function handleListAgents(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const names = declaredAgentNames(app.agents)
  const items = names.map((name) => ({ name, isDefault: isDefaultAgentName(name) }))

  const limit = parseAgentsLimit(c)
  const cursor = c.req.query('cursor')
  const startIndex = cursor ? decodeAgentCursor(cursor, names) : 0
  const page = items.slice(startIndex, startIndex + limit)
  const nextStart = startIndex + page.length
  const nextCursor =
    nextStart < items.length && page.length > 0
      ? encodeAgentCursor(page[page.length - 1]!.name)
      : // eslint-disable-next-line unicorn/no-null -- `cursorPaginationResponseSchema` types `nextCursor` as `string | null`; `undefined` would drop the key from the JSON body and break the shared envelope
        null

  const parsed = agentsListResponseSchema.safeParse({ items: page, nextCursor })
  if (!parsed.success) {
    logError('[admin] agent list response validation failed', parsed.error, requestLogAttributes(c))
    return c.json(INTERNAL_ERROR, 500)
  }

  // Emit one audit entry per call (canonical resource.type 'agent' — derived by
  // the emit use-case from the ACTION_CATALOG entry for the list action).
  const actor = await resolveActor(session.userId)
  // eslint-disable-next-line functional/no-expression-statements -- audit-log side effect; emit funnels through the use-case so the catalog lookup runs
  await emitAuditEvent({
    action: AUDIT_ACTIONS.AGENT_LIST_QUERIED,
    actor,
    resourceId: DEFAULT_AGENT_NAME,
    severity: 'info',
    result: 'success',
  })

  return c.json(parsed.data, 200)
}

/**
 * GET /api/admin/agents/:name/conversations handler — the cursor-paginated
 * conversation list.
 */
async function handleListConversations(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const name = c.req.param('name')
  if (!name || !isConversationSourceAgent(app.agents, name)) return c.json(NOT_FOUND, 404)

  const parsedQuery = parseConversationsQuery(c)
  if (!parsedQuery.success) {
    return c.json(BAD_REQUEST, 400)
  }
  const { cursor, limit, from, to, q } = parsedQuery.data

  const program = BuildAgentConversations({
    agentName: name,
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    ...(q !== undefined ? { q } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
    limit,
  })

  const result = await runRequestEffect(
    c,
    program.pipe(provideAdminAgentConversationsLive, Effect.result)
  )
  if (result._tag === 'Failure') {
    logError(
      '[admin] agent conversation-list lookup failed',
      result.failure,
      requestLogAttributes(c)
    )
    return c.json(INTERNAL_ERROR, 500)
  }
  if (result.success._tag === 'ValidationFailed') {
    logError(
      '[admin] agent conversation-list response validation failed',
      result.success.error,
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
  return c.json(result.success.body, 200)
}

/**
 * GET /api/admin/agents/:name/conversations/:id handler — the conversation
 * header + chronological message transcript.
 */
async function handleConversationDetail(c: Context, app: App): Promise<Response> {
  const session = (c as ContextWithSession).var.session!
  const name = c.req.param('name')
  const id = c.req.param('id')
  if (!name || !isConversationSourceAgent(app.agents, name)) return c.json(NOT_FOUND, 404)
  if (!id) return c.json(NOT_FOUND, 404)

  const program = BuildAgentConversationDetail(name, id)
  const result = await runRequestEffect(
    c,
    program.pipe(provideAdminAgentConversationsLive, Effect.result)
  )
  if (result._tag === 'Failure') {
    logError(
      '[admin] agent conversation-detail lookup failed',
      result.failure,
      requestLogAttributes(c)
    )
    return c.json(INTERNAL_ERROR, 500)
  }
  // Cross-agent / non-existent conversation → anti-enum 404 (no audit emit on a
  // miss — only successful reads are audited).
  if (result.success._tag === 'NotFound') {
    return c.json(NOT_FOUND, 404)
  }
  if (result.success._tag === 'ValidationFailed') {
    logError(
      '[admin] agent conversation-detail response validation failed',
      result.success.error,
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
  return c.json(result.success.body, 200)
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
 * detail handler (Hono routes by registration order for `.get` overlaps). The
 * SEGMENT-LESS index goes LAST for the same reason: it is the least specific
 * pattern here, and registering it ahead of the two per-agent paths would let it
 * shadow them.
 */
export function chainAdminAgentsRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp
    .get('/api/admin/agents/:name/conversations/:id', (c) =>
      handleConversationDetail(c, resolveApp())
    )
    .get('/api/admin/agents/:name/conversations', (c) => handleListConversations(c, resolveApp()))
    .get('/api/admin/agents', (c) => handleListAgents(c, resolveApp())) as T
}
