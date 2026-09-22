/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Effect, Fiber, Ref, Result, Schedule, Layer } from 'effect'
import { CronScheduler, CronSchedulerError } from '@/application/ports/services/cron-scheduler'
import { logError } from '@/infrastructure/logging/logger'
import type { Scope } from 'effect'

/**
 * Live `CronScheduler` adapter, driven by `Schedule.cron`.
 *
 * Each `schedule(expression, callback, options)` parses the cron via Effect's
 * `Cron.parse` (Result path — never `unsafeParse`, so a malformed expression at
 * boot surfaces as a `CronSchedulerError` instead of crashing the process) and
 * forks a fiber running {@link cronJobLoop}. The loop sleeps until the next
 * fire, runs the callback, and repeats — recomputing the next fire from "now"
 * on every iteration, so it is robust to drift, sleep/wake events and DST
 * shifts, and never tries to "catch up" a missed tick.
 *
 * `cancel(jobId)` is idempotent: cancelling an unknown job succeeds silently so
 * callers do not need to track which jobs were actually scheduled.
 *
 * ## The scope IS the disposer (standing rule E3)
 *
 * Every job fiber is forked into THIS LAYER'S scope, and the registry itself is
 * an `Effect.acquireRelease`, so closing the scope interrupts every job — on
 * success, on failure and on interruption, with no call site to forget. The
 * scope that matters is the domain `ManagedRuntime`'s: built in `createServer`,
 * disposed in `createStopEffect` after the socket drain
 * (`infrastructure/server/domain-runtime.ts`).
 *
 * This replaced a root `Effect.runFork` per job plus an exported
 * `disposeCronScheduler` that shutdown had to remember to call. That shape was
 * not a preference: before the server owned a runtime, `createAppLayer` was
 * `Effect.provide`d at the top of the CLI program and its scope closed the
 * moment `Effect.runPromise` resolved — so a scoped finalizer would have
 * interrupted every job before a single cron fired. The runtime is what made
 * the scope outlive boot, and therefore what unblocked this.
 *
 * One consequence is load-bearing and easy to undo by accident: **the job
 * registry is per-layer, not module-level.** Four callers arm this scheduler
 * (`register-cron-automations`, `register-agent-schedules`,
 * `register-account-purge`, `register-activity-log-retention`) and each used to
 * `Effect.provide(CronSchedulerLive)` for itself. Layers memoise per BUILD, so
 * four provides would now be four registries — and four scopes, each closing
 * when its own registration program returned, interrupting the jobs it had just
 * armed. They all run on the server's domain context instead: one build, one
 * registry, one scope.
 *
 * ## The 32-bit timer ceiling is Effect's problem now
 *
 * A monthly cron (`0 6 1 * *`) armed early in the month is ~26 days out, past
 * the 2^31-1 ms ceiling a raw `setTimeout` can hold — Bun silently clamps such
 * a delay to 1 ms, which used to turn a far-future fire into a ~1000/sec
 * busy-loop that starved the event loop. This adapter no longer carries a
 * workaround for that, because Effect's `Clock` already does it: `sleepMillis`
 * clamps to `2 ** 31 - 1` and chains a continuation for the remainder
 * (`internal/effect.ts`), so an arbitrarily long `Effect.sleep` resolves once,
 * at the right time.
 */

interface ScheduledJob {
  readonly jobId: string
  readonly expression: string
  readonly timezone: string
  readonly fiber: Fiber.Fiber<void>
}

/** The job registry. One per built layer — see the header note. */
type JobRegistry = Ref.Ref<ReadonlyMap<string, ScheduledJob>>

/**
 * Run one callback invocation, absorbing everything it can throw.
 *
 * `catchCause` (not `Effect.result`) so a DEFECT is swallowed too: a
 * misbehaving automation must never stop the scheduler from waiting for the
 * next tick.
 */
const runCallbackSafely = (
  jobId: string,
  callback: () => Effect.Effect<void, unknown>
): Effect.Effect<void> =>
  callback().pipe(
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        logError('[cron-scheduler] callback failed', cause, { jobId })
      })
    )
  )

