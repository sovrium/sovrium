/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One tool call of an agent turn, through the agent's gates ([internal ref] D2).
 *
 * Every surface resolves its tool calls here and nowhere else, one at a time,
 * in this order:
 *
 *  1. **allowlist and role** — the action and its table must be in the agent's
 *     `tools`, and its role must hold the table permission; on a chat turn the
 *     person chatting must hold it too, since an agent's reach is a ceiling on
 *     her, never a grant;
 *  2. **rate limit**, then 3. **limits** — the agent's action ceiling and its
 *     `maxActionsPerMinute` window ({@link AgentGuard});
 *  4. **approval** — a call the agent's approval rule covers is held as a
 *     pending approval named after the action, and the turn pauses;
 *  5. **execution** — through the automation engine's handler for the action,
 *     uninterruptible once started, so a stop never leaves half a write;
 *  6. **activity log** — one row per executed step, naming the agent, the
 *     action, its table and the surface that started the turn.
 *
 * Calls that are not agent actions — a chat turn's table lookups, its browser
 * tool, an external MCP server's tool — are run by `runOther`, and logged as
 * that surface always logged them. One the tools say needs a human
 * (`requiresApproval`) is held like an action the approval rule covers.
 */

import { Effect } from 'effect'
import { AgentApprovalStore } from '@/application/ports/services/agent-approval-store'
import { AgentGuard } from '@/application/ports/services/agent-guard'
import { MirrorApprovalCreate } from '@/application/use-cases/agents/approval'
import { recordAiActivity } from '@/application/use-cases/ai/record-ai-activity'
import {
  agentToolRefusal,
  isCallerDeniedAgentAction,
  requiresApproval,
  resolveAgentLimits,
  type AgentToolRefusal,
} from '@/domain/models/app/agents/agent-gate-validation'
import {
  isAgentActionName,
  toActionProps,
  toolCallTable,
} from '@/domain/models/app/agents/agent-turn-service'
import { buildApprovalRecord } from '@/domain/models/app/agents/approval-record-service'
import { bestEffort, runOtherTool } from './surface-tool-call'
import type { AiActivityLogRepository } from '@/application/ports/repositories/ai/ai-activity-log-repository'
import type { ApprovalRepository } from '@/application/ports/repositories/ai/approval-repository'
import type {
  AgentCaller,
  AgentSurface,
  ApprovalContinuation,
  PendingElicitation,
} from '@/application/ports/services/agent-approval-store'
import type { ChatToolCall } from '@/application/ports/services/ai-service'
import type { McpClient } from '@/application/ports/services/mcp-client'
import type { App } from '@/domain/models/app'
import type { Agent } from '@/domain/models/app/agents/agent'

/** What running one agent action produced. */
export type AgentActionResult =
  | { readonly ok: true; readonly output: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly error: string }

/** Runs one agent action — through an automation run, or directly. */
export type AgentActionRunner<R> = (
  action: string,
  props: Readonly<Record<string, unknown>>
) => Effect.Effect<AgentActionResult, never, R>

/** What a surface's own (non-action) tool produced. */
export interface OtherToolResult {
  readonly content: string
  readonly denied: boolean
  /** The tool ran, or was tried, and did not succeed (a timeout, an error result). */
  readonly failed?: boolean | undefined
  readonly table?: string | undefined
  /** The tool asked the person a question: the turn waits for her answer (`ask_user`). */
  readonly elicitation?: PendingElicitation | undefined
}

/** The tools a surface brings to a turn. */
export interface AgentTurnTools<R> {
  /** Runs the agent actions (`record.create`, …). */
  readonly runAction: AgentActionRunner<R>
  /** Runs any other tool the surface advertises; absent, such a call fails. */
  readonly runOther?: ((call: ChatToolCall) => Effect.Effect<OtherToolResult, never, R>) | undefined
  /** Whether a call `runOther` runs waits for a human first; absent, none does. */
  readonly requiresApproval?: ((call: ChatToolCall) => boolean) | undefined
}

/** The outcome of one tool call, as the runtime streams it. */
export type ToolOutcome = 'ok' | 'denied' | 'failed' | 'pending-approval' | 'pending-input'

/** One resolved tool call. */
export interface AgentToolResult {
  readonly id: string
  readonly name: string
  readonly outcome: ToolOutcome
  /** What the model is handed as the tool's result. */
  readonly content: string
  readonly table?: string | undefined
  /** Set when the call is held for a human. */
  readonly approvalId?: string | undefined
  /** Set when the call asked the person a question, which the turn waits on. */
  readonly elicitation?: PendingElicitation | undefined
  /** Why the call was refused, when it was refused by the agent's gates. */
  readonly refusal?: AgentToolRefusal | 'caller-denied' | 'rate-limited' | 'queued' | undefined
}

