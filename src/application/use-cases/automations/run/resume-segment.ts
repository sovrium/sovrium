/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One segment of a run resumed after a long wait, run in the run's OWN row.
 *
 * A resumed segment is admitted like any run — it takes a concurrency slot for
 * as long as it runs (a parked run holds none), its canceller registered by
 * the caller before the claim —
 * then runs its {@link ResumeSegmentPlan} under what remains of the automation
 * `timeout`: only active time counts, summed over the segments. A run a person
 * started by hand resumes as that person, after checking she still stands.
 *
 * Its steps are appended after the row it paused on; the paused row itself is
 * completed — a wait step's with `resumedAt`, a loop's or a path's with the
 * container's new record. A wait further on parks the run again, with a new
 * cursor, exactly as the first one did.
 */

import { Effect, Ref } from 'effect'
import { AutomationRunRepository } from '@/application/ports/repositories/automations/automation-run-repository'
import { AutomationFiberBridge } from '@/application/ports/services/automation-fiber-bridge'
import { TemplateEngine } from '@/application/ports/services/template-engine'
import { triggerNamedOrFirst } from '@/domain/models/app/automations/trigger-entries-service'
import { logError } from '@/infrastructure/logging/logger'
import {
  dispatchPostRunFailureEffects,
  executeAutomationRun,
  resolveAutomationId,
} from '../run-automation'
import { resolveRunTimeoutMs, runActionsWithTimeout } from './action-loop'
import { buildAutomationInvoker } from './automation-call-invoker'
import { finaliseOnAbandon } from './defect-finaliser'
import { finaliseRun, stepRowOf } from './run-persistence'
import { withPriorTolerated } from './run-status'
import {
  acquireSlot,
  isCancelled,
  releaseSlot,
  resolveConcurrencyLimit,
  unregisterCancellation,
} from './scheduler'
import { unlessStarterGone } from './starter-standing'
import { buildStepContext } from './step-context'
import { EMPTY_RUN_ACCUMULATOR, type RunAccumulator, type RunRequirements } from './types'
import type { ActionHandler, ActionKey } from '../action-handlers'
import type { TriggerData } from '../resolve-trigger-data'
import type { ResumeSegmentPlan } from './resume-plan'
import type {
  CreateStepInput,
  PersistedRun,
} from '@/application/ports/repositories/automations/automation-run-repository'
import type { App } from '@/domain/models/app'
import type { Trigger } from '@/domain/models/app/automations/trigger'

/** What a resumed segment runs. */
export interface ResumedSegmentInput {
  readonly app: App
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly handlers: ReadonlyMap<ActionKey, ActionHandler>
  readonly automation: NonNullable<App['automations']>[number]
  readonly automationId: string
  readonly run: PersistedRun
  readonly segment: ResumeSegmentPlan
}

const boundAutomationInvoker = buildAutomationInvoker({
  resolveAutomationId,
  executeAutomationRun,
})

const triggerDataOf = (raw: unknown): TriggerData =>
  raw !== null && typeof raw === 'object' ? (raw as TriggerData) : {}

/** The entry that started the run, by the name it recorded. */
const runEntryOf = ({ automation, run }: ResumedSegmentInput): Trigger =>
  triggerNamedOrFirst(automation, run.triggerName)

/** Who the segment runs as: the person who started the run by hand, or the system. */
const startedByOf = (run: PersistedRun) =>
  run.startedByHand
    ? { startedByHand: true as const, userId: run.triggeredByUserId ?? undefined }
    : { userId: undefined }

/** Rewrite one step row of the run, its failure logged: the run's outcome stands regardless. */
const rewriteStep = (runId: string, step: CreateStepInput) =>
  Effect.gen(function* () {
    const repo = yield* AutomationRunRepository
    const result = yield* Effect.result(repo.updateStep({ runId, step }))
    if (result._tag === 'Failure') {
      logError('[automation] failed to complete the step a resumed run paused on', result.failure)
    }
  })

/**
 * Store the segment: the paused row completed, the new step rows appended
 * after it, the run's status, active time and — when it parked again — its
 * new resume time and cursor.
 */
