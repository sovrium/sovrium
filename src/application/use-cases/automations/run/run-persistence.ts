/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Run-persistence glue for the automation run loop.
 *
 * Extracted from `run-automation.ts` (P1.2 decomposition). Owns the
 * `system.automation_runs` writes (via the repository port) and the
 */

import { Effect } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { resolveActorUserId } from '@/domain/models/app/auth/guest-session'
import {
  runRecordRefs,
  type RunReads,
} from '@/domain/models/app/automations/run-record-refs-service'
import { triggerEntryName } from '@/domain/models/app/automations/trigger-list-validation'
import { logError } from '@/infrastructure/logging/logger'
import { storedNestedOf } from './nested-step-record'
import { toApiStatus, toApiStepStatus, type EngineRunStatus } from './run-status'
import type { ExecutedStep, RunAccumulator } from './types'
import type { TriggerData } from '../resolve-trigger-data'
import type { App } from '@/domain/models/app'
import type { RunRelay } from '@/domain/models/app/automations/run-relay-service'
import type { Trigger } from '@/domain/models/app/automations/trigger'

/**
 * Build the actor overlay for a run insert: `{ triggeredByUserId }` when a real
 * person drove the trigger, `{}` otherwise so the column defaults to SQL NULL.
 *
 * The spread-or-nothing shape (rather than an explicit `null`) is what keeps
 * "the system caused this" and "a user caused this but we lost the id"
 * indistinguishable-by-construction: there is no third value to write.
 */
const runActorOverlay = (
  userId: string | undefined,
  startedByHand?: boolean
): { readonly triggeredByUserId?: string; readonly startedByHand?: true } => {
  const actorId = resolveActorUserId(userId)
  // The marker survives a missing actor: a hand-started run that lost its
  // caller keeps refusing its writes, through every later approval.
  const hand = startedByHand === true ? { startedByHand: true as const } : {}
  return actorId === undefined ? hand : { triggeredByUserId: actorId, ...hand }
}

/**
 * Persist an early `'queued'` row for a run before the scheduler admits
 * it to the in-flight pool. Returns the DB-generated UUID so the trigger
 * dispatcher can surface it in the immediate response (an API automation runs spec:
 * the async webhook must return a runId that the cancel endpoint can find
 * via {@link AutomationRunRepository.findById}).
 *
 * The row is inserted with no `startedAt`: `createdAt` records when it was
 * queued, and {@link markRunRunning} writes `startedAt` when the scheduler
 * admits it, so `durationMs` measures active execution and never the wait for
 * a concurrency slot. `completedAt`/`durationMs`/`steps` are left undefined —
 * the scheduler transitions the row to `'running'`, then to a terminal status,
 * via subsequent `updateStatus` calls. Step rows are persisted only at
 * finalisation time so the loop output (input/output, status, durationMs)
 * is captured atomically.
 *
 * Returns `undefined` if the insert failed; callers fall back to a
 * synthetic id (the in-memory store still records the run history).
 *
 * `userId` is the raw session id of whoever drove the trigger. It is narrowed
 * through {@link runActorOverlay} before it reaches the row, so the guest and
 * system sentinels land as SQL NULL rather than tripping the actor column's
 * foreign key.
 *
 * `startedByHand` is recorded beside the actor, so a run that pauses on an
 * approval resumes writing as the person who started it.
 */
export const persistQueuedRun = (input: {
  readonly automationId: string
  /** The trigger entry that started the run, recorded by name. */
  readonly trigger: Trigger
  readonly triggerData: TriggerData
  readonly userId: string | undefined
  readonly startedByHand?: boolean
  /** The run that handed this one its trigger data, recorded by id. */
  readonly relay?: RunRelay | undefined
}): Effect.Effect<string | undefined, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const result = yield* Effect.result(
      repo.create({
        automationId: input.automationId,
        status: 'queued',
        triggerName: triggerEntryName(input.trigger),
        triggerData: input.triggerData as unknown,
        ...runActorOverlay(input.userId, input.startedByHand),
        ...(input.relay === undefined ? {} : { relay: input.relay }),
      })
    )
    if (result._tag === 'Failure') {
      logError('[automation] failed to persist queued run row', result.failure)
      return undefined
    }
    return result.success.id
  }).pipe(Effect.withSpan('automations.persist-queued-run'))

