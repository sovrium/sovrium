/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Completion pipeline for a GENERIC chat turn — everything that happens after
 * the AI provider has answered with prose and the tool-calling loop has been
 * ruled out.
 *
 * A turn is offered, in order, to the read-query parser, the automation-trigger
 * parser, and the record-mutation parser; the first that claims it owns the
 * reply text and the `actions[]`. Order matters and is asserted by the specs:
 * a query verb must beat a mutation verb so "Show users where …; DROP TABLE
 * users;--" is read as a QUERY.
 *
 * Extracted from `ai-chat.ts` so that file stays under its `max-lines` cap once
 * the agent-bound turn joined it. The dependency direction is one-way — this
 * module reaches only into `ai/chat-*`, never back into the route — so there is
 * no cycle to reason about.
 */

import { type ChatResponse, type ChatAction } from '@/domain/models/api/ai/chat'
import { type ContextPageScope } from '@/domain/services/ai-chat/ai-chat-context'
import { type AgentTurnBinding } from '@/presentation/api/routes/agents/agent-chat'
import {
  recordActivityLogRow,
  recordChatActivity,
} from '@/presentation/api/routes/ai/chat-activity-log'
import { completeTriggerTurn } from '@/presentation/api/routes/ai/chat-automation-flow'
import { appendConversationTurn } from '@/presentation/api/routes/ai/chat-conversation-store'
import { persistTurnDurably } from '@/presentation/api/routes/ai/chat-durable-memory'
import {
  evaluateMutationTurn,
  resolveUserEmail,
  type MutationTurnResult,
} from '@/presentation/api/routes/ai/chat-mutation-flow'
import { evaluateQueryTurn } from '@/presentation/api/routes/ai/chat-query-flow'
import { respondWithActions } from '@/presentation/api/routes/ai/chat-tool-calling'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** Inputs for a single non-agent chat turn dispatched to the AI provider. */
export interface ChatTurnInput {
  readonly systemPrompt: string
  readonly message: string
  readonly sessionId: string
  /** Acting user's identifier — written to the activity log for this turn. */
  readonly actorName: string
  /** Acting user's role — drives table-level RBAC for record mutations. */
  readonly userRole: string
  /**
   * Acting principal's effective roles: the global role plus a `group:<name>`
   * entry per group membership. Table read gates evaluate against THIS, not
   * `userRole` — a bare role can never match a `group:` permission entry.
   */
  readonly effectiveRoles: readonly string[]
  /** App schema — present when the turn may trigger a record mutation. */
  readonly app?: App
  /** Confirmation token from the request body, when re-confirming a delete. */
  readonly confirmationToken?: string
  /**
   * Optional page scope (`allowedTables`) narrowing the table list visible to
   * a record query.
   */
  readonly pageContext?: ContextPageScope
  /**
   * Remaining chat quota within the current rate-limit window. Present only
   * when `AI_CHAT_RATE_LIMIT` is configured — surfaced as the
   * `X-RateLimit-Remaining` response header.
   */
  readonly rateLimitRemaining?: number
  /**
   * The declared agent this turn is bound to. Present only for an agent-bound
   * turn; its absence is what makes the turn a generic one.
   */
  readonly agent?: AgentTurnBinding
}

/**
 * Complete a chat turn after a successful AI provider response: evaluate the
 * turn against the record-mutation pipeline,
 * short-circuit to HTTP 403 on a `forbidden` outcome, persist the exchange,
 * record activity, and build the `{ reply, actions, pendingConfirmation? }`
 * response envelope.
 */
export const finishChatTurn = async (
  c: Readonly<Context>,
  input: ChatTurnInput,
  aiReply: string
): Promise<Response> => {
  // Read-query path. Evaluated before the mutation
  // path because a query verb ("show", "how many") and a mutation verb
  // ("create", "update", "delete") are disjoint — but a query message such as
  // "Show users where …; DROP TABLE users;--" must be read as a *query*, not a
  // delete. A `forbidden` query short-circuits to HTTP 403; an `answered`
  // query owns the reply text and the `type: 'query'` action.
  const query = await evaluateQueryTurn({
    app: input.app,
    message: input.message,
    sessionId: input.sessionId,
    userRole: input.userRole,
    effectiveRoles: input.effectiveRoles,
    ...(input.pageContext !== undefined && { pageContext: input.pageContext }),
  })
  if (query.kind === 'forbidden') {
    // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
    await recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName })
    // S1 anti-enumeration: authz denials in chat (table/record query) return 404
    // so the user cannot enumerate which tables they lack access to.
    // `query.message` is intentionally discarded from the response envelope.
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }
  if (query.kind === 'answered') {
    return finishQueryTurn(c, input, query.reply, query.action)
  }

  // Automation-trigger path. Evaluated before
  // the mutation path because a trigger verb ("run", "trigger") is disjoint
  // from a mutation verb ("create", "update", "delete"). `completeTriggerTurn`
  // owns the whole completion path — a `forbidden` trigger becomes HTTP 403,
  // a `triggered` / `not-triggerable` / `not-found` turn becomes the 200
  // envelope; `undefined` means the turn is not a trigger turn.
  const triggerResponse = await completeTriggerTurn(c, {
    app: input.app,
    message: input.message,
    sessionId: input.sessionId,
    userRole: input.userRole,
    actorName: input.actorName,
    aiReply,
    rateLimitRemaining: input.rateLimitRemaining,
  })
  if (triggerResponse !== undefined) return triggerResponse

  // The mutation parser owns intent extraction (the E2E mock AI never returns
  // structured actions for these prompts), so the AI provider is used purely
  // for the conversational reply.
  const mutation = await evaluateMutationTurn({
    app: input.app,
    message: input.message,
    userId: input.actorName,
    userRole: input.userRole,
    ...(input.confirmationToken !== undefined && {
      confirmationToken: input.confirmationToken,
    }),
  })
  if (mutation.kind === 'forbidden') {
    // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
    await recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName })
    // S1 anti-enumeration: authz denials in chat (record mutation) return 404
    // so the user cannot enumerate which tables they lack write access to.
    // `mutation.message` is intentionally discarded from the response envelope.
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  return finishMutationTurn(c, input, aiReply, mutation)
}

