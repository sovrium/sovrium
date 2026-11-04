/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { logError } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { hourlyCronExpression } from './hourly-maintenance'
import type { CronScheduler } from '@/application/ports/services/cron-scheduler'

/** One recurring sweep, as the registrars arm it. */
export interface SweepSchedule {
  /** When it runs, read in the operator's timezone (`TZ`). */
  readonly cronExpression: string
  readonly jobId: string
  /** The line logged when the schedule cannot be armed. */
  readonly armFailure: string
  /** One run, re-run on every tick; it logs and swallows its own failures, so the timer re-arms. */
  readonly sweep: Effect.Effect<void, unknown>
}

/**
 * Arm one recurring sweep on the server's scheduler, in the operator's
 * timezone. A schedule that cannot be armed is logged and answers `undefined`
 * rather than failing the boot: a missing sweep only defers clean-up.
 */
export const armSweepSchedule = (
  scheduler: CronScheduler['Service'],
  schedule: SweepSchedule
): Effect.Effect<string | undefined> =>
  scheduler
    .schedule(schedule.cronExpression, () => schedule.sweep, {
      jobId: schedule.jobId,
      timezone: resolveOperatorTimezone(process.env),
    })
    .pipe(
      Effect.catch((err) =>
        Effect.sync(() => {
          logError(schedule.armFailure, err)
          return undefined
        })
      )
    )

/**
 * Arm one of the hourly maintenance jobs: once an hour, at the minute of the
 * hour derived from the app's name (`hourly-maintenance.ts`), so every hourly
 * job of an instance runs together and instances on one host do not.
 */
export const armHourlySweep = (
  scheduler: CronScheduler['Service'],
  appName: string,
  schedule: Omit<SweepSchedule, 'cronExpression'>
): Effect.Effect<string | undefined> =>
  armSweepSchedule(scheduler, { ...schedule, cronExpression: hourlyCronExpression(appName) })
