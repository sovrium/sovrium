/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { defaultActionHandlers, type ActionHandler, type ActionKey } from './action-handlers'
import {
  executeAutomationRun,
  resolveAutomationId,
  type ExecuteAutomationRunRequirements,
  type RunAutomationError,
  type RunAutomationResult,
} from './run-automation'
import type { TriggerData } from './resolve-trigger-data'
import type { App } from '@/domain/models/app'

const resolveCronAutomation = (
  app: App,
  name: string
): Effect.Effect<NonNullable<App['automations']>[number], RunAutomationError> => {
  const automation = app.automations?.find((a) => a.name === name)
  if (!automation) return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.enabled === false) {
    return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  }
  if (automation.trigger.type !== 'cron') {
    return Effect.fail({ _tag: 'AutomationNotWebhookTriggered' as const, name })
  }
  return Effect.succeed(automation)
}

export interface RunCronAutomationOptions {
  readonly name: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData?: TriggerData
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
}

export const runCronAutomation = ({
  name,
  app,
  processEnv,
  triggerData = { type: 'cron', firedAt: new Date().toISOString() },
  handlers = defaultActionHandlers,
}: RunCronAutomationOptions): Effect.Effect<
  RunAutomationResult,
  RunAutomationError,
  ExecuteAutomationRunRequirements
> =>
  Effect.gen(function* () {
    const automation = yield* resolveCronAutomation(app, name)
    const automationId = yield* resolveAutomationId(name, automation)
    return yield* executeAutomationRun({
      name,
      automation,
      automationId,
      app,
      processEnv,
      triggerData,
      handlers,
      userId: undefined,
    })
  })