/**
 * Complete a chat turn after the (non-forbidden) record-mutation pipeline
 * resolved it. The reply text is the executor's summary for an applied
 * mutation (so the created/updated record details surface —
 * [internal ref]), the validation message for a rejected
 * mutation, or the AI's text otherwise. Persists the exchange to conversation
 * history, records `ai.chat.message` activity, and builds the
 * `{ reply, actions, pendingConfirmation? }` envelope.
 */
const finishMutationTurn = async (
  c: Readonly<Context>,
  input: ChatTurnInput,
  aiReply: string,
  mutation: Exclude<MutationTurnResult, { kind: 'forbidden' }>
): Promise<Response> => {
  const reply = resolveReply(aiReply, mutation)

  // Persist this completed exchange so the *next* turn on the same session
  // carries it forward. The in-memory store keeps the
  // sessionless `anonymous` fallback working; durable PostgreSQL persistence
  // makes history survive a restart and powers the conversation endpoints.
  appendConversationTurn(input.sessionId, input.message, reply)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort durable-persistence side effect
  await persistTurnDurably(input.actorName, input.sessionId, input.message, reply)
  // Record the interaction in activity monitoring.
  // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
  await recordChatActivity({ action: 'ai.chat.message', actorName: input.actorName })

  const actions: ReadonlyArray<ChatAction> = mutation.kind === 'applied' ? mutation.actions : []
  const body: ChatResponse = {
    reply,
    actions: [...actions],
    sessionId: input.sessionId,
    ...(mutation.kind === 'pending' && { pendingConfirmation: mutation.pendingConfirmation }),
  }
  // Surface the remaining chat quota so clients can self-throttle
  //. Header is present only when rate limiting is set.
  if (input.rateLimitRemaining !== undefined) {
    return c.json(body, 200, {
      'X-RateLimit-Remaining': input.rateLimitRemaining.toString(),
    })
  }
  return c.json(body, 200)
}

/**
 * Complete a chat turn after the read-query pipeline answered it
 *. Persists the exchange to conversation history,
 * records an `ai.chat.query` activity row attributed to the acting user's
 * email, and builds the `{ reply, actions }` envelope
 * with the single `type: 'query'` action.
 */
const finishQueryTurn = async (
  c: Readonly<Context>,
  input: ChatTurnInput,
  reply: string,
  action: ChatAction
): Promise<Response> => {
  appendConversationTurn(input.sessionId, input.message, reply)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort durable-persistence side effect
  await persistTurnDurably(input.actorName, input.sessionId, input.message, reply)
  // Record the read query in activity monitoring with explicit user
  // attribution. Best-effort — a logging failure must
  // never break the chat turn.
  const userEmail = await resolveUserEmail(input.actorName)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
  await recordActivityLogRow({
    actorType: 'user',
    actorName: input.actorName,
    action: 'ai.chat.query',
    targetTable: action.table,
    userEmail,
  })
  return respondWithActions(c, {
    reply,
    actions: [action],
    sessionId: input.sessionId,
    rateLimitRemaining: input.rateLimitRemaining,
  })
}

/**
 * Choose the reply text for a chat turn: the mutation executor's summary /
 * message takes precedence over the raw AI text when the turn was a record
 * mutation, so the created/updated record details ([internal ref] /
 * 015) and validation errors surface to the caller.
 */
const resolveReply = (aiReply: string, mutation: MutationTurnResult): string => {
  switch (mutation.kind) {
    case 'applied':
      return mutation.summary
    case 'validation-error':
      return mutation.message
    case 'pending':
      return mutation.pendingConfirmation.description
    case 'cancelled':
      return 'Okay — the action was cancelled. No records were changed.'
    case 'none':
    case 'forbidden':
      return aiReply
  }
}
