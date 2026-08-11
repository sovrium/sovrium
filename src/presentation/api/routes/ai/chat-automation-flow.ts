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
 * orchestration layer for `[internal ref]`
 *.
 *
 * A chat turn is a *trigger turn* when the user message parses to a recognised
 * automation-trigger intent ("Run the weekly report"). `evaluateTriggerTurn`
 * returns a {@link TriggerTurnResult} describing how the route should respond:
 *
 *  - `kind: 'none'`            — not a trigger turn (plain / query / mutation).
 *  - `kind: 'forbidden'`       — the caller's role is not permitted to trigger
 * this automation;
 *                                the route maps it to HTTP 403.
 *  - `kind: 'not-triggerable'` — the named automation exists but is NOT
 *                                manual-triggered (cron/record/webhook); chat
 * cannot run it.
 *  - `kind: 'not-found'`       — a trigger verb was used but no automation
 * matched.
 *  - `kind: 'triggered'`       — the manual automation ran; carries the
 *                                `type: 'automation'` action + reply text.
 *
 * The last automation result per session is remembered in a module-level Map
 * so a follow-up "What was the result of the last …" question can surface it
 *.
 */

import { Effect } from 'effect'
import {
  type RunAutomationError,
  type RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import { runManualAutomation } from '@/application/use-cases/automations/run-manual-automation'
import {
  evaluatePermission,
  OPEN_WHEN_UNDECLARED,
  permits,
} from '@/domain/models/shared/permission-evaluation'
import {
  parseAutomationIntent,
  type AutomationCandidate,
} from '@/domain/services/ai-chat/ai-chat-automation-parser'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { logError } from '@/infrastructure/logging/logger'
import { recordActivityLogRow, recordChatActivity } from './chat-activity-log'
import { appendConversationTurn } from './chat-conversation-store'
import { persistTurnDurably } from './chat-durable-memory'
import { resolveUserEmail } from './chat-mutation-flow'
import { respondWithActions } from './chat-tool-calling'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type { PermissionValue } from '@/domain/models/shared/permissions'
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
    triggerType: automation.trigger.type,
  }))

/**
 * Evaluate a single permission value (`'all'`, `'authenticated'`, a role
 * array, or undefined) against the acting role. An undeclared `permissions.
 * trigger` defaults to permissive — automations are triggerable by any
 * authenticated user unless the schema author restricts them.
 */
const triggerRoleAllowed = (permission: PermissionValue | undefined, userRole: string): boolean =>
  permits(
    // An admin always satisfies a role-array gate — admin subsumes every
    // custom role, mirroring `runManualAutomation`'s role hierarchy.
    evaluatePermission(
      permission,
      { role: userRole },
      {
        whenUndeclared: OPEN_WHEN_UNDECLARED,
        adminOverride: 'admin-outranks-role-list',
      }
    )
  )

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
 *  3. A matched automation: enforce the per-automation `permissions.trigger`
 *     RBAC gate (403 on denial), then run it via `runManualAutomation`. A
 *     non-manual trigger surfaces as `kind: 'not-triggerable'`.
 */
/**
 * Run a matched manual automation through the engine and shape the result
 * into a `kind: 'triggered'` (or error-derived) {@link TriggerTurnResult}.
 *
 * Chat-trigger RBAC is owned by the `permissions.trigger` gate in
 * {@link evaluateTriggerTurn} — already satisfied by the time this runs. The
 * engine's own `requiredRole` gate (which defaults to `'admin'` for the
 * *direct* manual-trigger HTTP route) must NOT additionally apply, so
 * `userRole: 'admin'` is passed to make it a no-op ([internal ref] /
 * REGRESSION run a restriction-free automation as a `member` and expect
 * success).
 */
interface RunMatchedInput {
  readonly app: App
  readonly name: string
  readonly message: string
  readonly userId: string
  readonly aiReply: string
}

const runMatchedAutomation = async (input: RunMatchedInput): Promise<TriggerTurnResult> => {
  const { app, name, message, userId, aiReply } = input
  const program = runManualAutomation({
    name,
    app,
    processEnv: process.env,
    userRole: 'admin',
    triggerData: { body: { message } },
    userId,
  })
  const outcome = await Effect.runPromise(Effect.either(provideAutomationRuntime(program)))
  if (outcome._tag === 'Left') {
    logError(`[ai] automation "${name}" run failed (engine error)`, outcome.left)
    return errorToResult(outcome.left, name)
  }

  const status = toActionStatus(outcome.right.status)
  if (status === 'failed') {
    logError(
      `[ai] automation "${name}" run failed (runId=${outcome.right.runId})`,
      outcome.right.error ?? '(no error captured)'
    )
  }
  const reply = composeTriggerReply(aiReply, name, status)
  const action: ChatAction = {
    type: 'automation',
    name,
    status,
    runId: outcome.right.runId,
    description: `Automation "${name}" ${status}.`,
  }
  return { kind: 'triggered', action, reply, status, runId: outcome.right.runId }
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

  // Per-automation trigger RBAC gate. The
  // schema's `permissions.trigger` is matched against the acting role BEFORE
  // the run starts so a denied caller never triggers a run.
  if (!triggerRoleAllowed(declared?.permissions?.trigger, input.userRole)) {
    return {
      kind: 'forbidden',
      message: `You do not have permission to trigger the "${name}" automation.`,
    }
  }

  // A non-manual automation cannot be invoked from chat.
  if (intent.automation.triggerType !== 'manual') {
    return {
      kind: 'not-triggerable',
      reply: `The "${name}" automation cannot be triggered from chat — it runs automatically on a ${intent.automation.triggerType} schedule.`,
    }
  }

  return runMatchedAutomation({
    app: input.app,
    name,
    message: input.message,
    userId: input.userId,
    aiReply: input.aiReply,
  })
}

/** Inputs for completing an automation-trigger chat turn into a Response. */
export interface CompleteTriggerInput {
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
 *. `not-triggerable` / `not-found` turns return
 * a plain reply with an empty `actions` array.
 */
export const completeTriggerTurn = async (
  c: Readonly<Context>,
  input: CompleteTriggerInput
): Promise<Response | undefined> => {
  const trigger = await evaluateTriggerTurn({
    app: input.app,
    message: input.message,
    userRole: input.userRole,
    userId: input.actorName,
    aiReply: input.aiReply,
  })
  if (trigger.kind === 'none') return undefined

  if (trigger.kind === 'forbidden') {
    // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
    await recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName })
    // S1 anti-enumeration: automation-trigger authz denials return 404 so the
    // user cannot discover which automations exist but are admin-only.
    // `trigger.message` is intentionally discarded from the response envelope.
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  const { reply } = trigger
  appendConversationTurn(input.sessionId, input.message, reply)
  // eslint-disable-next-line functional/no-expression-statements -- best-effort durable-persistence side effect
  await persistTurnDurably(input.actorName, input.sessionId, input.message, reply)

  if (trigger.kind === 'triggered') {
    const userEmail = await resolveUserEmail(input.actorName)
    // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
    await recordActivityLogRow({
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
  // return an empty `actions` array.
  // eslint-disable-next-line functional/no-expression-statements -- best-effort activity-log side effect
  await recordChatActivity({ action: 'ai.chat.message', actorName: input.actorName })
  return respondWithActions(c, {
    reply,
    actions: [],
    sessionId: input.sessionId,
    rateLimitRemaining: input.rateLimitRemaining,
  })
}