/**
 * The scheduling loop for one job: sleep until the next fire, run, repeat.
 *
 * Built on `Schedule.toStepWithSleep` rather than `Effect.repeat`, because
 * `repeat` runs its effect FIRST and delays afterwards — which would fire every
 * cron automation once at boot. A sleeping step inverts that to wait-then-run,
 * which is the contract callers depend on.
 *
 * Exported for the co-located unit test, which drives it under `TestClock` to
 * assert the fire schedule deterministically without real time.
 */
export const cronJobLoop = (
  jobId: string,
  cron: Cron.Cron,
  callback: () => Effect.Effect<void, unknown>
): Effect.Effect<void> =>
  Effect.gen(function* () {
    // `Schedule.cron` recomputes `Cron.next(cron, now)` on every step, so the
    // timezone baked into the parsed `Cron` is honoured and a tick missed while
    // the process was suspended is skipped rather than replayed.
    const step = yield* Schedule.toStepWithSleep(Schedule.cron(cron))
    return yield* Effect.forever(
      step(undefined).pipe(Effect.andThen(runCallbackSafely(jobId, callback)))
    )
  }).pipe(
    // The schedule's declared `CronParseError` is unreachable here (the `Cron`
    // arrived already parsed) and the step only halts at an infinite clock, but
    // both are in the type — log and end this job rather than leaving the fiber
    // to die with an unhandled cause. Interruption is NOT logged: it is the
    // normal `cancel` / scope-exit path.
    Effect.catchCause((cause) =>
      Effect.sync(() => {
        logError('[cron-scheduler] job loop stopped', cause, { jobId })
      })
    )
  )

/**
 * Registry updates are built as fresh Maps from entries rather than by mutating
 * a copy — `Map.set` / `Map.delete` are banned by `functional/immutable-data`,
 * and the entry-list form needs no escape hatch. A later entry wins in the
 * `Map` constructor, so {@link withJob} both inserts and replaces.
 */
const withJob = (
  current: ReadonlyMap<string, ScheduledJob>,
  job: ScheduledJob
): ReadonlyMap<string, ScheduledJob> =>
  new Map<string, ScheduledJob>([...current, [job.jobId, job]])

const withoutJob = (
  current: ReadonlyMap<string, ScheduledJob>,
  jobId: string
): ReadonlyMap<string, ScheduledJob> =>
  new Map<string, ScheduledJob>([...current].filter(([key]) => key !== jobId))

/** Interrupt a job's fiber and drop it from the registry. Idempotent. */
const cancelJob = (jobs: JobRegistry, jobId: string): Effect.Effect<void> =>
  Ref.modify(jobs, (current) => {
    const job = current.get(jobId)
    return job === undefined
      ? ([undefined, current] as const)
      : ([job, withoutJob(current, jobId)] as const)
  }).pipe(Effect.flatMap((job) => (job === undefined ? Effect.void : Fiber.interrupt(job.fiber))))

/**
 * Interrupt and clear EVERY job — the registry's release, run by the scope.
 *
 * Deliberately NOT exported. An exported disposer is the shape E3 removed: a
 * cleanup that happens only when somebody remembers to call it, on the happy
 * path only.
 *
 * Emptying the `Ref` before interrupting keeps it idempotent against a
 * concurrent `cancel`.
 */
const interruptAllJobs = (jobs: JobRegistry): Effect.Effect<void> =>
  Ref.getAndSet(jobs, new Map<string, ScheduledJob>()).pipe(
    Effect.flatMap((current) =>
      Effect.forEach(Array.from(current.values()), (job) => Fiber.interrupt(job.fiber), {
        discard: true,
      })
    )
  )

