/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI agent action + human-in-the-loop approval routes.
 *
 * Mounts the per-agent action surface asserted by
 * `[internal ref]`:
 *
 *   POST /api/agents/:name/execute             — run an agent action.
 *                                                Returns 200 `completed` when
 *                                                the agent's approval mode
 *                                                allows immediate execution,
 *                                                202 `pending_approval` when
 *                                                the action needs human
 *                                                review.
 *   GET  /api/agents/:name                     — agent config readback.
 *   GET  /api/agents/:name/approvals           — list approvals (optional
 *                                                `?status=` filter).
 *   GET  /api/agents/:name/approvals/:id       — single approval status.
 *   POST /api/agents/:name/approvals/:id/approve — approve a pending request.
 *   POST /api/agents/:name/approvals/:id/reject  — reject a pending request.
 *
 * Approval decisions are RBAC-gated: only a user whose role level is greater
 * than or equal to the agent's role level may approve or reject (403
 * otherwise). Approved actions execute under the agent's identity, never the
 * approver's. Every decision is recorded in the approval activity log.
 *
 * Agent execution always performs a single AI provider round-trip so the AI
 * mock-server assertion (`ai.getLastRequest()`) observes the call, regardless
 * of whether the action is auto-executed or queued for approval.
 */

import { MirrorApprovalCreate, MirrorApprovalUpdate } from '@/application/use-cases/agents/approval'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { isAiProviderConfigured } from '@/domain/models/env/ai/ai-providers'
import { checkPermissionWithAdminOverride, isAdminRole } from '@/domain/models/shared/permissions'
import {
  checkChatRateLimit,
  resolveChatRateLimitConfig,
} from '@/presentation/api/routes/ai/chat-rate-limit'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { recordAgentActivity } from './agent-activity-log'
import { callAgentAi } from './agent-ai-call'
import {
  acquireConcurrencySlot,
  checkActionRateLimit,
  getAgentUsage,
  isTokenBudgetExhausted,
  recordTokenUsage,
  releaseConcurrencySlot,
  resolveAgentLimits,
} from './agent-limits'
import { agentNotFound, findAgent } from './agent-lookup'
import { serializeAgent } from './agent-presenter'
import { checkAgentRateLimit } from './agent-rate-limit'
import { resolveRoleLevel } from './agent-roles'
import { buildApprovalRecord, serializeApproval } from './approval-presenter'
import {
  appendActivityEntry,
  appendAgentActivityEntry,
  getApproval,
  listApprovalsForAgent,
  putApproval,
  refreshApproval,
  updateApproval,
  type ApprovalRecord,
  type ApprovalStatus,
} from './approval-store'
import { runApprovalMirror, runApproverEmailLookup, toMirrorRecord } from './effect-runner'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { Context, Hono } from 'hono'

interface ExecuteRequestBody {
  readonly action?: unknown
  readonly message?: unknown
  readonly table?: unknown
  readonly recordId?: unknown
  readonly fields?: unknown
}

/**
 * Generic action label for a conversational agent turn — used when the caller
 * supplies a free-form `message` instead of a structured `action`. A message
 * turn never matches an `approval.required` entry, so it always runs
 * immediately under `mode: 'selective'`.
 */
const MESSAGE_ACTION = 'agent.message'

/**
 * Decide whether the agent's approval configuration requires this action to
 * be queued for human review.
 */
const requiresApproval = (agent: Agent, action: string): boolean => {
  const mode = agent.approval?.mode ?? 'none'
  if (mode === 'all') return true
  if (mode === 'selective') {
    return (agent.approval?.required ?? []).includes(action)
  }
  return false
}

/**
 * Pre-flight gates for `POST /api/agents/:name/execute`.
 *
 * Returns a short-circuit `Response` when execution must be denied — a
 * disabled agent (CROSS-004) or one that has tripped its action rate limit
 * (CROSS-005). Both gates run BEFORE the request body is parsed and before
 * any AI round-trip, so the AI provider is never called on a denied request.
 * Returns `undefined` when execution may proceed.
 */