/** Who and what one tool call is judged for. */
export interface AgentToolContext<R> {
  readonly surface: AgentSurface
  /** The declared agent the turn runs as; absent for a chat turn with no agent. */
  readonly agent?: Agent | undefined
  readonly app: App | undefined
  /** The account that started the turn, when a person did. */
  readonly requestedById?: string | undefined
  /** On a chat turn, the person chatting — a ceiling on the agent's reach. */
  readonly caller?: AgentCaller | undefined
  /** On a chat turn, who is chatting — the actor of the rows a non-action tool logs. */
  readonly chatActor?: string | undefined
  readonly tools: AgentTurnTools<R>
}

/** The requirements every tool call carries, whatever the surface. */
export type AgentToolRequirements =
  | AgentGuard
  | AgentApprovalStore
  | ApprovalRepository
  | AiActivityLogRepository
  // the external MCP tools an agent names (`mcp-agent-tools.ts`)
  | McpClient

/** The text a model reads for a refused call. */
const REFUSAL_TEXT: Readonly<Record<NonNullable<AgentToolResult['refusal']>, string>> = {
  'action-not-allowed': 'this action is not in the agent’s allowlist',
  'table-not-allowed': 'this table is not in the agent’s allowlist',
  'role-denied': 'the agent’s role may not do this on this table',
  'caller-denied': 'the person the agent is answering may not do this herself',
  'rate-limited': 'the agent has exceeded its action rate limit; try again later',
  queued: 'the agent has used its actions for this minute; try again later',
}

const refused = (
  call: ChatToolCall,
  refusal: NonNullable<AgentToolResult['refusal']>,
  table: string | undefined
): AgentToolResult => ({
  id: call.id,
  name: call.name,
  outcome: 'denied',
  content: `Error: permission denied — ${REFUSAL_TEXT[refusal]}.`,
  table,
  refusal,
})

/** The gates of steps 1–3: allowlist and role (agent, then caller), rate limit, window. */
const gateRefusal = (
  agent: Agent,
  call: ChatToolCall,
  context: AgentToolContext<unknown>
): Effect.Effect<AgentToolResult['refusal'], never, AgentGuard> =>
  Effect.gen(function* () {
    const table = toolCallTable(call.arguments)
    const refusal = agentToolRefusal(agent, { action: call.name, table }, context.app)
    if (refusal !== undefined) return refusal
    if (
      context.caller !== undefined &&
      isCallerDeniedAgentAction(
        { action: call.name, table, caller: context.caller.grantOn(table) },
        context.app
      )
    ) {
      return 'caller-denied' as const
    }
    const guard = yield* AgentGuard
    return yield* guard.admitAction({
      name: agent.name,
      role: agent.role,
      maxActionsPerMinute: resolveAgentLimits(agent.limits).maxActionsPerMinute,
    })
  })

/** Hold the call for a human: open the approval, keep the turn's continuation. */
const holdForApproval = (
  agent: Agent,
  call: ChatToolCall,
  context: AgentToolContext<unknown>,
  continuation: Omit<ApprovalContinuation, 'call' | 'surface'>
): Effect.Effect<AgentToolResult, never, AgentApprovalStore | ApprovalRepository> =>
  Effect.gen(function* () {
    const record = buildApprovalRecord({
      id: crypto.randomUUID(),
      nowMs: Date.now(),
      agent,
      action: call.name,
      payload: { action: call.name, ...call.arguments },
      requestedById: context.requestedById,
    })
    const store = yield* AgentApprovalStore
    yield* store.open(record, {
      ...continuation,
      call,
      surface: context.surface,
      caller: context.caller,
    })
    yield* bestEffort(
      MirrorApprovalCreate({
        id: record.id,
        status: record.status,
        agentName: record.agentName,
        actionPayload: record.actionPayload,
        actionExecuted: record.actionExecuted,
        timeoutSeconds: record.timeoutSeconds,
        escalated: record.escalated,
        executedAs: record.executedAs,
        escalatedTo: record.escalatedTo,
        expiresAtMs: record.expiresAtMs,
        requestedById: record.requestedById,
      }),
      'approval mirror'
    )
    return {
      id: call.id,
      name: call.name,
      outcome: 'pending-approval',
      content: `The action "${call.name}" is waiting for a human to approve it. It has not run yet.`,
      table: toolCallTable(call.arguments),
      approvalId: record.id,
    } satisfies AgentToolResult
  })

