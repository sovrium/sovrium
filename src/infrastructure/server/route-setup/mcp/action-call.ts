/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { type Context } from 'hono'
import { defaultActionHandlers } from '@/application/use-cases/automations/action-handlers'
import { resolveTriggerInValue } from '@/application/use-cases/automations/resolve-trigger-data'
import {
  executeAutomationRun,
  resolveAutomationId,
  type RunAutomationError,
  type RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import { isAiAccessEnabled } from '@/domain/models/shared/ai-access'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { jsonRpcError, jsonRpcSuccess } from './tool-call-helpers'
import type { McpCaller } from './auth'
import type { App } from '@/domain/models/app'
import type { ActionTemplate } from '@/domain/models/app/actions'

interface CallEnvelope {
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly responseId: number | string
}

const ACTION_INFIX = '_action_'

export const resolveActionTemplateTool = (
  app: App,
  toolName: string
): ActionTemplate | undefined => {
  const prefix = `${app.name}${ACTION_INFIX}`
  if (!toolName.startsWith(prefix)) return undefined
  const templateName = toolName.slice(prefix.length)
  if (templateName.length === 0) return undefined

  const template = (app.actions ?? []).find((t) => t.name === templateName)
  if (template === undefined) return undefined
  if (!isAiAccessEnabled(template.aiAccess)) return undefined
  return template as ActionTemplate
}

const findFirstWhitelistViolation = (
  template: ActionTemplate,
  args: Readonly<Record<string, unknown>>
): string | undefined => {
  const access = template.aiAccess
  if (typeof access !== 'object') return undefined
  if (access.fieldExposure !== 'whitelist') return undefined
  const allowed = new Set(access.whitelistFields ?? [])
  return Object.keys(args).find((name) => !allowed.has(name))
}

const findFirstMissingRequiredParam = (
  template: ActionTemplate,
  args: Readonly<Record<string, unknown>>
): string | undefined => {
  const access = template.aiAccess
  if (typeof access !== 'object') return undefined
  if (access.fieldExposure !== 'whitelist') return undefined
  const required = access.whitelistFields ?? []
  return required.find((name) => !(name in args))
}

const synthesizeAutomation = (
  template: ActionTemplate,
  args: Readonly<Record<string, unknown>>
): NonNullable<App['automations']>[number] => {
  const substitutedAction = resolveTriggerInValue(template.action, args) as Record<string, unknown>
  const synthName = `mcp-action:${template.name}`
  return {
    name: synthName,
    trigger: { type: 'manual' },
    actions: [substitutedAction],
    enabled: true,
  } as unknown as NonNullable<App['automations']>[number]
}

const actionErrorToJsonRpc = (
  c: Readonly<Context>,
  responseId: number | string,
  error: RunAutomationError
): Response => {
  if (error._tag === 'AutomationRegistrySeedError') {
    return jsonRpcError(c, responseId, -32_603, `Failed to register action template: ${error.name}`)
  }
  return jsonRpcError(c, responseId, -32_603, 'Action template execution failed')
}

const buildActionResultBody = (result: RunAutomationResult) => {
  const publicStatus: 'completed' | 'failed' = result.status === 'success' ? 'completed' : 'failed'
  return {
    id: result.runId,
    status: publicStatus,
    ...(result.lastOutput !== undefined ? { output: result.lastOutput } : {}),
    ...(result.error !== undefined ? { error: result.error } : {}),
  }
}

export interface HandleActionCallInput {
  readonly c: Readonly<Context>
  readonly app: App
  readonly caller: McpCaller
  readonly template: ActionTemplate
  readonly envelope: CallEnvelope
}

export const handleActionCall = async (input: HandleActionCallInput): Promise<Response> => {
  const { c, app, caller, template, envelope } = input

  const extra = findFirstWhitelistViolation(template, envelope.args)
  if (extra !== undefined) {
    return jsonRpcError(
      c,
      envelope.responseId,
      -32_602,
      `Parameter '${extra}' is not in aiAccess.whitelistFields`
    )
  }
  const missing = findFirstMissingRequiredParam(template, envelope.args)
  if (missing !== undefined) {
    return jsonRpcError(c, envelope.responseId, -32_602, `Missing required parameter '${missing}'`)
  }

  const automation = synthesizeAutomation(template, envelope.args)
  const program = Effect.gen(function* () {
    const automationId = yield* resolveAutomationId(automation.name, automation)
    return yield* executeAutomationRun({
      name: automation.name,
      automation,
      automationId,
      app,
      processEnv: process.env,
      triggerData: { body: envelope.args },
      handlers: defaultActionHandlers,
      userId: caller.userId,
    })
  })

  const provided = provideAutomationRuntime(program)
  const outcome = await Effect.runPromise(Effect.either(provided))

  if (outcome._tag === 'Left') {
    return actionErrorToJsonRpc(c, envelope.responseId, outcome.left)
  }
  return jsonRpcSuccess(c, envelope.responseId, buildActionResultBody(outcome.right))
}