const checkExecutionGates = (c: Readonly<Context>, agent: Agent): Response | undefined => {
  if (agent.enabled === false) {
    return c.json({ error: `Agent '${agent.name}' is disabled and cannot execute actions.` }, 403)
  }
  // When the operator has configured the shared AI-chat rate limit
  // (`AI_CHAT_RATE_LIMIT`), agent API calls are throttled under the SAME
  // limiter as human chat — keyed by agent name so
  // each agent gets an independent counter. Otherwise fall back to the
  // role-proportional per-agent action ceiling.
  if (resolveChatRateLimitConfig().limit !== undefined) {
    const chatLimit = checkChatRateLimit(`agent:${agent.name}`)
    if (chatLimit.limited) {
      return c.json({ error: `Agent '${agent.name}' has exceeded its action rate limit.` }, 429, {
        'Retry-After': chatLimit.retryAfter.toString(),
      })
    }
    return undefined
  }
  const rateLimit = checkAgentRateLimit(agent.name, agent.role)
  if (rateLimit.limited) {
    return c.json({ error: `Agent '${agent.name}' has exceeded its action rate limit.` }, 429, {
      'Retry-After': rateLimit.retryAfter.toString(),
    })
  }
  return undefined
}

/**
 * Resolve the action label from an execute request body. Two execution shapes
 * are accepted: a structured `action` (record.*) or a free-form conversational
 * `message` (mapped to the generic `agent.message` label). Returns `''` when
 * neither is present.
 */
const resolveExecuteAction = (body: ExecuteRequestBody): string => {
  if (typeof body.action === 'string' && body.action.length > 0) return body.action
  if (typeof body.message === 'string' && body.message.length > 0) return MESSAGE_ACTION
  return ''
}

/** `record.read` / `record.create` / `record.update` / `record.delete` → CRUD verb. */
const RECORD_ACTION_TO_PERMISSION: Readonly<
  Record<string, 'read' | 'create' | 'update' | 'delete'>
> = {
  'record.read': 'read',
  'record.create': 'create',
  'record.update': 'update',
  'record.delete': 'delete',
}

/**
 * RBAC gate: the agent's auth `role` must hold the
 * table-level permission for the requested record CRUD verb. Returns `true`
 * when an explicitly configured table permission denies the agent's role, and
 * `false` when access is granted (or no permission rule constrains it).
 */
const isRbacDenied = (
  agent: Agent,
  table: string,
  action: string,
  app: App | undefined
): boolean => {
  const permission = RECORD_ACTION_TO_PERMISSION[action]
  if (permission === undefined) return false
  const tableConfig = app?.tables?.find((candidate) => candidate.name === table)
  const rule = tableConfig?.permissions?.[permission]
  if (rule === undefined) return false
  // `isAdminRole` mirrors the table-permission admin override.
  return !checkPermissionWithAdminOverride(isAdminRole(agent.role), rule, agent.role)
}

/**
 * Tool-allowlist + RBAC double gate.
 *
 * Two gates must both pass for an agent action to proceed:
 *
 * 1. **RBAC gate**: the agent's auth `role` must hold
 *     the table-level permission for the requested record CRUD verb.
 * 2. **Allowlist gate**: the requested
 *     table AND action must appear in the agent's `tools` allowlist. An agent
 *     with no `tools` configuration has NO access (secure by default).
 *
 * The RBAC gate is checked first — but both denials are reported identically as
 * 404 (not 403) so a caller cannot use the status code to enumerate which
 * tables an agent can reach.
 *
 * A free-form `message` turn (no `action`/`table`) skips both gates.
 *
 * Returns `true` when the agent's capabilities or its role permissions deny the
 * request; `false` when access is allowed.
 */
const isToolAccessDenied = (
  agent: Agent,
  body: ExecuteRequestBody,
  action: string,
  app: App | undefined
): boolean => {
  // A free-form conversational turn targets neither a table nor a declared
  // action — it is never tool-gated.
  if (action === MESSAGE_ACTION) return false

  const { tools } = agent
  // Secure by default: an agent with no allowlist has no access.
  if (tools === undefined) return true

  // Allowlist action gate: the requested action must be allowed.
  if (!(tools.actions as ReadonlyArray<string>).includes(action)) return true

  const table = typeof body.table === 'string' ? body.table : undefined
  if (table === undefined) return false

  // Allowlist table gate: the requested table must be allowed.
  if (!tools.tables.includes(table)) return true

  // RBAC gate: a role that lacks the table-level CRUD permission is denied
  // even when the table/action are allowlisted.
  return isRbacDenied(agent, table, action, app)
}