/**
 * What the model is handed for an executed action. A created record is read
 * back so the model sees the record as stored — its id and every value it
 * holds — not an acknowledgement.
 */
const executedContent = <R>(
  call: ChatToolCall,
  output: Readonly<Record<string, unknown>>,
  runAction: AgentActionRunner<R>
): Effect.Effect<string, never, R> => {
  const table = toolCallTable(call.arguments)
  const { id } = output
  if (call.name !== 'record.create' || table === undefined || id === undefined) {
    return Effect.succeed(JSON.stringify(output))
  }
  return Effect.map(runAction('record.read', { table, id: String(id) }), (read) =>
    JSON.stringify(read.ok ? read.output : { record: { id, ...readFields(call.arguments) } })
  )
}

const readFields = (args: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
  const fields = args['fields'] ?? args['data']
  return typeof fields === 'object' && fields !== null ? (fields as Record<string, unknown>) : {}
}

/** Steps 5–6 for an agent action: run it uninterruptibly, then log it. */
export const runAgentAction = <R>(
  agent: Agent,
  call: ChatToolCall,
  context: AgentToolContext<R>
): Effect.Effect<AgentToolResult, never, R | AgentApprovalStore | AiActivityLogRepository> =>
  Effect.gen(function* () {
    const table = toolCallTable(call.arguments)
    const result = yield* Effect.uninterruptible(
      context.tools.runAction(call.name, toActionProps(call.name, call.arguments))
    )
    const content = result.ok
      ? yield* executedContent(call, result.output, context.tools.runAction)
      : `Error: ${result.error}`
    yield* bestEffort(
      recordAiActivity({
        actorType: 'agent',
        actorName: agent.name,
        action: call.name,
        targetTable: table,
        surface: context.surface,
      }),
      'activity log'
    )
    const store = yield* AgentApprovalStore
    const recordId = result.ok ? result.output['id'] : undefined
    yield* store.recordAction({
      agentName: agent.name,
      action: call.name,
      targetTable: table,
      recordId:
        typeof recordId === 'string' || typeof recordId === 'number' ? String(recordId) : undefined,
      runStartedById: context.requestedById,
    })
    return {
      id: call.id,
      name: call.name,
      outcome: result.ok ? 'ok' : 'failed',
      content,
      table,
    } satisfies AgentToolResult
  }).pipe(Effect.withSpan('agents.run-agent-action', { attributes: { 'agent.tool': call.name } }))

/**
 * Run a call a human approved: an agent action through steps 5–6, any other
 * tool through `runOther`. The gates already ran when the call was held.
 */
export const runApprovedToolCall = <R>(
  agent: Agent,
  call: ChatToolCall,
  context: AgentToolContext<R>
): Effect.Effect<AgentToolResult, never, R | AgentApprovalStore | AiActivityLogRepository> =>
  (isAgentActionName(call.name)
    ? runAgentAction(agent, call, context)
    : runOtherTool(call, context)
  ).pipe(
    Effect.withSpan('agents.run-approved-tool-call', { attributes: { 'agent.tool': call.name } })
  )

/**
 * Resolve one tool call of an agent turn through the gates, in order.
 *
 * The entry point every surface — and any new tool source, such as an MCP
 * client — resolves a model's call through. `continuation` is what a held call
 * keeps so its approval can resume the turn.
 */
export const executeAgentToolCall = <R>(
  call: ChatToolCall,
  context: AgentToolContext<R>,
  continuation: Omit<ApprovalContinuation, 'call' | 'surface'>
): Effect.Effect<AgentToolResult, never, R | AgentToolRequirements> =>
  Effect.gen(function* () {
    const { agent } = context
    if (agent === undefined || !isAgentActionName(call.name)) {
      return agent !== undefined && context.tools.requiresApproval?.(call) === true
        ? yield* holdForApproval(agent, call, context, continuation)
        : yield* runOtherTool(call, context, continuation)
    }
    const refusal = yield* gateRefusal(agent, call, context)
    if (refusal !== undefined) return refused(call, refusal, toolCallTable(call.arguments))
    if (requiresApproval(agent, call.name)) {
      return yield* holdForApproval(agent, call, context, continuation)
    }
    return yield* runAgentAction(agent, call, context)
  }).pipe(
    Effect.withSpan('agents.execute-tool-call', {
      attributes: { 'agent.tool': call.name, 'agent.surface': context.surface },
    })
  )
