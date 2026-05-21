/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
} from '@/domain/services/ai-chat-automation-parser'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { recordActivityLogRow, recordChatActivity } from './chat-activity-log'
import { appendConversationTurn } from './chat-conversation-store'
import { persistTurnDurably } from './chat-durable-memory'
import { resolveUserEmail } from './chat-mutation-flow'
import { respondWithActions } from './chat-tool-calling'
import type { ChatAction } from '@/domain/models/api/ai/chat'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

export type TriggerTurnResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'forbidden'; readonly message: string }
  | { readonly kind: 'not-triggerable'; readonly reply: string }
  | { readonly kind: 'not-found'; readonly reply: string }
  | {
      readonly kind: 'triggered'
      readonly action: ChatAction
      readonly reply: string
      readonly status: 'completed' | 'failed' | 'running'
      readonly runId: string
    }

export interface TriggerTurnInput {
  readonly app: App | undefined
  readonly message: string
  readonly userRole: string
  readonly userId: string
  readonly aiReply: string
}

const toAutomationCandidates = (app: App | undefined): ReadonlyArray<AutomationCandidate> =>
  (app?.automations ?? []).map((automation) => ({
    name: automation.name,
    triggerType: automation.trigger.type,
  }))

const triggerRoleAllowed = (permission: unknown, userRole: string): boolean => {
  if (permission === undefined) return true
  if (permission === 'all' || permission === 'authenticated') return true
  if (Array.isArray(permission)) {
    return permission.includes(userRole) || userRole === 'admin'
  }
  return false
}

const toActionStatus = (
  status: RunAutomationResult['status']
): 'completed' | 'failed' | 'running' => (status === 'success' ? 'completed' : 'failed')

const composeTriggerReply = (aiReply: string, automationName: string, status: string): string => {
  const trimmed = aiReply.trim()
  if (trimmed.length > 0 && trimmed.toLowerCase().includes(automationName.toLowerCase())) {
    return trimmed
  }
  const prefix = trimmed.length > 0 ? `${trimmed} ` : ''
  return `${prefix}Automation "${automationName}" ${status}.`
}

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
    return errorToResult(outcome.left, name)
  }

  const status = toActionStatus(outcome.right.status)
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

  if (!triggerRoleAllowed(declared?.permissions?.trigger, input.userRole)) {
    return {
      kind: 'forbidden',
      message: `You do not have permission to trigger the "${name}" automation.`,
    }
  }

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

export interface CompleteTriggerInput {
  readonly app: App | undefined
  readonly message: string
  readonly sessionId: string
  readonly userRole: string
  readonly actorName: string
  readonly aiReply: string
  readonly rateLimitRemaining: number | undefined
}

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
    await recordChatActivity({ action: 'ai.chat.error', actorName: input.actorName })
    return c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)
  }

  const { reply } = trigger
  appendConversationTurn(input.sessionId, input.message, reply)
  await persistTurnDurably(input.actorName, input.sessionId, input.message, reply)

  if (trigger.kind === 'triggered') {
    const userEmail = await resolveUserEmail(input.actorName)
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

  await recordChatActivity({ action: 'ai.chat.message', actorName: input.actorName })
  return respondWithActions(c, {
    reply,
    actions: [],
    sessionId: input.sessionId,
    rateLimitRemaining: input.rateLimitRemaining,
  })
}