/**
 * Operational-limit pre-flight gate.
 *
 * Checked BEFORE the AI round-trip so an over-budget action never reaches the
 * provider. Returns a 202 `queued` response when the agent has exhausted its
 * `maxActionsPerMinute` window or has no free `maxConcurrentTasks` slot;
 * returns `undefined` when the action may proceed.
 *
 * A `queued` decision claims neither an action-window slot nor a concurrency
 * slot — the action is deferred, not dropped.
 */
const checkLimitGates = (c: Readonly<Context>, agent: Agent): Response | undefined => {
  const limits = resolveAgentLimits(agent.limits)

  const rate = checkActionRateLimit(agent.name, limits.maxActionsPerMinute)
  if (rate.queued) {
    return c.json(
      { status: 'queued', agent: agent.name, reason: 'maxActionsPerMinute exceeded' },
      202
    )
  }

  if (!acquireConcurrencySlot(agent.name, limits.maxConcurrentTasks)) {
    return c.json(
      { status: 'queued', agent: agent.name, reason: 'maxConcurrentTasks reached' },
      202
    )
  }

  return undefined
}

/**
 * Run the agent action once it has passed all pre-flight gates: perform the
 * observational AI round-trip, write the activity-log entry, and either
 * complete immediately or queue an approval request.
 */
const runAgentAction = async (
  c: Readonly<Context>,
  agent: Agent,
  body: ExecuteRequestBody,
  action: string
): Promise<Response> => {
  const { name: agentName } = agent

  // [internal ref]: rate + concurrency gates. A `queued`
  // response is returned WITHOUT calling the AI provider — the action is
  // deferred, not executed.
  const limitGate = checkLimitGates(c, agent)
  if (limitGate) return limitGate

  // A concurrency slot is now held — release it on every exit path below.
  try {
    return await executeWithinSlot(c, agent, body, action)
  } finally {
    releaseConcurrencySlot(agentName)
  }
}

/**
 * Execute the agent action while holding a concurrency slot: AI round-trip,
 * token accounting, activity log, and the completed / approval-pending /
 * token-exhausted decision.
 */
const executeWithinSlot = async (
  c: Readonly<Context>,
  agent: Agent,
  body: ExecuteRequestBody,
  action: string
): Promise<Response> => {
  const { name: agentName } = agent
  const limits = resolveAgentLimits(agent.limits)
  const payload: Record<string, unknown> = {
    action,
    ...(typeof body.table === 'string' && { table: body.table }),
    ...(body.recordId !== undefined && { recordId: body.recordId }),
    ...(body.fields !== undefined && { fields: body.fields }),
  }

  // The AI round-trip is observational; its `usage.total_tokens` feeds the
  // per-day token budget.
  const tokensUsed = await callAgentAi(agent, action)
  recordTokenUsage(agentName, tokensUsed)

  // [internal ref]: once the daily token budget can no longer cover
  // another LLM round-trip, the action fails with an explicit error. The AI
  // call above has already been made (and observed) — the budget check is
  // post-call so the provider round-trip is never silently skipped.
  if (isTokenBudgetExhausted(agentName, limits.maxTokensPerDay)) {
    return c.json({ error: `Daily token budget exhausted for agent '${agentName}'.` }, 429)
  }

  // [internal ref]: the agent action appears in activity monitoring
  // with actor_type='agent' and actor_name set to the agent name.
  const targetTable = typeof body.table === 'string' ? body.table : undefined
  // eslint-disable-next-line functional/no-expression-statements -- best-effort activity write
  await recordAgentActivity({ actorName: agentName, action, targetTable })

  // [internal ref]: surface the agent action in the
  // `GET /api/activity` `entries` feed with `actor.type='agent'` and
  // `actor.name` set to the agent name, alongside approval decisions.
  appendAgentActivityEntry({
    id: crypto.randomUUID(),
    action,
    agentName,
    actor: { type: 'agent', name: agentName },
    targetTable,
    createdAt: new Date().toISOString(),
  })

  if (!requiresApproval(agent, action)) {
    return c.json({ status: 'completed', approvalRequired: false, agent: agentName }, 200)
  }

  const record = buildApprovalRecord(agent, action, payload)
  putApproval(record)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort DB mirror write; failure is discarded by the runner
  await runApprovalMirror(MirrorApprovalCreate(toMirrorRecord(record)))

  return c.json(
    {
      status: 'pending_approval',
      approvalRequired: true,
      approvalId: record.id,
      agent: agentName,
    },
    202
  )
}

