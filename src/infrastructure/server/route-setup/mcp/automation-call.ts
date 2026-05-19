/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect } from 'effect'
import { type Context } from 'hono'
import {
  type RunAutomationError,
  type RunAutomationResult,
} from '@/application/use-cases/automations/run-automation'
import { runManualAutomation } from '@/application/use-cases/automations/run-manual-automation'
import { isAiAccessEnabled } from '@/domain/models/shared/ai-access'
import { provideAutomationRuntime } from '@/infrastructure/automations/runtime-layer'
import { jsonRpcError, jsonRpcSuccess } from './tool-call-helpers'
import type { McpCaller } from './auth'
import type { App } from '@/domain/models/app'
import type { Automation } from '@/domain/models/app/automations'

interface CallEnvelope {
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly responseId: number | string
}

const AUTOMATION_INFIX = '_automation_'

export const resolveAutomationTool = (app: App, toolName: string): Automation | undefined => {
  const prefix = `${app.name}${AUTOMATION_INFIX}`
  if (!toolName.startsWith(prefix)) return undefined
  const automationName = toolName.slice(prefix.length)
  if (automationName.length === 0) return undefined

  const automation = (app.automations ?? []).find((a) => a.name === automationName)
  if (automation === undefined) return undefined
  if (!isAiAccessEnabled(automation.aiAccess)) return undefined
  if (automation.trigger.type !== 'manual') return undefined
  return automation
}

const callerRoleForManualTrigger = (caller: McpCaller): string => caller.role

const automationErrorToJsonRpc = (
  c: Readonly<Context>,
  responseId: number | string,
  error: RunAutomationError
): Response => {
  if (error._tag === 'AutomationManualRoleRequired') {
    return jsonRpcError(
      c,
      responseId,
      -32_603,
      `Operation not permitted: this automation requires the '${error.required}' role`
    )
  }
  if (error._tag === 'AutomationNotFound' || error._tag === 'AutomationNotManualTriggered') {
    return jsonRpcError(c, responseId, -32_601, `Automation not found: ${error.name}`)
  }
  if (error._tag === 'AutomationRegistrySeedError') {
    return jsonRpcError(c, responseId, -32_603, `Failed to register automation: ${error.name}`)
  }
  return jsonRpcError(c, responseId, -32_603, 'Automation execution failed')
}

const buildAutomationResultBody = (result: RunAutomationResult) => {
  const publicStatus: 'completed' | 'failed' = result.status === 'success' ? 'completed' : 'failed'
  return {
    id: result.runId,
    status: publicStatus,
    ...(result.lastOutput !== undefined ? { output: result.lastOutput } : {}),
    ...(result.error !== undefined ? { error: result.error } : {}),
  }
}

export interface HandleAutomationCallInput {
  readonly c: Readonly<Context>
  readonly app: App
  readonly caller: McpCaller
  readonly automation: Automation
  readonly envelope: CallEnvelope
}

export const handleAutomationCall = async (input: HandleAutomationCallInput): Promise<Response> => {
  const { c, app, caller, automation, envelope } = input
  const program = runManualAutomation({
    name: automation.name,
    app,
    processEnv: process.env,
    userRole: callerRoleForManualTrigger(caller),
    triggerData: { body: envelope.args },
    ...(caller.userId !== undefined ? { userId: caller.userId } : {}),
  })

  const provided = provideAutomationRuntime(program)
  const outcome = await Effect.runPromise(Effect.either(provided))

  if (outcome._tag === 'Left') {
    return automationErrorToJsonRpc(c, envelope.responseId, outcome.left)
  }
  return jsonRpcSuccess(c, envelope.responseId, buildAutomationResultBody(outcome.right))
}
