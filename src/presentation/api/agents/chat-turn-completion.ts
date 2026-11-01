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

import { Effect } from 'effect'
import {
  rememberChatTurn,
  type ChatTurnToPersist,
} from '@/application/use-cases/agents/chat-turn/durable-memory'
import { chatResponseSchema, type ChatAction, type ChatResponse } from '@/domain/models/api/ai/chat'
import { type ContextPageScope } from '@/domain/models/app/agents/ai-chat-context'
import { type AgentTurnBinding } from '@/presentation/api/agents/agent-chat'
import {
  recordActivityLogRow,
  recordChatActivity,
} from '@/presentation/api/agents/chat-activity-log'
import { completeTriggerTurn } from '@/presentation/api/agents/chat-automation-flow'
import { appendConversationTurn } from '@/presentation/api/agents/chat-conversation-store'
import {
  evaluateMutationTurn,
  resolveUserEmail,
  type MutationTurnResult,
} from '@/presentation/api/agents/chat-mutation-flow'
import { evaluateQueryTurn } from '@/presentation/api/agents/chat-query-flow'
import { respondWithActions } from '@/presentation/api/agents/chat-tool-reply'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { respondWith } from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
import type { StoredToolCall } from '@/domain/models/app/agents/stored-tool-call-service'
import type { ChatReader } from '@/presentation/api/agents/chat-read-scope'
import type { AdmittedTurnParts } from '@/presentation/api/agents/chat-turn-parts'
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
  /**
   * Who the turn's record reads answer to: the records gates are asked for it
   * per table — its effective roles there, then its row-level read rule.
   */
  readonly reader: ChatReader
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
  /** The question as parts, when it was sent as parts (`chat-turn-parts.ts`). */
  readonly parts?: AdmittedTurnParts
}

/**
 * S1 anti-enumeration: an authorization denial in chat answers 404, so a caller
 * cannot enumerate the tables they lack access to by reading the status. The
 * refusal's own message is deliberately discarded from the envelope. The
 * refusal row is written before the answer: a spec that asserts it exists
 * right after the 404 must find it.
 */
const refuseAsNotFound = (c: Context, input: ChatTurnInput) =>
  Effect.as(
    recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName }),
    notFound(c, 'Resource not found')
  )

/** Project a turn's inputs onto the persistence shape. */
const turnToPersist = (
  input: ChatTurnInput,
  reply: string,
  read: ReadonlyArray<{ readonly type: string; readonly table?: string | undefined }> = []
): ChatTurnToPersist => {
  const assistantToolCalls = readLines(read)
  return {
    userId: input.actorName,
    sessionId: input.sessionId,
    userMessage: input.message,
    assistantReply: reply,
    userParts: input.parts?.stored,
    ...(assistantToolCalls.length > 0 && { assistantToolCalls }),
  }
}

/**
 * The lines an answer the server composed itself — a record query, a write or
 * a write awaiting confirmation — is stored with: one per table it read, as a
 * model's call is, so a later replay can tell which table the answer came from.
 */
const readLines = (
  read: ReadonlyArray<{ readonly type: string; readonly table?: string | undefined }>
): ReadonlyArray<StoredToolCall> =>
  read.flatMap(({ type, table }) =>
    table === undefined
      ? []
      : [{ id: crypto.randomUUID(), name: `chat.${type}`, outcome: 'ok' as const, table }]
  )

/**
 * Complete a chat turn after a successful AI provider response: evaluate the
 * turn against the record-mutation pipeline,
 * short-circuit to HTTP 403 on a `forbidden` outcome, persist the exchange,
 * record activity, and build the `{ reply, actions, pendingConfirmation? }`
 * response envelope.
 */