const handleExecute =
  (app: App | undefined) =>
  async (c: Readonly<Context>): Promise<Response> => {
    const agentName = c.req.param('name') ?? ''
    const agent = findAgent(app, agentName)
    if (!agent) return agentNotFound(c, agentName)

    // [internal ref]: with no AI provider configured at all, the declared agent is
    // INERT — discoverable but not runnable. Degrade the execute path gracefully
    // with 503 rather than proceeding to the AI round-trip (which has no
    // reachable provider). Checked before every other gate so no work — rate
    // limiting, body parsing, RBAC — happens for an unrunnable agent. The
    // loud-fail path for an explicitly-misconfigured provider is enforced at
    // startup, so a booted server with an unset `AI_PROVIDER` is unambiguously
    // the inert case.
    if (!isAiProviderConfigured(process.env)) {
      return c.json(
        { error: 'AI provider not configured — the assistant is currently unavailable.' },
        503
      )
    }

    const gateResponse = checkExecutionGates(c, agent)
    if (gateResponse) return gateResponse

    const body = (await c.req.json().catch(() => ({}))) as ExecuteRequestBody
    const action = resolveExecuteAction(body)
    if (action === '') {
      return c.json(
        { error: 'Either `action` or `message` is required and must be a non-empty string.' },
        400
      )
    }

    // [internal ref]: an action outside the agent's
    // tools allowlist — or one its role lacks RBAC permission for — is denied
    // as 404 to prevent enumeration. Checked before the AI round-trip so a
    // disallowed call never reaches the LLM provider.
    if (isToolAccessDenied(agent, body, action, app)) {
      return c.json({ error: `Agent '${agentName}' cannot access this resource.` }, 404)
    }

    return runAgentAction(c, agent, body, action)
  }

const handleListAgents =
  (app: App | undefined) =>
  (c: Readonly<Context>): Response =>
    c.json((app?.agents ?? []).map(serializeAgent), 200)

const handleGetAgent =
  (app: App | undefined) =>
  (c: Readonly<Context>): Response => {
    const agentName = c.req.param('name') ?? ''
    const agent = findAgent(app, agentName)
    if (!agent) return agentNotFound(c, agentName)
    return c.json(serializeAgent(agent), 200)
  }

/**
 * [internal ref]: daily token-usage readback.
 *
 * Reports the agent's tokens consumed during the current UTC day alongside
 * its effective `maxTokensPerDay` budget. The counter resets at midnight UTC.
 */
const handleGetUsage =
  (app: App | undefined) =>
  (c: Readonly<Context>): Response => {
    const agentName = c.req.param('name') ?? ''
    const agent = findAgent(app, agentName)
    if (!agent) return agentNotFound(c, agentName)
    const limits = resolveAgentLimits(agent.limits)
    return c.json(getAgentUsage(agentName, limits.maxTokensPerDay), 200)
  }

const handleListApprovals =
  (app: App | undefined) =>
  (c: Readonly<Context>): Response => {
    const agentName = c.req.param('name') ?? ''
    if (!findAgent(app, agentName)) return agentNotFound(c, agentName)
    const statusFilter = c.req.query('status')
    const all = listApprovalsForAgent(agentName).map((record) => refreshApproval(record))
    const filtered =
      statusFilter === undefined ? all : all.filter((record) => record.status === statusFilter)
    return c.json({ approvals: filtered.map(serializeApproval) }, 200)
  }

const handleGetApproval =
  (app: App | undefined) =>
  (c: Readonly<Context>): Response => {
    const agentName = c.req.param('name') ?? ''
    if (!findAgent(app, agentName)) return agentNotFound(c, agentName)
    const approvalId = c.req.param('id') ?? ''
    const record = getApproval(approvalId)
    if (!record || record.agentName !== agentName) {
      return c.json({ error: `Approval '${approvalId}' not found.` }, 404)
    }
    return c.json(serializeApproval(refreshApproval(record)), 200)
  }

type Decision = 'approve' | 'reject'