const generateJobId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cron-${crypto.randomUUID()}`
  }
  return `cron-${String(Date.now())}-${String(Math.random()).slice(2, 10)}`
}

const scheduleImpl =
  (jobs: JobRegistry, scope: Scope.Scope) =>
  (
    cronExpression: string,
    callback: () => Effect.Effect<void, unknown>,
    options?: { readonly jobId?: string; readonly timezone?: string }
  ): Effect.Effect<string, CronSchedulerError> =>
    // The `Cron.parse + zoneMakeNamedUnsafe` triplet is duplicated here, in the
    // domain Schema filter (`cron.ts`), and in `presentation/api/routes/automations/index.ts`.
    // Kept inline because this site needs the original throw/Result.failure wrapped
    // in `CronSchedulerError({ cause })` so callers can inspect the underlying
    // failure — a shared helper that returned `Result<Cron, string>` would
    // collapse the cause chain to a flat message.
    Effect.gen(function* () {
      const timezone = options?.timezone ?? 'UTC'
      const jobId = options?.jobId ?? generateJobId()

      const zone = yield* Effect.try({
        try: () => DateTime.zoneMakeNamedUnsafe(timezone),
        catch: (cause) => new CronSchedulerError({ cause }),
      })

      const parsed = Cron.parse(cronExpression, zone)
      if (Result.isFailure(parsed)) {
        return yield* new CronSchedulerError({ cause: parsed.failure })
      }

      // Replace any existing job with the same id so re-registration on `--watch`
      // reload is well-defined: the old fiber is interrupted before the new one
      // is forked, so no two loops ever share an id.
      yield* cancelJob(jobs, jobId)
      // The job fiber must OUTLIVE this Effect — `schedule` is called from boot
      // code that returns as soon as every job is armed, so `Effect.forkChild`
      // would interrupt the loop the moment registration finished. It is forked
      // into the LAYER's scope instead, which lives as long as the server does.
      const fiber = yield* Effect.forkIn(cronJobLoop(jobId, parsed.success, callback), scope)
      yield* Ref.update(jobs, (current) =>
        withJob(current, { jobId, expression: cronExpression, timezone, fiber })
      )
      return jobId
    })

const cancelImpl =
  (jobs: JobRegistry) =>
  (jobId: string): Effect.Effect<void, CronSchedulerError> =>
    cancelJob(jobs, jobId)

const listJobsImpl = (
  jobs: JobRegistry
): Effect.Effect<readonly Record<string, unknown>[], CronSchedulerError> =>
  Ref.get(jobs).pipe(
    Effect.map((current) =>
      Array.from(current.values()).map((job) => ({
        jobId: job.jobId,
        expression: job.expression,
        timezone: job.timezone,
      }))
    )
  )

/**
 * The live scheduler, scoped to the layer that builds it.
 *
 * `Layer.effect` IS the scoped constructor in Effect 4 — there is no
 * `Layer.scoped` (it was removed; `rg 'declare const scoped' node_modules/effect/dist/Layer.d.ts`
 * returns nothing). `Layer.effectContext` runs the construction effect under
 * `Scope.provide(effect, scope)` with the layer's own memo scope, and the
 * resulting `Layer<I, E, Exclude<R, Scope>>` strips the requirement — so
 * `Effect.acquireRelease` and `Effect.scope` are usable here without leaking a
 * `Scope` into `createAppLayer`'s type.
 */
export const CronSchedulerLive = Layer.effect(
  CronScheduler,
  Effect.gen(function* () {
    // The registry IS the resource: acquiring it is cheap, releasing it
    // interrupts every fiber armed against it. Scope exit therefore tears the
    // scheduler down whether the server stopped cleanly, failed, or was
    // interrupted.
    const jobs = yield* Effect.acquireRelease(
      Ref.make<ReadonlyMap<string, ScheduledJob>>(new Map()),
      (registry) => interruptAllJobs(registry)
    )
    // Captured once, at construction: `schedule` is called later, from boot code
    // running on an unrelated fiber, which has no other way to reach this scope.
    const scope = yield* Effect.scope
    return CronScheduler.of({
      schedule: scheduleImpl(jobs, scope),
      cancel: cancelImpl(jobs),
      listJobs: listJobsImpl(jobs),
    })
  })
)