/**
 * Promote a persisted `'queued'` row to `'running'` and stamp `startedAt` with
 * the admission instant. Best-effort: a missing row (e.g. cancellation while in
 * queue) becomes a no-op so the scheduler can short-circuit cleanly. Errors are
 * logged and swallowed — a run must not fail because its status write did.
 */
export const markRunRunning = (
  runId: string,
  admittedAt: Readonly<Date>
): Effect.Effect<void, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const result = yield* Effect.result(
      repo.updateStatus({ id: runId, status: 'running', startedAt: admittedAt as Date })
    )
    if (result._tag === 'Failure') {
      logError('[automation] failed to mark run as running', result.failure)
    }
  }).pipe(Effect.withSpan('automations.mark-run-running'))

/** The steps a path or a loop ran, kept on its own row (`nested-step-record.ts`). */
const nestedColumn = (step: ExecutedStep): { readonly nested?: unknown } =>
  step.paths === undefined && step.iterations === undefined ? {} : { nested: storedNestedOf(step) }

/**
 * Finalise an in-flight run: write the terminal status, the
 * timings, the error string, and the per-step rows. Uses
 * `updateStatus` (in-place row update) when `existingRunId` is provided —
 * keeping the row's id stable across the queued → running → terminal
 * lifecycle so the cancel endpoint and external API consumers see the
 * same id throughout. Step rows are inserted via a separate query path
 * (no `replaceSteps` API yet); on a fresh DB this is "insert N steps for
 * `runId`" which the engine does atomically inside
 * `repo.create`. Here we update status on the existing row and then
 * INSERT step rows directly using a tiny SQL helper to keep the path
 * compatible with both Postgres and SQLite.
 *
 * Returns `undefined` if the finalisation failed (matching `persistRun`'s
 * contract); callers fall back to the in-memory id.
 */
/**
 * Build the CreateStepInput[] array shared by `finaliseRun`'s primary
 * path and its fallback-insert path. Extracted so the two call sites
 * don't duplicate the mapping logic.
 */
const buildStepsInput = (
  steps: ReadonlyArray<ExecutedStep>,
  startedAt: Readonly<Date>,
  finishedAt: Readonly<Date>,
  base = 0
) =>
  steps.map((step, index) => ({
    actionName: step.name,
    stepIndex: base + index,
    status: toApiStepStatus(step.status),
    ...(step.props !== undefined ? { input: step.props as unknown } : {}),
    ...(step.output !== undefined ? { output: step.output as unknown } : {}),
    ...(step.logs !== undefined ? { logs: step.logs } : {}),
    ...(step.reads !== undefined ? { reads: step.reads } : {}),
    ...nestedColumn(step),
    startedAt,
    completedAt: finishedAt,
    ...(step.error !== undefined ? { error: step.error } : {}),
  }))

/** The row a step record is stored as, at position `stepIndex` of its run. */
export const stepRowOf = (step: ExecutedStep, stepIndex: number, at: Readonly<Date>) =>
  buildStepsInput([step], at, at, stepIndex)[0] as NonNullable<
    ReturnType<typeof buildStepsInput>[number]
  >

type FinaliseRunInput = {
  readonly runId: string
  readonly automationId: string
  readonly engineStatus: EngineRunStatus
  readonly engineError: string | undefined
  /** Set when the run parks on a long wait (`waiting-delay`): when and where it resumes. */
  readonly park?: RunAccumulator['park']
  /** A resumed segment: the position its first new step row takes, and the active time before it. */
  readonly segment?: { readonly stepIndexBase: number; readonly priorActiveMs: number }
  readonly triggerData: TriggerData
  readonly startedAt: Date
  readonly finishedAt: Date
  readonly steps: ReadonlyArray<ExecutedStep>
  /**
   * Raw session id of whoever drove the trigger, carried purely so the
   * fallback INSERT below can re-attribute the replacement row. The primary
   * path never needs it — that row already carries the actor from
   * {@link persistQueuedRun}, and finalisation only touches status + timings.
   */
  readonly userId: string | undefined
  /**
   * The run as it was started: its app and automation, from which the records
   * it read are indexed (`run-record-refs-service.ts`), and its relay, carried
   * for the fallback insert's row.
   */
  readonly source?: {
    readonly app: App
    readonly name: string
    readonly relay?: RunRelay | undefined
    readonly trigger?: Trigger
  }
}

