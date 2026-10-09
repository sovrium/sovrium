/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * AI Chat automation-trigger flow.
 *
 * Bridges the generic `/api/ai/chat` route to the {@link parseAutomationIntent}
 * domain parser and the {@link runManualAutomation} executor — the
 * orchestration layer for `[internal ref]`.
 *
 * A chat turn is a *trigger turn* when the user message parses to a recognised
 * automation-trigger intent ("Run the weekly report"). `evaluateTriggerTurn`
 * returns a {@link TriggerTurnResult} describing how the route should respond:
 *
 *  - `kind: 'none'`            — not a trigger turn (plain / query / mutation).
 *  - `kind: 'forbidden'`       — the caller's role is not permitted to trigger
 *                                this automation, by `permissions.trigger` or
 *                                by the manual trigger's `requiredRole`; the
 *                                route answers 404.
 *  - `kind: 'not-triggerable'` — the named automation exists but is NOT
 *                                manual-triggered (cron/record/webhook); chat
 *                                cannot run it.
 *  - `kind: 'not-found'`       — a trigger verb was used but no automation
 *                                matched.
 *  - `kind: 'triggered'`       — the manual automation ran; carries the
 *                                `type: 'automation'` action + reply text.
 *
 * The last automation result per session is remembered in a module-level Map
 * so a follow-up "What was the result of the last …" question can surface it.
 */

import { Effect } from 'effect'
import {
  type RunAutomationError,
  type RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import { runManualAutomation } from '@/application/use-cases/automations/run-manual-automation'
import {
  parseAutomationIntent,
  type AutomationCandidate,
} from '@/domain/models/app/agents/ai-chat-automation-parser'
import { triggerOfTypeOrFirst } from '@/domain/models/app/automations/trigger-entries-service'
import { logError } from '@/infrastructure/logging/logger'
import { recordActivityLogRow, recordChatActivity } from '@/presentation/api/ai/chat-activity-log'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { appendConversationTurn } from './chat-conversation-store'
import { persistTurnDurably } from './chat-durable-memory'
import { resolveUserEmail } from './chat-mutation-flow'
import { respondWithActions } from './chat-tool-calling'
import { admitChatTrigger } from './chat-trigger-gate'
import type { ChatTurnToPersist } from './chat-durable-memory'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type { DomainContext } from '@/infrastructure/logging/request-effect'
import type { Context } from 'hono'

/** Table-facing result of evaluating a turn for an automation trigger. */
export type TriggerTurnResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'forbidden'; readonly message: string }
  | { readonly kind: 'not-triggerable'; readonly reply: string }
  | { readonly kind: 'not-found'; readonly reply: string }
  | {
      readonly kind: 'triggered'
      readonly action: ChatAction
      readonly reply: string
      /** Run status surfaced on the response action. */
      readonly status: 'completed' | 'failed' | 'running'
      /** Run identifier — correlates with `GET /api/automations/runs/:id`. */
      readonly runId: string
    }

/** Inputs for evaluating a chat turn against the automation-trigger pipeline. */
export interface TriggerTurnInput {
  /** The server's resolved services, taken off the request that started the turn. */
  readonly services: DomainContext
  readonly app: App | undefined
  readonly message: string
  /** The acting user's role — drives the per-automation trigger RBAC gate. */
  readonly userRole: string
  /** The acting user's id — threaded into the run for activity attribution. */
  readonly userId: string
  /** The conversational reply produced by the AI provider for this turn. */
  readonly aiReply: string
}

/**
 * Project `app.automations[]` onto the minimal {@link AutomationCandidate}
 * shape the trigger parser consumes.
 */
const toAutomationCandidates = (app: App | undefined): ReadonlyArray<AutomationCandidate> =>
  (app?.automations ?? []).map((automation) => ({
    name: automation.name,
    // `manual` when one of its triggers is: the chat starts that one.
    triggerType: triggerOfTypeOrFirst(automation, 'manual').type,
  }))

/**
 * Map the engine-internal run status onto the public chat action status.
 * `'success'` → `'completed'`; everything else collapses to `'failed'`
 * (`'running'` is reserved for a future async-dispatch path).
 */
const toActionStatus = (
  status: RunAutomationResult['status']
): 'completed' | 'failed' | 'running' => (status === 'success' ? 'completed' : 'failed')

/**
 * Compose the reply text for a triggered automation: prefer the AI provider's
 * conversational text (the spec seeds run-result narratives there) and append
 * the automation name + status when the AI text does not already mention them
 * so the response stays self-describing.
 */
