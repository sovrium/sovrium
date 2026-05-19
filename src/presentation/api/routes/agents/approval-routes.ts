/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { getUserRole } from '@/application/use-cases/tables/user-role'
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
import { insertApprovalRow, lookupUserEmail, updateApprovalRow } from './approval-db'
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

const MESSAGE_ACTION = 'agent.message'

const requiresApproval = (agent: Agent, action: string): boolean => {
  const mode = agent.approval?.mode ?? 'none'
  if (mode === 'all') return true
  if (mode === 'selective') {
    return (agent.approval?.required ?? []).includes(action)
  }
  return false
}

const checkExecutionGates = (c: Readonly<Context>, agent: Agent): Response | undefined => {
  if (agent.enabled === false) {
    return c.json({ error: `Agent '${agent.name}' is disabled and cannot execute actions.` }, 403)
  }
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

const resolveExecuteAction = (body: ExecuteRequestBody): string => {
  if (typeof body.action === 'string' && body.action.length > 0) return body.action
  if (typeof body.message === 'string' && body.message.length > 0) return MESSAGE_ACTION
  return ''
}

const RECORD_ACTION_TO_PERMISSION: Readonly<
  Record<string, 'read' | 'create' | 'update' | 'delete'>
> = {
  'record.read': 'read',
  'record.create': 'create',
  'record.update': 'update',
  'record.delete': 'delete',
}

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
  return !checkPermissionWithAdminOverride(isAdminRole(agent.role), rule, agent.role)
}

const isToolAccessDenied = (
  agent: Agent,
  body: ExecuteRequestBody,
  action: string,
  app: App | undefined
): boolean => {
  if (action === MESSAGE_ACTION) return false

  const { tools } = agent
  if (tools === undefined) return true

  if (!(tools.actions as ReadonlyArray<string>).includes(action)) return true

  const table = typeof body.table === 'string' ? body.table : undefined
  if (table === undefined) return false

  if (!tools.tables.includes(table)) return true

  return isRbacDenied(agent, table, action, app)
}

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

const runAgentAction = async (
  c: Readonly<Context>,
  agent: Agent,
  body: ExecuteRequestBody,
  action: string
): Promise<Response> => {
  const { name: agentName } = agent

  const limitGate = checkLimitGates(c, agent)
  if (limitGate) return limitGate

  try {
    return await executeWithinSlot(c, agent, body, action)
  } finally {
    releaseConcurrencySlot(agentName)
  }
}

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

  const tokensUsed = await callAgentAi(agent, action)
  recordTokenUsage(agentName, tokensUsed)

  if (isTokenBudgetExhausted(agentName, limits.maxTokensPerDay)) {
    return c.json({ error: `Daily token budget exhausted for agent '${agentName}'.` }, 429)
  }

  const targetTable = typeof body.table === 'string' ? body.table : undefined
  await recordAgentActivity({ actorName: agentName, action, targetTable })

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
  await insertApprovalRow(record)

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
        403
      )
    }

    return applyDecision(c, record, decision, approver)
  }

interface Approver {
  readonly id: string
  readonly email: string
  readonly role: string
}

const resolveApprover = async (userId: string | undefined): Promise<Approver | undefined> => {
  if (userId === undefined) return undefined
  const role = await getUserRole(userId)
  const email = await lookupUserEmail(userId)
  return { id: userId, email, role }
}

const applyDecision = async (
  c: Readonly<Context>,
  record: ApprovalRecord,
  decision: Decision,
  approver: Approver
): Promise<Response> => {
  const nextStatus: ApprovalStatus = decision === 'approve' ? 'approved' : 'rejected'
  const next =
    updateApproval(record.id, {
      status: nextStatus,
      approvedByEmail: approver.email,
      ...(decision === 'approve' && { actionExecuted: true, executedAs: record.agentName }),
    }) ?? record

  await updateApprovalRow(next)

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
