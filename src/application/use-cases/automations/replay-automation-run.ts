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
import { redactRunTriggerData } from '@/domain/models/app/automations/trigger/webhook-credential-headers-service'
import { triggerNamedOrFirst } from '@/domain/models/app/automations/trigger-entries-service'
import { defaultActionHandlers, type ActionHandler, type ActionKey } from './action-handlers'
import { loadPausedAutomationNames } from './paused-automation-names'
import {
  executeAutomationRun,
  resolveAutomationId,
  type ExecuteAutomationRunRequirements,
  type RunAutomationError,
  type RunAutomationResult,
} from './run-automation'
import type { TriggerData } from './resolve-trigger-data'
import type { AutomationPauseRepository } from '@/application/ports/repositories/automations/automation-pause-repository'
import type { AutomationRunDatabaseError } from '@/application/ports/repositories/automations/automation-run-repository'
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

/**
 * The actions a replay records as `'skipped'` without running: every action of
 * the automation EXCEPT those the original run recorded `'skipped'` — the tail
 * a failure cut off (an automation retry spec records it so). The replay runs
 * that tail and nothing else.
 *
 * The complement, rather than "everything that ran", because what a run did
 * NOT record matters as much as what it did. A filter that stopped the run, an
 * approval it waits on or was refused, an early `return` — each leaves the
 * actions after it unrecorded ON PURPOSE. Running "whatever did not execute"
 * ran exactly those: a replay of a run held for approval executed the actions
 * the approval guards, the request still pending. Under the complement such a
 * run has no tail to resume, and its replay runs no step.
 */
const collectSkipActionNames = (
  actions: ReadonlyArray<{ readonly name?: unknown }>,
  steps: ReadonlyArray<{ readonly actionName: string; readonly status: string }>
): ReadonlySet<string> => {
  const resumable = new Set(steps.filter((s) => s.status === 'skipped').map((s) => s.actionName))
  return new Set(
    actions
      .map((action) => String(action.name ?? ''))
      .filter((name) => name !== '' && !resumable.has(name))
  )
}

/** Who a replay runs as — see the call site. A starter banned since is not run as. */
const replayActorOf = (
  run: { readonly startedByHand: boolean; readonly triggeredByUserId: string | null },
  actingUserId: string | undefined
) => {
  if (actingUserId !== undefined) return { userId: actingUserId }
  if (!run.startedByHand) return { userId: undefined }
  return {
    startedByHand: true,
    userId: run.triggeredByUserId ?? undefined,
    checkStarterStanding: true,
  } as const
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
 * Replay an automation run from its previously-failed step. The semantics:
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
/** The relay a replay records: the replayed run's own, or `outside` for new trigger data. */
const replayRelayOf = (relay: unknown, supplied: boolean): { readonly relay?: RunRelay } => {
  if (supplied) return { relay: OUTSIDE_RELAY }
  const kept = parseRelay(relay)
  return kept === undefined ? {} : { relay: kept }
}

export const replayAutomationRun = (
  options: ReplayAutomationRunOptions
): Effect.Effect<
  RunAutomationResult,
  ReplayAutomationRunError,
  AutomationRunRepository | ExecuteAutomationRunRequirements | AutomationPauseRepository
> =>
  Effect.gen(function* () {
    const { name, runId, app, processEnv, triggerData } = options
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
    const steps = yield* repo.findStepsByRunId(runId)
    const skipActionNames = collectSkipActionNames(
      automation.actions as ReadonlyArray<{ readonly name?: unknown }>,
      steps
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
      trigger: triggerNamedOrFirst(automation, run.triggerName),
      automationId,
      app,
      processEnv,
      triggerData: replayTriggerData,
      handlers,
      // Who the replay runs as. The console's retry names its admin (`userId`).
      // Otherwise a hand-started run replays as the person who started it —
      // under their permissions, and still theirs to read — as an approval
      // resume does, and any other replays system-side. Never the replayer: an
      // approver replaying someone's run does not borrow, nor become, its starter.
      ...replayActorOf(run, options.userId),
      skipActionNames,
      // A replay keeps the relay of the run it replays; new trigger data an
      // admin supplied came from outside the app.
      ...replayRelayOf(run.relay, triggerData !== undefined),
    })
  }).pipe(Effect.withSpan('automations.replay-automation-run'))
