/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Effect, Either, Layer } from 'effect'
import { CronScheduler, CronSchedulerError } from '@/application/ports/services/cron-scheduler'

/**
 * Live `CronScheduler` adapter.
 *
 * The scheduler keeps an internal map of `jobId → Timeout` (held inside a
 * mutable `Map` deliberately — see the eslint-disable comments). Each call
 * to `schedule(expression, callback, options)` parses the cron via Effect's
 * `Cron.parse` (Either path — never `unsafeParse`, so a malformed expression
 * at boot surfaces as a `CronSchedulerError` instead of crashing the
 * process), computes the delay until the next fire via `Cron.next`, and
 * arms a `setTimeout`. Each fire re-arms itself by recomputing the next
 * fire from "now" — robust to drift, sleep/wake events, and DST shifts.
 *
 * `cancel(jobId)` is idempotent: cancelling an unknown job succeeds silently
 * so callers do not need to track which jobs were actually scheduled.
 *
 * Lifecycle: the scheduler instance is created once when the layer is
 * materialised. Because `createAppLayer` is `Effect.provide`d at the top of
 * the CLI program (and `Effect.runPromise` resolves before the server has
 * actually finished serving), `Layer.scoped` would prematurely fire its
 * finalizer the moment the start program returns — clearing timers before
 * any cron has fired. Instead we expose `disposeCronScheduler()` for the
 * server's `createStopEffect` to call, mirroring the `AiComputeListener.stop()`
 * pattern in `src/infrastructure/server/server.ts`.
 *
 * Test fixtures restart the server by killing the child process, which
 * implicitly clears all timers — so the explicit dispose path is exercised
 * only on graceful shutdown.
 */

interface ScheduledJob {
  readonly jobId: string
  readonly expression: string
  readonly timezone: string
  readonly timer: ReturnType<typeof setTimeout>
}

// Module-scoped singleton state.
//
// Mutable Map is used here intentionally: the scheduler is process-wide
// state (one cron registry per Sovrium server), and Effect.Ref would not
// help because the timer callbacks must run synchronously from setTimeout
// (no Effect runtime in scope at fire time). The eslint-disable comments
// document each mutation.
const jobs = new Map<string, ScheduledJob>()

const cancelTimer = (jobId: string): void => {
  const job = jobs.get(jobId)
  if (job === undefined) return
  clearTimeout(job.timer)
  /* eslint-disable-next-line functional/immutable-data, functional/no-expression-statements, drizzle/enforce-delete-with-where -- intentional: Map.delete is the JS API; drizzle rule false positive on Map */
  jobs.delete(jobId)
}

interface ArmTimerInput {
  readonly jobId: string
  readonly expression: string
  readonly timezone: string
  readonly cron: Cron.Cron
  readonly callback: () => Effect.Effect<void, unknown>
}

const armTimer = (input: ArmTimerInput): void => {
  const { jobId, expression, timezone, cron, callback } = input
  const fireAt = Cron.next(cron, new Date())
  const delay = Math.max(0, fireAt.getTime() - Date.now())
  const timer = setTimeout(() => {
    // Run the callback fire-and-forget. Failures are logged but never
    // propagated — a misbehaving automation must not stop the scheduler
    // from re-arming for the next tick.
    Effect.runPromise(Effect.either(callback() as Effect.Effect<void, unknown, never>)).then(
      (result) => {
        if (result._tag === 'Left') {
          console.error('[cron-scheduler] callback failed', { jobId, error: result.left })
        }
      },
      (err) => {
        console.error('[cron-scheduler] callback rejected', { jobId, error: err })
      }
    )
    // Re-arm only if the job is still registered (callers may have
    // cancelled mid-fire). Recompute next from "now" — robust to drift.
    //
    // Race-window note: if `schedule(jobId)` was called with NEW input while
    // this OLD callback was already queued in the event loop, the OLD
    // re-arm here will overwrite the NEW timer's entry in `jobs[jobId]`.
    // The current boot-time wiring registers each automation exactly once
    // and never reschedules under the same id at runtime, so the race is
    // unreachable. If a future caller adds a hot-reload path that
    // re-registers the same id, gate this re-arm with a generation counter.
    if (jobs.has(jobId)) {
      armTimer(input)
    }
  }, delay)
  /* eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- intentional: register Map entry */
  jobs.set(jobId, { jobId, expression, timezone, timer })
}

const generateJobId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cron-${crypto.randomUUID()}`
  }
  return `cron-${String(Date.now())}-${String(Math.random()).slice(2, 10)}`
}

const scheduleImpl = (
  cronExpression: string,
  callback: () => Effect.Effect<void, unknown>,
  options?: { readonly jobId?: string; readonly timezone?: string }
): Effect.Effect<string, CronSchedulerError> =>
  // The `Cron.parse + zoneUnsafeMakeNamed` triplet is duplicated here, in the
  // domain Schema filter (`cron.ts`), and in `presentation/api/routes/automations/index.ts`.
  // Kept inline because this site needs the original throw/Either.left wrapped
  // in `CronSchedulerError({ cause })` so callers can inspect the underlying
  // failure — a shared helper that returned `Either<Cron, string>` would
  // collapse the cause chain to a flat message.
  Effect.gen(function* () {
    const timezone = options?.timezone ?? 'UTC'
    const jobId = options?.jobId ?? generateJobId()

    const zoneResult = yield* Effect.try({
      try: () => DateTime.zoneUnsafeMakeNamed(timezone),
      catch: (cause) => new CronSchedulerError({ cause }),
    })

    const parsed = Cron.parse(cronExpression, zoneResult)
    if (Either.isLeft(parsed)) {
      return yield* new CronSchedulerError({ cause: parsed.left })
    }

    // Replace any existing job with the same id so re-registration on app
    // reload is well-defined (no leftover timers from the old definition).
    yield* Effect.sync(() => {
      cancelTimer(jobId)
      armTimer({
        jobId,
        expression: cronExpression,
        timezone,
        cron: parsed.right,
        callback,
      })
    })
    return jobId
  })

const cancelImpl = (jobId: string): Effect.Effect<void, CronSchedulerError> =>
  Effect.sync(() => {
    cancelTimer(jobId)
  })

const listJobsImpl = (): Effect.Effect<readonly Record<string, unknown>[], CronSchedulerError> =>
  Effect.sync(() =>
    Array.from(jobs.values()).map((job) => ({
      jobId: job.jobId,
      expression: job.expression,
      timezone: job.timezone,
    }))
  )

/**
 * Cancel and clear ALL scheduled jobs. Called from the server's
 * `createStopEffect` (mirroring the `AiComputeListener.stop()` pattern) so
 * graceful shutdown does not leave zombie timers behind.
 */
export const disposeCronScheduler = (): void => {
  Array.from(jobs.values()).forEach((job) => {
    clearTimeout(job.timer)
  })
  // eslint-disable-next-line functional/immutable-data -- intentional: drain Map
  jobs.clear()
}

export const CronSchedulerLive = Layer.succeed(
  CronScheduler,
  CronScheduler.of({
    schedule: scheduleImpl,
    cancel: cancelImpl,
    listJobs: listJobsImpl,
  })
)
