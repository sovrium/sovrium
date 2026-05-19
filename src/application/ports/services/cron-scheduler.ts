/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

export class CronSchedulerError extends Data.TaggedError('CronSchedulerError')<{
  readonly cause: unknown
}> {}

export class CronScheduler extends Context.Tag('CronScheduler')<
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
    readonly listJobs: () => Effect.Effect<readonly Record<string, unknown>[], CronSchedulerError>
  }
>() {}
