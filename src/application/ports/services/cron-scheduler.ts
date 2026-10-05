/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Error for cron scheduler operations
 */
export class CronSchedulerError extends Data.TaggedError('CronSchedulerError')<{
  readonly cause: unknown
}> {}

/**
 * Cron Scheduler Port
 *
 * Provides cron-based job scheduling, cancellation, and listing.
 * Implementation lives in infrastructure layer.
 */
export class CronScheduler extends Context.Service<
  CronScheduler,
  {
    readonly schedule: (
      cronExpression: string,
      callback: () => Effect.Effect<void, unknown>,
      options?: {
        readonly jobId?: string
        readonly timezone?: string
      }
    ) => Effect.Effect<string, CronSchedulerError>
    readonly cancel: (jobId: string) => Effect.Effect<void, CronSchedulerError>
    /**
     * Start `callback` once, now, in the background, and return at once. The
     * run belongs to the scheduler's scope, so stopping the server interrupts
     * it exactly as it interrupts the scheduled jobs; a failure or defect is
     * logged under `jobId` and absorbed. For boot work that must not hold the
     * boot up — a catch-up sweep — but must not outlive the server either.
     */
    readonly runOnce: (
      callback: () => Effect.Effect<void, unknown>,
      options: { readonly jobId: string }
    ) => Effect.Effect<void>
    readonly listJobs: Effect.Effect<readonly Record<string, unknown>[], CronSchedulerError>
  }
>()('CronScheduler') {}