const storeSegment = (
  input: ResumedSegmentInput,
  state: RunAccumulator,
  timing: { readonly admittedAt: Date; readonly finishedAt: Date }
) =>
  Effect.gen(function* () {
    const { run, segment } = input
    const [first, ...rest] = state.steps
    const reentered = segment.container !== undefined && first !== undefined
    // A segment cancelled before it ran leaves the wait step as it parked.
    const ranNothing = state.runStatus === 'cancelled' && state.steps.length === 0
    if (segment.waitRow !== undefined && !ranNothing) yield* rewriteStep(run.id, segment.waitRow)
    if (reentered) {
      yield* rewriteStep(run.id, stepRowOf(first, segment.pausedRow, timing.finishedAt))
    }
    yield* finaliseRun({
      runId: run.id,
      automationId: input.automationId,
      engineStatus: state.runStatus,
      engineError: state.runError,
      triggerData: triggerDataOf(run.triggerData),
      startedAt: timing.admittedAt,
      finishedAt: timing.finishedAt,
      steps: reentered ? rest : state.steps,
      userId: startedByOf(run).userId,
      source: { app: input.app, name: input.automation.name, trigger: runEntryOf(input) },
      segment: { stepIndexBase: segment.pausedRow + 1, priorActiveMs: run.durationMs ?? 0 },
      ...(state.runStatus === 'waiting-delay' ? { park: state.park } : {}),
    })
  })

/** Run the segment's actions under what remains of the run timeout. */
const runSegmentActions = (input: ResumedSegmentInput) =>
  Effect.gen(function* () {
    const { app, processEnv, handlers, automation, run, segment } = input
    const startedBy = startedByOf(run)
    const services = yield* Effect.context<RunRequirements>()
    const runProgram = (yield* AutomationFiberBridge).promiseRunner(services)
    const base = buildStepContext({
      name: automation.name,
      automationId: input.automationId,
      app,
      automation,
      trigger: runEntryOf(input),
      processEnv,
      triggerData: triggerDataOf(run.triggerData),
      handlers,
      ...startedBy,
      runId: run.id,
      runProgram,
      templates: yield* TemplateEngine,
    })
    const container = segment.container === undefined ? {} : { container: segment.container }
    const ctx = { ...base, resume: { base: segment.base, ...container } }
    const remainingMs = resolveRunTimeoutMs(automation, processEnv) - (run.durationMs ?? 0)
    const steps = runActionsWithTimeout(segment.actions, ctx, {
      timeoutMs: Math.max(1, remainingMs),
      skipActionNames: new Set(),
      seedOutputs: segment.seedOutputs,
      automationInvoker: boundAutomationInvoker,
    })
    return yield* unlessStarterGone({ ...startedBy, checkStarterStanding: true }, steps)
  })

/** The admitted segment: run, stored, released, its failure fanned out like any run's. */
const runAdmittedSegment = (
  input: ResumedSegmentInput,
  admission: { readonly admittedAt: Date; readonly finalised: Ref.Ref<boolean> }
) =>
  Effect.gen(function* () {
    const { run, automation } = input
    // A cancel that came while the segment waited for its slot: nothing runs.
    const ran = isCancelled(run.id) ? EMPTY_RUN_ACCUMULATOR : yield* runSegmentActions(input)
    const state: RunAccumulator = isCancelled(run.id)
      ? { ...ran, runStatus: 'cancelled', runError: ran.runError ?? 'Run cancelled' }
      : withPriorTolerated(ran, input.segment.priorTolerated)
    const finishedAt = new Date()
    yield* storeSegment(input, state, { admittedAt: admission.admittedAt, finishedAt })
    yield* Ref.set(admission.finalised, true)
    releaseSlot(automation.name)
    unregisterCancellation(run.id)
    yield* dispatchPostRunFailureEffects({
      app: input.app,
      processEnv: input.processEnv,
      automation,
      trigger: runEntryOf(input),
      name: automation.name,
      runId: run.id,
      finalState: state,
      startedAtDate: admission.admittedAt,
      finishedAtDate: finishedAt,
    })
    return state
  })

/**
 * Run one resumed segment of a claimed run, from admission to its stored
 * outcome. Answers the segment's final state.
 */
export const runResumedSegment = (
  input: ResumedSegmentInput
): Effect.Effect<RunAccumulator, never, RunRequirements> =>
  Effect.gen(function* () {
    const { run, automation, processEnv } = input
    // The canceller is registered by the caller before its claim (`resume-delayed-runs.ts`).
    const limit = resolveConcurrencyLimit(automation, processEnv)
    // effect-promise: total -- `acquireSlot` resolves now or when a slot frees; it never rejects.
    yield* Effect.promise(() => acquireSlot(automation.name, limit))
    const admittedAt = new Date()
    const finalised = yield* Ref.make(false)
    return yield* finaliseOnAbandon(runAdmittedSegment(input, { admittedAt, finalised }), {
      name: automation.name,
      automationId: input.automationId,
      runId: run.id,
      triggerData: triggerDataOf(run.triggerData),
      admittedAt,
      userId: startedByOf(run).userId,
      finalised,
    })
  }).pipe(Effect.withSpan('automations.run-resumed-segment'))
