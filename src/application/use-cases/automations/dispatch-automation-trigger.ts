/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationRepository } from '@/application/ports/repositories/automations/automation-repository'
import { defaultActionHandlers } from './action-handlers'
import {
  executeAutomationRun,
  type ExecuteAutomationRunRequirements,
  type RunAutomationResult,
} from './run-automation'
import type { TriggerData } from './resolve-trigger-data'
import type { App } from '@/domain/models/app'

export const resolveAutomationIdSilent = (
  name: string,
  automation: NonNullable<App['automations']>[number]
): Effect.Effect<string | undefined, never, AutomationRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRepository
    const findResult = yield* Effect.either(repo.findByName(name))
    if (
      findResult._tag === 'Right' &&
      findResult.right !== undefined &&
      typeof findResult.right['id'] === 'string'
    ) {
      return findResult.right['id']
    }
    const createResult = yield* Effect.either(
      repo.create({
        name,
        trigger: automation.trigger as unknown as Record<string, unknown>,
        actions: automation.actions as unknown as readonly Record<string, unknown>[],
        enabled: automation.enabled ?? true,
      })
    )
    if (createResult._tag !== 'Right') return undefined
    const created = createResult.right
    if (typeof created['id'] !== 'string') return undefined
    return created['id']
  })

export const dispatchAutomationOnce = (input: {
  readonly automation: NonNullable<App['automations']>[number]
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData: TriggerData
  readonly userId: string | undefined
}): Effect.Effect<RunAutomationResult | undefined, never, ExecuteAutomationRunRequirements> =>
  Effect.gen(function* () {
    const { automation, app, processEnv, triggerData, userId } = input
    const automationId = yield* resolveAutomationIdSilent(automation.name, automation)
    if (automationId === undefined) return undefined

    return yield* executeAutomationRun({
      name: automation.name,
      automation,
      automationId,
      app,
      processEnv,
      triggerData,
      handlers: defaultActionHandlers,
      userId,
    })
  })
