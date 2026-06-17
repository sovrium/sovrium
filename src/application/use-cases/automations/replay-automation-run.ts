/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
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

export type ReplayAutomationRunError =
  | RunAutomationError
  | { readonly _tag: 'AutomationRunNotFound'; readonly runId: string }
  | { readonly _tag: 'AutomationRunMismatch'; readonly runId: string; readonly name: string }

export interface ReplayAutomationRunOptions {
  readonly name: string
  readonly runId: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData?: TriggerData
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId?: string
}

const resolveReplayTarget = (
  app: App,
  name: string
): Effect.Effect<NonNullable<App['automations']>[number], ReplayAutomationRunError> => {
  const automation = app.automations?.find((a) => a.name === name)
  if (!automation) return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (automation.enabled === false)
    return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  return Effect.succeed(automation)
}

const collectExecutedActionNames = (
  steps: ReadonlyArray<{ readonly actionName: string; readonly status: string }>
): ReadonlySet<string> =>
  new Set(
    steps
      .filter((s) => s.status !== 'skipped')
      .map((s) => s.actionName)
      .filter((name) => name !== '')
  )

const coerceTriggerData = (raw: unknown): TriggerData => {
  if (raw === null || raw === undefined || typeof raw !== 'object') return {}
  return raw as TriggerData
}

export const replayAutomationRun = (
  options: ReplayAutomationRunOptions
): Effect.Effect<
  RunAutomationResult,
  ReplayAutomationRunError,
  AutomationRunRepository | ExecuteAutomationRunRequirements
> =>
  Effect.gen(function* () {
    const { name, runId, app, processEnv, triggerData, userId } = options
    const handlers = options.handlers ?? defaultActionHandlers

    const repo = yield* AutomationRunRepository
    const run = yield* repo
      .findById(runId)
      .pipe(Effect.mapError(() => ({ _tag: 'AutomationRunNotFound' as const, runId })))
    if (run === undefined) {
      return yield* Effect.fail({ _tag: 'AutomationRunNotFound' as const, runId })
    }
    if (run.automationName !== name) {
      return yield* Effect.fail({ _tag: 'AutomationRunMismatch' as const, runId, name })
    }

    const automation = yield* resolveReplayTarget(app, name)
    const steps = yield* repo
      .findStepsByRunId(runId)
      .pipe(Effect.mapError(() => ({ _tag: 'AutomationRunNotFound' as const, runId })))
    const skipActionNames = collectExecutedActionNames(steps)

    const automationId = yield* resolveAutomationId(name, automation)
    const replayTriggerData = triggerData ?? coerceTriggerData(run.triggerData)

    return yield* executeAutomationRun({
      name,
      automation,
      automationId,
      app,
      processEnv,
      triggerData: replayTriggerData,
      handlers,
      userId,
      skipActionNames,
    })
  })