const composeTriggerReply = (aiReply: string, automationName: string, status: string): string => {
  const trimmed = aiReply.trim()
  if (trimmed.length > 0 && trimmed.toLowerCase().includes(automationName.toLowerCase())) {
    return trimmed
  }
  const prefix = trimmed.length > 0 ? `${trimmed} ` : ''
  return `${prefix}Automation "${automationName}" ${status}.`
}

/** Map a {@link RunAutomationError} onto the route-facing {@link TriggerTurnResult}. */
const errorToResult = (error: RunAutomationError, automationName: string): TriggerTurnResult => {
  if (error._tag === 'AutomationManualRoleRequired') {
    return {
      kind: 'forbidden',
      message: `You do not have permission to trigger the "${automationName}" automation.`,
    }
  }
  if (error._tag === 'AutomationNotManualTriggered') {
    return {
      kind: 'not-triggerable',
      reply: `The "${automationName}" automation cannot be triggered from chat — it runs on a schedule.`,
    }
  }
  if (error._tag === 'AutomationNotFound') {
    return {
      kind: 'not-found',
      reply: `The "${automationName}" automation was not found.`,
    }
  }
  // RegistrySeedError / defensive fallthrough — surface as a generic failure
  // reply rather than a 500 so the chat turn still completes.
  return {
    kind: 'triggered',
    action: {
      type: 'automation',
      description: `Automation "${automationName}" failed.`,
    },
    reply: `The "${automationName}" automation could not be completed.`,
    status: 'failed',
    runId: '',
  }
}

/**
 * Evaluate a chat turn for an automation trigger.
 *
 * Resolution order:
 *  1. Parse the message for a trigger intent — no verb → `kind: 'none'`.
 *  2. A trigger verb but no automation matched → `kind: 'not-found'`.
 *  3. A matched automation: judge it with {@link admitChatTrigger} — the
 *     `permissions.trigger` gate, then the manual trigger's role rule — and
 *     run it via `runManualAutomation` as the caller. A non-manual trigger
 *     surfaces as `kind: 'not-triggerable'`.
 */

/**
 * Project a turn's inputs onto the persistence shape.
 *
 * One expression at the call site, which is what keeps the two "complete the
 * turn" functions inside the project-wide function-length limit — they each
 * finish with a run of best-effort side effects and nothing else.
 */
const turnToPersist = (
  input: { readonly actorName: string; readonly sessionId: string; readonly message: string },
  reply: string
): ChatTurnToPersist => ({
  userId: input.actorName,
  sessionId: input.sessionId,
  userMessage: input.message,
  assistantReply: reply,
})

/**
 * Run a matched manual automation through the engine and shape the result
 * into a `kind: 'triggered'` (or error-derived) {@link TriggerTurnResult}.
 *
 * The caller's own role is passed to the engine, so the manual trigger's
 * `requiredRole` gate holds here exactly as on the direct trigger route —
 * {@link admitChatTrigger} has already judged it, and the engine re-checks it.
 */
interface RunMatchedInput {
  /** The server's resolved services: the run uses the server's renderer, permits and assets. */
  readonly services: DomainContext
  readonly app: App
  readonly name: string
  readonly message: string
  readonly userId: string
  readonly userRole: string
  readonly aiReply: string
}

const runMatchedAutomation = async (input: RunMatchedInput): Promise<TriggerTurnResult> => {
  const { services, app, name, message, userId, userRole, aiReply } = input
  const program = runManualAutomation({
    name,
    app,
    processEnv: process.env,
    userRole,
    triggerData: { body: { message } },
    userId,
    byName: true,
  })
  // On the server's own services, never a freshly built automation runtime: a
  // second build would start a second set of render permits and an EMPTY
  // asset store, so a document step run from chat could not read `{ asset }`.
  const outcome = await Effect.runPromise(Effect.result(Effect.provide(program, services)))
  if (outcome._tag === 'Failure') {
    logError(`[ai] automation "${name}" run failed (engine error)`, outcome.failure)
    return errorToResult(outcome.failure, name)
  }

  const status = toActionStatus(outcome.success.status)
  if (status === 'failed') {
    logError(
      `[ai] automation "${name}" run failed (runId=${outcome.success.runId})`,
      outcome.success.error ?? '(no error captured)'
    )
  }
  const reply = composeTriggerReply(aiReply, name, status)
  const action: ChatAction = {
    type: 'automation',
    name,
    status,
    runId: outcome.success.runId,
    description: `Automation "${name}" ${status}.`,
  }
  return { kind: 'triggered', action, reply, status, runId: outcome.success.runId }
}

