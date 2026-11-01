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
 * Listing, reading and deciding on approvals follow the agent's trigger list
 * (`checkTriggerPermission`, admins included): anyone else is answered as for
 * an undeclared agent, before any approval lookup. Inside the list, a decision
 * also needs a role level at least the agent's (404 otherwise). Approved actions execute under the agent's identity, never the
 * approver's. Every decision is recorded in the approval activity log.
 *
 * Agent execution always performs a single AI provider round-trip so the AI
 * mock-server assertion (`ai.getLastRequest()`) observes the call, regardless
 * of whether the action is auto-executed or queued for approval.
 */

import { Effect } from 'effect'
import {
  agentListResponseSchema,
  agentUsageResponseSchema,
  serializedAgentSchema,
} from '@/domain/models/api/agents/agents'
import { ApiErrorCode } from '@/domain/models/api/error'
import {
  agentToolRefusal,
  resolveAgentLimits,
} from '@/domain/models/app/agents/agent-gate-validation'
import { isAiProviderConfigured } from '@/domain/models/process-env/ai/ai-providers'
import { getAgentUsage } from '@/infrastructure/ai/agents/agent-limits'
import {
  checkAgentListPermission,
  checkTriggerPermission,
  judgeAgentTriggers,
} from '@/presentation/api/agents/agent-trigger-guard'
import { agentNotFound, findAgent } from '@/presentation/api/runtime/agent-lookup'
import { errorBody, notFoundBody } from '@/presentation/api/runtime/auth-helpers'
import { answerFailures, runHandlerEffect, shapedJson } from '@/presentation/api/runtime/run-effect'
import { runAgentAction, type ExecuteRequestBody } from './agent-action-run'
import { checkExecutionGates } from './agent-execution-gates'
import { serializeAgent } from './agent-presenter'
import { decideAsApprover, type Decision } from './approval-decision'
import { answerApproval, answerApprovals } from './approval-presenter'
import { listApprovals, readApproval } from './approval-store-access'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'
import type { DomainServices } from '@/infrastructure/logging/request-effect'
import type { Context, Hono } from 'hono'

/**
 * Generic action label for a conversational agent turn — used when the caller
 * supplies a free-form `message` instead of a structured `action`. A message
 * turn never matches an `approval.required` entry, so it always runs
 * immediately under `mode: 'selective'`.
 */
const MESSAGE_ACTION = 'agent.message'

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

/**
 * Tool-allowlist + RBAC double gate (an AI agent def spec / [internal ref]).
 *
 * Two gates must both pass for an agent action to proceed:
 *
 *  1. **RBAC gate**: the agent's auth `role` must hold
 *     the table-level permission for the requested record CRUD verb.
 *  2. **Allowlist gate**: the requested
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
): boolean =>
  // A free-form conversational turn targets neither a table nor a declared
  // action — it is never tool-gated.
  action !== MESSAGE_ACTION &&
  agentToolRefusal(
    agent,
    { action, table: typeof body.table === 'string' ? body.table : undefined },
    app
  ) !== undefined

/** The execute request's body; one that does not parse reads as empty. */
const readExecuteBody = (c: Context): Effect.Effect<ExecuteRequestBody> =>
  // effect-promise: total -- a rejected parse is caught here and reads as an empty body.
  Effect.promise(async () => (await c.req.json().catch(() => ({}))) as ExecuteRequestBody)

/** Answer a whole handler's program once, on the request's services. */
const handled =
  <E>(program: (c: Context) => Effect.Effect<Response, E, DomainServices>) =>
  (c: Context): Promise<Response> =>
    runHandlerEffect(c, answerFailures(c, program(c)))

/**
 * The agent a route addresses, or the 404 standing in for it: undeclared, or
 * outside the caller's trigger grant — the two are told apart by nobody.
 */
const resolveAgent = (c: Context, app: App | undefined) =>
  Effect.gen(function* () {
    const agent = findAgent(app, c.req.param('name') ?? '')
    if (!agent) return { refusal: agentNotFound(c) }
    const refusal = yield* checkTriggerPermission(c, agent, app)
    return refusal ? { refusal } : { agent }
  })

const handleExecute = (app: App | undefined) =>
  handled((c) =>
    Effect.gen(function* () {
      // `permissions.trigger` governs
      // who may invoke this agent. FIRST of every gate — see the placement note on
      // `checkTriggerPermission`. Both the 503 below and the limiters after it
      // answer differently for a declared agent than an undeclared one, and the
      // limiters record the attempts they admit.
      const target = yield* resolveAgent(c, app)
      if (target.refusal) return target.refusal
      const { agent } = target

      // With no AI provider configured at all, the declared agent is
      // INERT — discoverable but not runnable. Degrade the execute path gracefully
      // with 503 rather than proceeding to the AI round-trip (which has no
      // reachable provider). Checked before every other gate so no work — rate
      // limiting, body parsing, RBAC — happens for an unrunnable agent. The
      // loud-fail path for an explicitly-misconfigured provider is enforced at
      // startup, so a booted server with an unset `AI_PROVIDER` is unambiguously
      // the inert case.
      if (!isAiProviderConfigured(process.env)) {
        return c.json(
          errorBody({
            error: 'AI provider not configured — the assistant is currently unavailable.',
            code: ApiErrorCode.SERVICE_UNAVAILABLE,
          }),
          503
        )
      }

      const gateResponse = checkExecutionGates(c, agent)
      if (gateResponse) return gateResponse

      const body = yield* readExecuteBody(c)
      const action = resolveExecuteAction(body)
      if (action === '') {
        return c.json(
          errorBody({
            error: 'Either `action` or `message` is required and must be a non-empty string.',
            code: ApiErrorCode.BAD_REQUEST,
          }),
          400
        )
      }

      // An AI agent def spec / [internal ref]: an action outside the agent's
      // tools allowlist — or one its role lacks RBAC permission for — is denied
      // as 404 to prevent enumeration. Checked before the AI round-trip so a
      // disallowed call never reaches the LLM provider.
      if (isToolAccessDenied(agent, body, action, app)) {
        return c.json(notFoundBody(`Agent '${agent.name}' cannot access this resource.`), 404)
      }

      return yield* runAgentAction(c, agent, body, action)
    })
  )

