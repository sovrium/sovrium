/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cron, DateTime, Effect, Either, Layer } from 'effect'
import { CronScheduler, CronSchedulerError } from '@/application/ports/services/cron-scheduler'


interface ScheduledJob {
  readonly jobId: string
  readonly expression: string
  readonly timezone: string
  readonly timer: ReturnType<typeof setTimeout>
}

const jobs = new Map<string, ScheduledJob>()

const cancelTimer = (jobId: string): void => {
  const job = jobs.get(jobId)
  if (job === undefined) return
  clearTimeout(job.timer)
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
    if (jobs.has(jobId)) {
      armTimer(input)
    }
  }, delay)
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

export const disposeCronScheduler = (): void => {
  Array.from(jobs.values()).forEach((job) => {
    clearTimeout(job.timer)
  })
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