export const evaluateTriggerTurn = async (input: TriggerTurnInput): Promise<TriggerTurnResult> => {
  const candidates = toAutomationCandidates(input.app)
  if (candidates.length === 0 || input.app === undefined) return { kind: 'none' }

  const intent = parseAutomationIntent(input.message, candidates)
  if (intent === undefined) return { kind: 'none' }
  if (intent.matched === 'unknown') {
    return {
      kind: 'not-found',
      reply: 'That automation was not found — it does not exist in this application.',
    }
  }

  const { name } = intent.automation
  const declared = input.app.automations?.find((a) => a.name === name)
  if (declared === undefined) {
    return { kind: 'not-found', reply: `The "${name}" automation was not found.` }
  }

  // Both gates on the CALLER's role, before any run starts: a declared
  // `permissions.trigger` narrows who may ask, and the manual trigger's
  // `requiredRole` (admin when undeclared) still holds.
  const admission = admitChatTrigger(declared, input.app, input.userRole)
  if (admission === 'forbidden') {
    return {
      kind: 'forbidden',
      message: `You do not have permission to trigger the "${name}" automation.`,
    }
  }

  // A non-manual automation cannot be invoked from chat.
  if (admission === 'not-triggerable') {
    return {
      kind: 'not-triggerable',
      reply: `The "${name}" automation cannot be triggered from chat — it runs automatically on a ${intent.automation.triggerType} schedule.`,
    }
  }

  return runMatchedAutomation({
    services: input.services,
    app: input.app,
    name,
    message: input.message,
    userId: input.userId,
    userRole: input.userRole,
    aiReply: input.aiReply,
  })
}

/** Inputs for completing an automation-trigger chat turn into a Response. */
export interface CompleteTriggerInput {
  /** The server's resolved services, taken off the request that started the turn. */
  readonly services: DomainContext
  readonly app: App | undefined
  readonly message: string
  readonly sessionId: string
  readonly userRole: string
  /** Acting user's identifier — written to the activity log + history. */
  readonly actorName: string
  /** The conversational reply the AI provider produced for this turn. */
  readonly aiReply: string
  /** Remaining chat quota, surfaced as `X-RateLimit-Remaining` when set. */
  readonly rateLimitRemaining: number | undefined
}

/**
 * Evaluate a chat turn for an automation trigger and — when it IS a trigger
 * turn — build the complete HTTP `Response`. Returns `undefined` when the turn
 * is not a trigger turn so the route can fall through to the mutation path.
 *
 * Side effects (all best-effort): the completed exchange is persisted to
 * conversation history, and a `triggered` turn records an `ai.chat.automation`
 * activity row attributed to the acting user's email.
 * A `forbidden` turn records an `ai.chat.error` row and returns HTTP 403
 * `not-triggerable` / `not-found` turns return
 * a plain reply with an empty `actions[]` array.
 */
export const completeTriggerTurn = async (
  c: Context,
  input: CompleteTriggerInput
): Promise<Response | undefined> => {
  const trigger = await evaluateTriggerTurn({
    services: input.services,
    app: input.app,
    message: input.message,
    userRole: input.userRole,
    userId: input.actorName,
    aiReply: input.aiReply,
  })
  if (trigger.kind === 'none') return undefined

  if (trigger.kind === 'forbidden') {
    await recordChatActivity(input.services, {
      action: 'ai.chat.error',
      actorName: input.actorName,
    })
    // S1 anti-enumeration: automation-trigger authz denials return 404 so the
    // user cannot discover which automations exist but are admin-only.
    // `trigger.message` is intentionally discarded from the response envelope.
    return notFound(c, 'Resource not found')
  }

  const { reply } = trigger
  appendConversationTurn(input.sessionId, input.message, reply)
  await persistTurnDurably(input.services, turnToPersist(input, reply))

  if (trigger.kind === 'triggered') {
    const userEmail = await resolveUserEmail(input.services, input.actorName)
    await recordActivityLogRow(input.services, {
      actorType: 'user',
      actorName: input.actorName,
      action: 'ai.chat.automation',
      userEmail,
    })
    return respondWithActions(c, {
      reply,
      actions: [trigger.action],
      sessionId: input.sessionId,
      rateLimitRemaining: input.rateLimitRemaining,
    })
  }

  // `not-triggerable` / `not-found` — record a plain message activity row and
  // return an empty `actions[]` array.
  await recordChatActivity(input.services, {
    action: 'ai.chat.message',
    actorName: input.actorName,
  })
  return respondWithActions(c, {
    reply,
    actions: [],
    sessionId: input.sessionId,
    rateLimitRemaining: input.rateLimitRemaining,
  })
}