/**
 * The agent collection.
 *
 * Two gates, because this path has no `:name` segment and therefore never runs
 * under the `/api/agents/*` middleware wildcard, and no single `trigger` grant
 * to consult. A session is required to see the inventory at all; the inventory
 * is then narrowed to the agents this caller may actually trigger, so the
 * collection cannot hand a member the `systemPrompt` that
 * `GET /api/agents/:name` withholds from them.
 *
 * The narrowing is `judgeAgentTriggers`, one verdict per agent for one role
 * read. Every verdict here concerns the same caller, so a per-agent read would
 * ask the `user` table for the same row once per declared agent — and fire
 * them simultaneously, making the inventory a pooled fan-out as wide as the
 * app's agent list.
 */
const handleListAgents = (app: App | undefined) =>
  handled((c) =>
    Effect.gen(function* () {
      const listRefusal = yield* checkAgentListPermission(c, app)
      if (listRefusal) return listRefusal
      const agents = app?.agents ?? []
      const visible = yield* judgeAgentTriggers(c, agents, app)
      return shapedJson(
        c,
        agents.filter((_agent, index) => visible[index] === true).map(serializeAgent),
        agentListResponseSchema
      )
    })
  )

const handleGetAgent = (app: App | undefined) =>
  handled((c) =>
    Effect.map(
      // The readback serves `systemPrompt`, `instructions` and the tool
      // allowlist — the exact material a prompt injection is built from, so it
      // carries the same gate as invocation.
      resolveAgent(c, app),
      (target) =>
        target.refusal ?? shapedJson(c, serializeAgent(target.agent), serializedAgentSchema)
    )
  )

/**
 * Daily token-usage readback.
 *
 * Reports the agent's tokens consumed during the current UTC day alongside
 * its effective `maxTokensPerDay` budget. The counter resets at midnight UTC.
 */
const handleGetUsage = (app: App | undefined) =>
  handled((c) =>
    Effect.map(
      // Token spend is the operator's cost ledger for this agent; an anonymous
      // caller has no business reading it.
      resolveAgent(c, app),
      (target) => {
        if (target.refusal) return target.refusal
        const { agent } = target
        const limits = resolveAgentLimits(agent.limits)
        return shapedJson(
          c,
          getAgentUsage(agent.name, limits.maxTokensPerDay),
          agentUsageResponseSchema
        )
      }
    )
  )

const handleListApprovals = (app: App | undefined) =>
  handled((c) =>
    Effect.gen(function* () {
      // A pending approval carries the queued action's payload — table, record id
      // and field values the agent is about to write. At least as sensitive as
      // the `systemPrompt` the readback gate withholds.
      const target = yield* resolveAgent(c, app)
      if (target.refusal) return target.refusal
      const statusFilter = c.req.query('status')
      const all = yield* listApprovals(target.agent.name)
      const filtered =
        statusFilter === undefined ? all : all.filter((record) => record.status === statusFilter)
      return answerApprovals(c, filtered)
    })
  )

const handleGetApproval = (app: App | undefined) =>
  handled((c) =>
    Effect.gen(function* () {
      const target = yield* resolveAgent(c, app)
      if (target.refusal) return target.refusal
      const approvalId = c.req.param('id') ?? ''
      const record = yield* readApproval(approvalId)
      if (!record || record.agentName !== target.agent.name) {
        return c.json(notFoundBody(`Approval '${approvalId}' not found.`), 404)
      }
      return answerApproval(c, record)
    })
  )

const handleDecision = (app: App | undefined, decision: Decision) =>
  handled((c) =>
    Effect.gen(function* () {
      // Before the approval lookup: a caller the trigger list does not admit learns
      // nothing about which approval ids exist, and decides on none of them.
      const target = yield* resolveAgent(c, app)
      if (target.refusal) return target.refusal
      const { agent } = target
      const approvalId = c.req.param('id') ?? ''
      const record = yield* readApproval(approvalId)
      if (!record || record.agentName !== agent.name) {
        return c.json(notFoundBody(`Approval '${approvalId}' not found.`), 404)
      }

      if (record.status !== 'pending') {
        return c.json(
          {
            ...errorBody({
              error: `Approval '${approvalId}' is already ${record.status}.`,
              code: ApiErrorCode.CONFLICT,
            }),
            status: record.status,
          },
          409
        )
      }

      return yield* decideAsApprover(c, { app, agent, record, decision })
    })
  )

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
    .post('/api/agents/:name/execute', (c) => handleExecute(app)(c))
    .post('/api/agents/:name/approvals/:id/approve', (c) => handleDecision(app, 'approve')(c))
    .post('/api/agents/:name/approvals/:id/reject', (c) => handleDecision(app, 'reject')(c))
    .get('/api/agents/:name/approvals/:id', (c) => handleGetApproval(app)(c))
    .get('/api/agents/:name/approvals', (c) => handleListApprovals(app)(c))
    .get('/api/agents/:name/usage', (c) => handleGetUsage(app)(c))
    .get('/api/agents', (c) => handleListAgents(app)(c))
    .get('/api/agents/:name', (c) => handleGetAgent(app)(c)) as T
}
