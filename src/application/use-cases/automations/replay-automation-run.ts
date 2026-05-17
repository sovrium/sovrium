/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automation-run-repository'
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
 * Error tags surfaced by the replay flow that do not fit the existing
 * `RunAutomationError` set. Mapped to HTTP responses by the route handler.
 */
export type ReplayAutomationRunError =
  | RunAutomationError
  | { readonly _tag: 'AutomationRunNotFound'; readonly runId: string }
  | { readonly _tag: 'AutomationRunMismatch'; readonly runId: string; readonly name: string }

/**
 * Options for {@link replayAutomationRun}. Mirrors the manual/webhook entry
 * points but adds a `runId` (the persisted run to resume) and an optional
 * `triggerData` override that the caller may pass to differentiate the
 * replay from the original trigger.
 */
export interface ReplayAutomationRunOptions {
  readonly name: string
  readonly runId: string
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  /**
   * Optional trigger data override. When omitted the replay reuses the
   * original run's `triggerData` so authors can re-fire a flow with the
   * same context. The replay endpoint passes the incoming POST body
   * verbatim — empty body means "reuse the original".
   */
  readonly triggerData?: TriggerData
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
  readonly userId?: string
}

/**
 * Resolve the automation by name AND verify it matches the run's automation
 * id. Returns the schema definition so the run loop can drive execution.
 *
 * Disabled automations are NOT replayable — the operator presumably disabled
 * them for a reason; surfacing a 404 keeps the replay contract aligned with
 * the trigger contract (disabled = invisible).
 */
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

/**
 * Build the set of action names that already executed (success or failure)
 * in the original run. The replay endpoint records each of these as a
 * `'skipped'` step in the new run so callers retain the side-effects-once
 * guarantee — a record/create that fired in the original run is NOT fired
 * again on replay.
 *
 * Steps with status `'skipped'` from the original run (post-failure
 * actions that never executed) are NOT added to this set — the replay
 * fires them fresh, which is the whole point of resume-from-failure.
 *
 * APP-AUTOMATION-RETRY-013.
 */
const collectExecutedActionNames = (
  steps: ReadonlyArray<{ readonly actionName: string; readonly status: string }>
): ReadonlySet<string> =>
  new Set(
    steps
      .filter((s) => s.status !== 'skipped')
      .map((s) => s.actionName)
      .filter((name) => name !== '')
  )

/**
 * Coerce the persisted `triggerData` JSON column into a `TriggerData`
 * shape. The DB stores arbitrary JSON; only object-shaped payloads round-trip
 * back to `TriggerData`. Null / non-object data degrades gracefully to an
 * empty object (the run still replays with no trigger context).
 */
const coerceTriggerData = (raw: unknown): TriggerData => {
  if (raw === null || raw === undefined || typeof raw !== 'object') return {}
  return raw as TriggerData
}

/**
 * Replay an automation run from its previously-failed step. The semantics
 * (APP-AUTOMATION-RETRY-013):
 *
 *   1. Load the original run + its steps from `system.automation_runs` /
 *      `system.automation_run_steps`.
 *   2. Collect the set of action names that previously executed (status
 *      `completed` or `failed`) — these will be marked `'skipped'` in the
 *      new run so their side-effects fire ONCE only.
 *   3. Trigger a fresh `executeAutomationRun` against the same automation,
 *      passing the executed-action set as `skipActionNames`. The new run
 *      records the skipped steps in its `steps[]` array and executes only
 *      the previously-untouched (skipped) actions.
 *   4. The new run is persisted as a separate row in `system.automation_runs`
 *      — replay never mutates the original run's row.
 *
 * The original run's trigger data is reused unless the caller supplied an
 * override via the POST body.
 */
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
