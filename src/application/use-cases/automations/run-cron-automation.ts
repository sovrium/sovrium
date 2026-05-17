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

/**
 * Locate a cron-triggered automation by name and reject states that should
 * not produce a run (missing, disabled, or non-cron trigger). Mirrors the
 * webhook/manual variants so cron-bound entries get the same defensive
 * filtering before execution.
 */
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
    // Re-use the webhook-shaped error tag — the cron runner is internal,
    // not exposed to HTTP, and the run-history persistence path doesn't
    // distinguish per-trigger error kinds.
    return Effect.fail({ _tag: 'AutomationNotWebhookTriggered' as const, name })
  }
  return Effect.succeed(automation)
}

/**
 * Options bag for {@link runCronAutomation}. Mirrors the webhook entry
 * point's shape (no `userRole` since cron-fired runs are system-triggered).
 */
export interface RunCronAutomationOptions {
  readonly name: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /**
   * Trigger data exposed to actions through `{{trigger.X}}`. Cron runs have
   * no upstream payload so this defaults to a synthetic envelope describing
   * the schedule (`type`, `firedAt`).
   */
  readonly triggerData?: TriggerData
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
}

/**
 * Execute a cron-triggered automation by name.
 *
 * Distinct from the webhook entry point because cron-fired runs:
 *  1. Bypass HTTP — the live `CronScheduler` adapter calls this directly
 *     when a timer fires.
 *  2. Are system-triggered (no `userId`).
 *  3. Synthesise an empty trigger envelope (the schedule produced no
 *     external payload).
 *
 * Same persistence + run-history contract as the other entry points — both
 * funnel through `executeAutomationRun`.
 */
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