/**
 * The records the run read, for the erasure index — or none when the caller
 * did not say which automation it ran.
 */
const readsOfRun = (input: FinaliseRunInput): RunReads | undefined =>
  input.source === undefined
    ? undefined
    : runRecordRefs({
        app: input.source.app,
        automationName: input.source.name,
        ...(input.source.trigger === undefined
          ? {}
          : { triggerName: triggerEntryName(input.source.trigger) }),
        triggerData: input.triggerData,
        steps: input.steps.map((step) => ({
          name: step.name,
          status: toApiStepStatus(step.status),
          output: step.output,
          reads: step.reads,
        })),
      })

/** The run row's refs overlay: the records it read, and the runs its calls started. */
const refsOverlay = (reads: RunReads | undefined) =>
  reads === undefined ? {} : { refs: reads.refs, refsFromRuns: reads.calledRuns }

/**
 * Fallback path: the queued/running row vanished (race with manual delete,
 * truncate). Insert a fresh row + steps via the legacy `repo.create` path
 * so the run still lands in the DB even though its id is now different
 * from the one the trigger response surfaced.
 */
const finaliseRunFallback = (input: FinaliseRunInput) =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const fallback = yield* Effect.result(
      repo.create({
        automationId: input.automationId,
        status: toApiStatus(input.engineStatus),
        triggerData: input.triggerData as unknown,
        startedAt: input.startedAt,
        completedAt: input.finishedAt,
        durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
        ...runActorOverlay(input.userId),
        ...(input.source?.trigger === undefined
          ? {}
          : { triggerName: triggerEntryName(input.source.trigger) }),
        ...(input.source?.relay === undefined ? {} : { relay: input.source.relay }),
        ...(input.engineError !== undefined ? { error: input.engineError } : {}),
        ...refsOverlay(readsOfRun(input)),
        steps: buildStepsInput(input.steps, input.startedAt, input.finishedAt),
      })
    )
    if (fallback._tag === 'Failure') {
      logError('[automation] failed to finalise run (fallback insert)', fallback.failure)
      return undefined
    }
    return fallback.success.id
  })

/**
 * The run row's park overlay: a parked run keeps no completion time and stores
 * when and where it resumes; the repository clears both on any other status.
 */
const parkOverlay = (input: FinaliseRunInput) =>
  input.park === undefined
    ? { completedAt: input.finishedAt }
    : {
        park: {
          resumeAt: new Date(input.park.resumeAt),
          cursor: { v: 1, frames: input.park.frames },
        },
      }

export const finaliseRun = (
  input: FinaliseRunInput
): Effect.Effect<string | undefined, never, AutomationRunRepository> =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const activeMs = input.finishedAt.getTime() - input.startedAt.getTime()
    const base = input.segment?.stepIndexBase ?? 0
    const finalised = yield* Effect.result(
      repo.finaliseRun({
        id: input.runId,
        status: toApiStatus(input.engineStatus),
        durationMs: activeMs + (input.segment?.priorActiveMs ?? 0),
        ...parkOverlay(input),
        ...(input.engineError !== undefined ? { error: input.engineError } : {}),
        steps: buildStepsInput(input.steps, input.startedAt, input.finishedAt, base),
        ...refsOverlay(readsOfRun(input)),
      })
    )
    if (finalised._tag === 'Failure' || finalised.success === undefined) {
      logError(
        '[automation] failed to finalise run on existing row; falling back to insert',
        finalised._tag === 'Failure' ? finalised.failure : 'row missing'
      )
      // A resumed run's row was there when it was claimed: a second row would split its log.
      return input.segment === undefined ? yield* finaliseRunFallback(input) : undefined
    }
    return input.runId
  }).pipe(Effect.withSpan('automations.finalise-run'))