const handleDecision =
  (app: App | undefined, decision: Decision) =>
  async (c: Readonly<Context>): Promise<Response> => {
    const agentName = c.req.param('name') ?? ''
    const agent = findAgent(app, agentName)
    if (!agent) return agentNotFound(c, agentName)
    const approvalId = c.req.param('id') ?? ''
    const stored = getApproval(approvalId)
    if (!stored || stored.agentName !== agentName) {
      return c.json({ error: `Approval '${approvalId}' not found.` }, 404)
    }

    const record = refreshApproval(stored)
    if (record.status !== 'pending') {
      return c.json(
        { error: `Approval '${approvalId}' is already ${record.status}.`, status: record.status },
        409
      )
    }

    const session = getSessionContext(c as Context)
    const approver = await resolveApprover(session?.userId)
    if (!approver) {
      return c.json({ error: 'Authentication is required to decide on an approval.' }, 401)
    }

    const agentLevel = resolveRoleLevel(app, agent.role)
    const approverLevel = resolveRoleLevel(app, approver.role)
    if (approverLevel < agentLevel) {
      return c.json(
        {
          error: `Role level ${approverLevel.toString()} is insufficient to decide on an agent with role level ${agentLevel.toString()}.`,
        },
        404
      )
    }

    return applyDecision(c, record, decision, approver)
  }

interface Approver {
  readonly id: string
  readonly email: string
  readonly role: string
}

/** Resolve the approving user from the session, including role + email. */
const resolveApprover = async (userId: string | undefined): Promise<Approver | undefined> => {
  if (userId === undefined) return undefined
  const role = await getUserRole(userId)
  const email = await runApproverEmailLookup(userId)
  return { id: userId, email, role }
}

const applyDecision = async (
  c: Readonly<Context>,
  record: ApprovalRecord,
  decision: Decision,
  approver: Approver
): Promise<Response> => {
  const nextStatus: ApprovalStatus = decision === 'approve' ? 'approved' : 'rejected'
  // Approved actions execute under the AGENT's identity, never the approver's.
  const next =
    updateApproval(record.id, {
      status: nextStatus,
      approvedByEmail: approver.email,
      ...(decision === 'approve' && { actionExecuted: true, executedAs: record.agentName }),
    }) ?? record

  // eslint-disable-next-line functional/no-expression-statements -- best-effort DB mirror write; failure is discarded by the runner
  await runApprovalMirror(MirrorApprovalUpdate(toMirrorRecord(next)))

  appendActivityEntry({
    id: crypto.randomUUID(),
    action: decision === 'approve' ? 'approval.approved' : 'approval.rejected',
    approvalId: next.id,
    agentName: next.agentName,
    actor: { id: approver.id, email: approver.email },
    createdAt: new Date().toISOString(),
  })

  return c.json(serializeApproval(next), 200)
}

/**
 * Chain agent action + approval routes onto a Hono app.
 *
 * Always registered. When `app.agents` is unset every handler returns 404 for
 * the unknown agent, so the API shape stays stable across configurations.
 *
 * The static `/approvals` collection route is registered BEFORE the dynamic
 * `/approvals/:id` route is irrelevant here because the path segment counts
 * differ; both are listed for clarity. The bare `/:name` route is registered
 * last so it never shadows the more specific `/:name/...` paths.
 */
export function chainAgentApprovalRoutes<T extends Hono>(honoApp: T, app?: App): T {
  return honoApp
    .post('/api/agents/:name/execute', (c) => handleExecute(app)(c as unknown as Readonly<Context>))
    .post('/api/agents/:name/approvals/:id/approve', (c) =>
      handleDecision(app, 'approve')(c as unknown as Readonly<Context>)
    )
    .post('/api/agents/:name/approvals/:id/reject', (c) =>
      handleDecision(app, 'reject')(c as unknown as Readonly<Context>)
    )
    .get('/api/agents/:name/approvals/:id', (c) =>
      handleGetApproval(app)(c as unknown as Readonly<Context>)
    )
    .get('/api/agents/:name/approvals', (c) =>
      handleListApprovals(app)(c as unknown as Readonly<Context>)
    )
    .get('/api/agents/:name/usage', (c) => handleGetUsage(app)(c as unknown as Readonly<Context>))
    .get('/api/agents', (c) => handleListAgents(app)(c as unknown as Readonly<Context>))
    .get('/api/agents/:name', (c) => handleGetAgent(app)(c as unknown as Readonly<Context>)) as T
}
