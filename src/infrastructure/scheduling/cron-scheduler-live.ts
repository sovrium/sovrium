/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Effect, Result, Layer } from 'effect'
import { CronScheduler, CronSchedulerError } from '@/application/ports/services/cron-scheduler'
import { logError } from '@/infrastructure/logging/logger'

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

/**
 * The largest delay a single `setTimeout` can hold: 2^31 - 1 ms (~24.85 days).
 *
 * Bun/Node store the timer delay in a 32-bit signed integer and SILENTLY clamp
 * any larger value to `1` ms (emitting `TimeoutOverflowWarning: <n> does not
 * fit into a 32-bit signed integer. Timeout duration was set to 1.`). That
 * turns a far-future fire into an immediate one, and — because each fire
 * re-arms itself to the same far-future time — into a ~1000x/sec busy-loop
 * that starves the event loop (observed as "Server did not start within
 * 5000ms" on the cloud/partner app servers).
 *
 * Monthly crons (e.g. `0 6 1 * *`) scheduled during the first ~6 days of a
 * month are ~26 days out, past this ceiling — so the delay MUST be clamped.
 * See `nextTimerPlan`.
 */
export const MAX_TIMER_MS = 2_147_483_647

/**
 * Plan for a single `setTimeout` arm.
 *
 * When the raw delay until the next fire exceeds `MAX_TIMER_MS`, the timer is
 * clamped to `MAX_TIMER_MS` and flagged `rearmOnly`: on wake it must NOT run
 * the job, only recompute `Cron.next` and re-arm. Successive bounded hops walk
 * the clock forward until the remaining delay fits under the ceiling, at which
 * point a `rearmOnly: false` timer finally fires the job — so the job runs
 * only when the ACTUAL fire time has arrived, never on an overflow-clamped
 * early wake.
 */
export interface TimerPlan {
  readonly rearmOnly: boolean
  readonly delayMs: number
}

/**
 * Pure clamp: decide the `setTimeout` delay for the next fire.
 *
 * `delayMs` is always within `[0, MAX_TIMER_MS]`. A delay past the 32-bit
 * ceiling yields a bounded, `rearmOnly` hop; anything at or below it fires
 * normally (preserving the original behaviour for all sub-24-day delays).
 */
export const nextTimerPlan = (fireAtMs: number, nowMs: number): TimerPlan => {
  const delay = Math.max(0, fireAtMs - nowMs)
  if (delay > MAX_TIMER_MS) {
    return { rearmOnly: true, delayMs: MAX_TIMER_MS }
  }
  return { rearmOnly: false, delayMs: delay }
}

/**
 * Injectable clock / timer / runner seam. The defaults bind the real runtime;
 * the co-located unit test swaps in a fake clock and a timer recorder to
 * assert the overflow clamp deterministically without real time (`mock.module`
 * is forbidden project-wide — deps are passed as a parameter instead).
 */
export interface ArmTimerDeps {
  readonly now: () => number
  readonly setTimer: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>
  readonly runJob: (jobId: string, callback: () => Effect.Effect<void, unknown>) => void
}

export const defaultArmTimerDeps: ArmTimerDeps = {
  now: () => Date.now(),
  setTimer: (handler, ms) => setTimeout(handler, ms),
  runJob: (jobId, callback) => {
    // Run the callback fire-and-forget. Failures are logged but never
    // propagated — a misbehaving automation must not stop the scheduler
    // from re-arming for the next tick.
    Effect.runPromise(Effect.result(callback() as Effect.Effect<void, unknown, never>)).then(
      (result) => {
        if (result._tag === 'Failure') {
          logError('[cron-scheduler] callback failed', result.failure, { jobId })
        }
      },
      (err) => {
        logError('[cron-scheduler] callback rejected', err, { jobId })
      }
    )
  },
}

/**
 * Arm (or re-arm) the `setTimeout` for a job. Exported for the co-located unit
 * test, which drives it with a fake `ArmTimerDeps` to lock the overflow clamp;
 * production callers use the single-argument form (real deps by default).
 */
export const armTimer = (input: ArmTimerInput, deps: ArmTimerDeps = defaultArmTimerDeps): void => {
  const { jobId, expression, timezone, cron, callback } = input
  // Read "now" once so the fire-time delta is skew-free AND so the fake clock
  // in tests fully controls the scheduling decision.
  const nowMs = deps.now()
  const fireAt = Cron.next(cron, new Date(nowMs))
  const plan = nextTimerPlan(fireAt.getTime(), nowMs)
  const timer = deps.setTimer(() => {
    // On an overflow-clamped (`rearmOnly`) wake the real fire time has NOT
    // arrived yet, so the job MUST NOT run — the re-arm below recomputes a
    // shorter delay. Only a non-clamped wake (`now >= fireAt`) runs the job.
    if (!plan.rearmOnly) {
      deps.runJob(jobId, callback)
    }
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
      armTimer(input, deps)
    }
  }, plan.delayMs)
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
  // The `Cron.parse + zoneMakeNamedUnsafe` triplet is duplicated here, in the
  // domain Schema filter (`cron.ts`), and in `presentation/api/routes/automations/index.ts`.
  // Kept inline because this site needs the original throw/Either.left wrapped
  // in `CronSchedulerError({ cause })` so callers can inspect the underlying
  // failure — a shared helper that returned `Either<Cron, string>` would
  // collapse the cause chain to a flat message.
  Effect.gen(function* () {
    const timezone = options?.timezone ?? 'UTC'
    const jobId = options?.jobId ?? generateJobId()

    const zoneResult = yield* Effect.try({
      try: () => DateTime.zoneMakeNamedUnsafe(timezone),
      catch: (cause) => new CronSchedulerError({ cause }),
    })

    const parsed = Cron.parse(cronExpression, zoneResult)
    if (Result.isFailure(parsed)) {
      return yield* new CronSchedulerError({ cause: parsed.failure })
    }

    // Replace any existing job with the same id so re-registration on app
    // reload is well-defined (no leftover timers from the old definition).
    yield* Effect.sync(() => {
      cancelTimer(jobId)
      armTimer({
        jobId,
        expression: cronExpression,
        timezone,
        cron: parsed.success,
        callback,
      })
    })
    return jobId
  })

const cancelImpl = (jobId: string): Effect.Effect<void, CronSchedulerError> =>
  Effect.sync(() => {
    cancelTimer(jobId)
  })

const listJobsImpl: Effect.Effect<readonly Record<string, unknown>[], CronSchedulerError> =
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