export const finishChatTurn = (c: Context, input: ChatTurnInput, aiReply: string) =>
  Effect.gen(function* () {
    // Read-query path. Evaluated before the mutation path because a query verb
    // ("show", "how many") and a mutation verb ("create", "update", "delete")
    // are disjoint — but a query message such as
    // "Show users where …; DROP TABLE users;--" must be read as a *query*, not
    // a delete. A `forbidden` query is refused as not found; an `answered`
    // query owns the reply text and the `type: 'query'` action.
    const query = yield* evaluateQueryTurn({
      app: input.app,
      message: input.message,
      sessionId: input.sessionId,
      reader: input.reader,
      ...(input.pageContext !== undefined && { pageContext: input.pageContext }),
    })
    if (query.kind === 'forbidden') return yield* refuseAsNotFound(c, input)
    if (query.kind === 'answered') return yield* finishQueryTurn(c, input, query)

    // Automation-trigger path. Evaluated before the mutation path because a
    // trigger verb ("run", "trigger") is disjoint from a mutation verb.
    // `completeTriggerTurn` owns the whole completion path; `undefined` means
    // the turn is not a trigger turn.
    const triggerResponse = yield* completeTriggerTurn(c, {
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
    const mutation = yield* evaluateMutationTurn({
      app: input.app,
      message: input.message,
      userId: input.actorName,
      userRole: input.userRole,
      reader: input.reader,
      ...(input.confirmationToken !== undefined && {
        confirmationToken: input.confirmationToken,
      }),
    })
    // S1 anti-enumeration: a refused write answers 404 so the user cannot
    // enumerate which tables they lack write access to.
    if (mutation.kind === 'forbidden') return yield* refuseAsNotFound(c, input)
    return yield* finishMutationTurn(c, input, aiReply, mutation)
  })

/** The tables a write's answer names: those it wrote, or the one awaiting confirmation. */
const mutationReads = (
  mutation: Exclude<MutationTurnResult, { kind: 'forbidden' }>
): ReadonlyArray<{ readonly type: string; readonly table?: string | undefined }> => {
  if (mutation.kind === 'applied') return mutation.actions
  if (mutation.kind === 'pending') {
    const { action, table } = mutation.pendingConfirmation
    return [{ type: action, table }]
  }
  return []
}

/**
 * Complete a chat turn after the (non-forbidden) record-mutation pipeline
 * resolved it. The reply text is the executor's summary for an applied
 * mutation (so the created/updated record details surface —
 * an AI chat mutate spec), the validation message for a rejected
 * mutation, or the AI's text otherwise. Persists the exchange to conversation
 * history, records `ai.chat.message` activity, and builds the
 * `{ reply, actions, pendingConfirmation? }` envelope.
 */
const finishMutationTurn = (
  c: Context,
  input: ChatTurnInput,
  aiReply: string,
  mutation: Exclude<MutationTurnResult, { kind: 'forbidden' }>
) =>
  Effect.gen(function* () {
    const reply = resolveReply(aiReply, mutation)

    // Persist this completed exchange so the *next* turn on the same session
    // carries it forward. The in-memory store keeps the sessionless `anonymous`
    // fallback working; durable persistence makes history survive a restart
    // and powers the conversation endpoints.
    appendConversationTurn(c, input, input.message, reply)
    yield* rememberChatTurn(turnToPersist(input, reply, mutationReads(mutation)))
    // Record the interaction in activity monitoring.
    yield* recordChatActivity({ action: 'ai.chat.message', actorName: input.actorName })

    const actions: ReadonlyArray<ChatAction> = mutation.kind === 'applied' ? mutation.actions : []
    const body: ChatResponse = {
      reply,
      actions: [...actions],
      sessionId: input.sessionId,
      ...(mutation.kind === 'pending' && { pendingConfirmation: mutation.pendingConfirmation }),
    }
    // Surface the remaining chat quota so clients can self-throttle; the header
    // is present only when rate limiting is set.
    if (input.rateLimitRemaining !== undefined) {
      c.header('X-RateLimit-Remaining', input.rateLimitRemaining.toString())
    }
    return yield* respondWith(c, Effect.succeed(body), chatResponseSchema)
  })

/**
 * Complete a chat turn after the read-query pipeline answered it
 * Persists the exchange to conversation history,
 * records an `ai.chat.query` activity row attributed to the acting user's
 * email, and builds the `{ reply, actions }` envelope
 * with the single `type: 'query'` action.
 */
const finishQueryTurn = (
  c: Context,
  input: ChatTurnInput,
  answered: { readonly reply: string; readonly action: ChatAction }
) =>
  Effect.gen(function* () {
    const { reply, action } = answered
    appendConversationTurn(c, input, input.message, reply)
    yield* rememberChatTurn(turnToPersist(input, reply, [action]))
    // Record the read query in activity monitoring with explicit user
    // attribution. Best-effort — a logging failure must never break the turn.
    const userEmail = yield* resolveUserEmail(input.actorName)
    yield* recordActivityLogRow({
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
  })

/**
 * Choose the reply text for a chat turn: the mutation executor's summary /
 * message takes precedence over the raw AI text when the turn was a record
 * mutation, so the created/updated record details (an AI chat mutate spec /
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
