/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Admission to the automation run loop: the run is persisted as queued, made
 * cancellable, then waits for one of its automation's slots.
 */

import { Effect } from 'effect'
import { AutomationScheduler } from '@/application/ports/services/automation-scheduler'
import { ProcessEnv } from '@/application/ports/services/process-env'
import { resolveConcurrencyLimit } from './concurrency-limit'
import { markRunRunning, persistQueuedRun } from './run-persistence'
import { cryptoRandomId, type ExecuteAutomationRunInput, type RunRequirements } from './types'
import type { Scope } from 'effect'

/** What admission hands the run: its id, the instant, and the two early give-backs. */
export interface Admission {
  readonly runId: string
  readonly admittedAt: Date
  /** Gives the run's slot back once; the run's scope gives it back otherwise. */
  readonly releaseSlot: Effect.Effect<void>
  /** Drops the run's canceller once; the run's scope drops it otherwise. */
  readonly unregisterCancellation: Effect.Effect<void>
}

/**
 * Phase 1+2 of the scheduler-wrapped run loop: persist the row as
 * `'queued'`, surface the runId to any waiting caller, then wait for one of the
 * automation's slots. On admit, promote the row to `'running'` and stamp its
 * `startedAt` with the admission instant: the run's duration and its timeout
 * both count from admission, so the wait for a slot is never part of either.
 *
 * The canceller and the slot both belong to the caller's scope, so a run
 * interrupted at any point — waiting for its slot included — gives both back.
 */
export const enqueueAndAdmit: (
  input: ExecuteAutomationRunInput
) => Effect.Effect<Admission, never, RunRequirements | Scope.Scope> = Effect.fn(
  'automations.admit'
)(function* (input: ExecuteAutomationRunInput) {
  const { name, automation } = input
  const scheduler = yield* AutomationScheduler
  // The run's id, actor, hand-start marker and relay, all read off the input.
  const persistedQueuedId = yield* persistQueuedRun(input)
  const runId = persistedQueuedId ?? cryptoRandomId()
  // Registered while the run still waits, so a cancel reaches a queued run too.
  const unregisterCancellation = yield* scheduler.registerCancellation(runId)
  if (input.onPersisted !== undefined) {
    const cb = input.onPersisted
    cb(runId)
  }
  const concurrency = resolveConcurrencyLimit(automation, yield* ProcessEnv)
  const releaseSlot = yield* scheduler.admit(name, concurrency)
  const admittedAt = new Date()
  yield* markRunRunning(runId, admittedAt)
  if (input.onAdmitted !== undefined) {
    const cb = input.onAdmitted
    cb(runId)
  }
  return { runId, admittedAt, releaseSlot, unregisterCancellation }
})
