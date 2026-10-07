/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The per-run `StepContext` the run loop threads to every step: what stays
 * constant across a run's steps, assembled once after the scheduler persisted
 * the queued row (so the run id is known).
 */

import { buildEnvLookup } from '../resolve-env-vars'
import { buildAutomationContext, type TriggerData } from '../resolve-trigger-data'
import { buildRecordEventChannel } from './record-event-channel'
import { toResolvedRetry, type StepContext } from './types'
import type { ActionHandler, ActionKey } from '../action-handlers'
import type { AutomationContext } from '../action-handlers/shared'
import type { App } from '@/domain/models/app'

/**
 * The identity a step's handlers see: the automation, its caller (if any), the
 * persisted run id, and whether the caller started it by hand — the marker that
 * makes record actions write as them.
 */
const toAutomationContext = (input: {
  readonly name: string
  readonly automationId: string
  readonly userId: string | undefined
  readonly runId?: string
  readonly startedByHand?: boolean
}): AutomationContext => ({
  name: input.name,
  id: input.automationId,
  ...(input.userId !== undefined ? { userId: input.userId } : {}),
  ...(input.runId !== undefined ? { runId: input.runId } : {}),
  // Kept even without a caller: a hand-started run whose caller is gone (an
  // account erased while the run waited on an approval) must write nothing,
  // never fall back to writing as the system.
  ...(input.startedByHand === true ? { startedByHand: true as const } : {}),
})

/**
 * Build a `StepContext` for the run loop.
 */
export const buildStepContext = (input: {
  readonly name: string
  readonly automationId: string
  readonly app: App
  readonly automation: NonNullable<App['automations']>[number]
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly triggerData: TriggerData
  readonly handlers: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId: string | undefined
  readonly startedByHand?: boolean
  readonly propsFinal?: boolean
  readonly callDepth?: number
  readonly recordEventDepth?: number
  readonly visitedAutomations?: ReadonlySet<string>
  /**
   * The persisted `system.automation_runs.id` for this run. Threaded into the
   * per-step `AutomationContext` so the `approval/request` handler can FK its
   * pending row to the run it pauses. Resolved by the scheduler
   * AFTER the queued row lands, so the orchestrator builds the context once the
   * runId is known.
   */
  readonly runId?: string
  /** See `StepContext.runProgram` — captured from the running fiber. */
  readonly runProgram: StepContext['runProgram']
  /** See `StepContext.templates` — read from the `TemplateEngine` port. */
  readonly templates: StepContext['templates']
}): StepContext => {
  const { name, automationId, app, automation, processEnv, triggerData, handlers } = input
  const recordEventDepth = input.recordEventDepth ?? 0
  const automationContext = toAutomationContext({ ...input, name, automationId })
  return {
    app,
    runProgram: input.runProgram,
    envLookup: buildEnvLookup(app.env, processEnv),
    processEnv,
    handlers,
    templateContext: buildAutomationContext(triggerData),
    templates: input.templates,
    automation: automationContext,
    triggerData: triggerData as Readonly<Record<string, unknown>>,
    automationRetry: toResolvedRetry(automation.retry),
    callDepth: input.callDepth ?? 0,
    visitedAutomations: new Set([...(input.visitedAutomations ?? []), name]),
    recordEventDepth,
    recordEvents: buildRecordEventChannel({
      app,
      processEnv,
      automation: automationContext,
      recordEventDepth,
      runProgram: input.runProgram,
    }),
    ...(input.propsFinal === true ? { propsFinal: true as const } : {}),
  }
}
