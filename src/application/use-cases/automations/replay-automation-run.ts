/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { isAutomationOperationallyEnabled } from '@/domain/models/app/automations/automation-operational-state'
import {
  OUTSIDE_RELAY,
  parseRelay,
  type RunRelay,
} from '@/domain/models/app/automations/run-relay-service'
import {
  handStarterOfStoredRun,
  type StoredRunStarter,
} from '@/domain/models/app/automations/run-starter-service'
import {
  hasRunEnded,
  isRunPaused,
  keepsMinimalHistory,
} from '@/domain/models/app/automations/trigger/trigger-history-service'
import { redactRunTriggerData } from '@/domain/models/app/automations/trigger/webhook-credential-headers-service'
import { triggerNamedOrFirst } from '@/domain/models/app/automations/trigger-entries-service'
import { defaultActionHandlers, type ActionHandler, type ActionKey } from './action-handlers'
import { loadPausedAutomationNames } from './paused-automation-names'
import { outputsOfRows, toleratedInRows } from './run/resume-plan'
import {
  executeAutomationRun,
  resolveAutomationId,
  type ExecuteAutomationRunRequirements,
  type RunAutomationError,
  type RunAutomationResult,
} from './run-automation'
import type { TriggerData } from './resolve-trigger-data'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type {
  AutomationRunDatabaseError,
  PersistedStep,
} from '@/application/ports/repositories/automations/automation-run-repository'
import type { App } from '@/domain/models/app'

/**
 * Error tags surfaced by the replay flow that do not fit the existing
 * `RunAutomationError` set. Mapped to HTTP responses by the route handler.
 *
 * `AutomationRunDatabaseError` is a member in its own right, NOT folded into
 * `AutomationRunNotFound`. A `mapError(() => AutomationRunNotFound)` over the
 * repository read answers "no such run" when the truth is "the store did not
 * answer": a 404 for a run the caller can see, and a non-alerting one for the
 * operator with the database on fire. Absence is decided from an `undefined`
 * row; a failure stays a failure and reaches the route as a 5xx.
 */
export type ReplayAutomationRunError =
  | RunAutomationError
  | AutomationRunDatabaseError
  | { readonly _tag: 'AutomationRunNotFound'; readonly runId: string }
  | { readonly _tag: 'AutomationRunMismatch'; readonly runId: string; readonly name: string }
  /** A `history: 'minimal'` run kept no trigger data, and none was supplied: nothing to replay. */
  | { readonly _tag: 'AutomationRunHistoryNotKept'; readonly runId: string }

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
  /**
   * Optional trigger data override. When omitted the replay reuses the
   * original run's `triggerData` so authors can re-fire a flow with the
   * same context. The replay endpoint passes the incoming POST body
   * verbatim — empty body means "reuse the original".
   */
  readonly triggerData?: TriggerData
  readonly handlers?: ReadonlyMap<ActionKey, ActionHandler>
  /**
   * The person the replay acts as, when one is named (the console's retry
   * names its admin). Omitted: the run's own starter, or the system.
   */
  readonly userId?: string
}

/**
 * Resolve the automation by name AND verify it matches the run's automation
 * id. Returns the schema definition so the run loop can drive execution.
 *
 * Automations that are OFF are NOT replayable — whether disabled in config or
 * operationally paused, the operator turned them off for a reason, and a replay
 * is a NEW run. Surfacing a 404 keeps the replay contract aligned with the
 * trigger contract (off = invisible).
 */
const resolveReplayTarget = (
  app: App,
  name: string,
  pausedNames: ReadonlySet<string>
): Effect.Effect<NonNullable<App['automations']>[number], ReplayAutomationRunError> => {
  const automation = app.automations?.find((a) => a.name === name)
  if (!automation) return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  if (!isAutomationOperationallyEnabled(automation, pausedNames))
    return Effect.fail({ _tag: 'AutomationNotFound' as const, name })
  return Effect.succeed(automation)
}

/** Where a replay of a run picks up, read from the run's stored steps. */
interface ReplayPlan {
  /** The actions recorded `'skipped'` without running: the ones before the resume point. */
  readonly skipActionNames: ReadonlySet<string>
  /** What those actions produced in the replayed run, so later steps read the same values. */
  readonly seedOutputs: Readonly<Record<string, Record<string, unknown>>>
  /** Failures `continueOnError` let those actions go past: the replay still owes them. */
  readonly priorTolerated: number
}

/**
 * The stored row a replay resumes at: the first step the run recorded
 * `'failed'`. A run that timed out records the step it interrupted, and every
 * one after it, `'skipped'`: it resumes at the first of those trailing rows.
 *
 * Any other run has no resume point, on purpose. A filter that stopped the
 * run, an approval it waits on or was refused, an early `return`: each leaves
 * the actions after it unrecorded or unrun ON PURPOSE, and a replay that ran
 * them would execute what the filter or the approval guards. Such a run
 * replays no step.
 */
const resumeRowOf = (steps: readonly PersistedStep[], runStatus: string): number | undefined => {
  const failed = steps.findIndex((row) => row.status === 'failed')
  if (failed !== -1) return failed
  if (runStatus !== 'timed-out') return undefined
  const cut = steps.findLastIndex((row) => row.status !== 'skipped') + 1
  return cut < steps.length ? cut : undefined
}

/**
 * Plan a replay: the actions before the resume point are recorded `'skipped'`
 * and do not run again (their side effects fire once), their stored outputs
 * are handed to the replay, and the step that failed runs again with every
 * one after it. A run with no resume point, or one whose resume step the
 * current configuration no longer declares, skips every action.
 */
const planReplay = (
  actions: ReadonlyArray<{ readonly name?: unknown }>,
  steps: readonly PersistedStep[],
  runStatus: string
): ReplayPlan => {
  const names = actions.map((action) => String(action.name ?? '')).filter((name) => name !== '')
  const resumeRow = resumeRowOf(steps, runStatus)
  const resumeName = resumeRow === undefined ? undefined : steps[resumeRow]?.actionName
  const position = resumeName === undefined ? -1 : names.indexOf(resumeName)
  if (resumeRow === undefined || position === -1) {
    return { skipActionNames: new Set(names), seedOutputs: {}, priorTolerated: 0 }
  }
  const before = steps.slice(0, resumeRow)
  return {
    skipActionNames: new Set(names.slice(0, position)),
    seedOutputs: outputsOfRows(before),
    priorTolerated: toleratedInRows(before),
  }
}

/** Who a replay runs as — see the call site. A starter banned since is not run as. */
const replayActorOf = (run: StoredRunStarter, actingUserId: string | undefined) => {
  if (actingUserId !== undefined) return { userId: actingUserId }
  const starter = handStarterOfStoredRun(run)
  return starter === undefined
    ? { userId: undefined }
    : ({ ...starter, checkStarterStanding: true } as const)
}

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
 * Whether a minimal or none run's row still holds the trigger data it started
 * on: one paused, which stores it for its resume, or one that ended before its
 * level dropped it. Under way, its row holds it without the body.
 */
const keptWhole = (run: { readonly status: string; readonly triggerData: unknown }): boolean =>
  run.triggerData !== null && (isRunPaused(run.status) || hasRunEnded(run.status))

/** The relay a replay records: the replayed run's own, or `outside` for new trigger data. */
const replayRelayOf = (relay: unknown, supplied: boolean): { readonly relay?: RunRelay } => {
  if (supplied) return { relay: OUTSIDE_RELAY }
  const kept = parseRelay(relay)
  return kept === undefined ? {} : { relay: kept }
}

/**
 * Replay an automation run from the step that failed. The semantics:
 *
 *   1. Load the original run and its steps from `system.automation_runs` /
 *      `system.automation_run_steps`.
 *   2. Find the resume point: the first step the run recorded `failed` (for
 *      a run that timed out, the step the timeout interrupted).
 *   3. Run a fresh `executeAutomationRun` against the same automation: the
 *      actions before the resume point are recorded `'skipped'` and do not
 *      run again, so their side effects fire once, and their stored outputs
 *      seed the run, so a later step's `{{<earlier step>.…}}` reads what the
 *      original produced. The failed step runs again, and every step after it.
 *   4. The new run is persisted as a separate row in `system.automation_runs`:
 *      replay never mutates the original run's row.
 *
 * A full rerun is not a replay: it is the automation triggered again. The
 * original run's trigger data is reused unless the caller supplied new data.
 */
export const replayAutomationRun = (
  options: ReplayAutomationRunOptions
): Effect.Effect<
  RunAutomationResult,
  ReplayAutomationRunError,
  AutomationRunRepository | ExecuteAutomationRunRequirements | AutomationPauseRepository
> =>
  Effect.gen(function* () {
    const { name, runId, app, triggerData } = options
    const handlers = options.handlers ?? defaultActionHandlers

    const repo = yield* AutomationRunRepository
    // No `mapError`: a read that FAILED is not a read that found nothing.
    const run = yield* repo.findById(runId)
    if (run === undefined) {
      return yield* Effect.fail({ _tag: 'AutomationRunNotFound' as const, runId })
    }
    if (run.automationName !== name) {
      return yield* Effect.fail({ _tag: 'AutomationRunMismatch' as const, runId, name })
    }

    // Entry point: one read of the operational pauses, threaded into the gate.
    const pausedNames = yield* loadPausedAutomationNames
    const automation = yield* resolveReplayTarget(app, name, pausedNames)
    // A run of a `history: 'minimal'` trigger keeps no trigger data once it
    // ended, and no body while it is under way: replaying it needs new trigger
    // data, or there is nothing (or only part of it) to replay.
    const trigger = triggerNamedOrFirst(automation, run.triggerName)
    if (triggerData === undefined && keepsMinimalHistory(trigger) && !keptWhole(run)) {
      return yield* Effect.fail({ _tag: 'AutomationRunHistoryNotKept' as const, runId })
    }
    const steps = yield* repo.findStepsByRunId(runId)
    const plan = planReplay(
      automation.actions as ReadonlyArray<{ readonly name?: unknown }>,
      steps,
      run.status
    )

    const automationId = yield* resolveAutomationId(name, automation)
    // A run recorded before credential headers were kept as a marker replays
    // with them hidden, as every read of it shows them.
    const replayTriggerData =
      triggerData ?? coerceTriggerData(redactRunTriggerData(run.triggerData, automation))

    return yield* executeAutomationRun({
      name,
      automation,
      // A replay is recorded under the trigger entry of the run it replays.
      trigger,
      automationId,
      app,
      triggerData: replayTriggerData,
      handlers,
      // Who the replay runs as. The console's retry names its admin (`userId`).
      // Otherwise a hand-started run replays as the person who started it —
      // under their permissions, and still theirs to read — as an approval
      // resume does, and any other replays system-side. Never the replayer: an
      // approver replaying someone's run does not borrow, nor become, its starter.
      ...replayActorOf(run, options.userId),
      skipActionNames: plan.skipActionNames,
      seedOutputs: plan.seedOutputs,
      priorTolerated: plan.priorTolerated,
      // A replay keeps the relay of the run it replays; new trigger data an
      // admin supplied came from outside the app.
      ...replayRelayOf(run.relay, triggerData !== undefined),
    })
  }).pipe(Effect.withSpan('automations.replay-automation-run'))
