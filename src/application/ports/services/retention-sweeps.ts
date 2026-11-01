/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The destructive sweeps the engine runs on a schedule, as the application
 * reaches them.
 *
 * Each sweep is database work with its own transactions, batching and
 * dialect handling, so it lives in infrastructure; the daily crons call it
 * there. Their on-demand twins — the internal-scheduler trigger routes a test
 * fires deterministically — reach the SAME sweep through this port and a
 * use-case, so an HTTP handler never imports database behaviour.
 */

import { Context, Data, type Effect } from 'effect'
import type { App } from '@/domain/models/app'

/** A sweep that could not finish. `sweep` names it; `cause` is its own error. */
export class RetentionSweepError extends Data.TaggedError('RetentionSweepError')<{
  readonly sweep: string
  readonly cause: unknown
}> {}

export class RetentionSweeps extends Context.Service<
  RetentionSweeps,
  {
    /** Delete the automation runs that ended before the run-history window; answers how many. */
    readonly pruneAutomationRuns: Effect.Effect<number, RetentionSweepError>
    /** Delete every table's rows past its declared retention window; answers the count per table. */
    readonly purgeExpiredTableRows: (
      app: App
    ) => Effect.Effect<Readonly<Record<string, number>>, RetentionSweepError>
    /** Delete the notifications past `notifications.retention.days`; answers how many. */
    readonly purgeReadNotifications: (
      app: Pick<App, 'notifications'>
    ) => Effect.Effect<number, RetentionSweepError>
    /** Delete the activity-log rows past the retention window; answers how many. */
    readonly purgeExpiredActivityLogs: Effect.Effect<number, RetentionSweepError>
    /**
     * Erase every account whose scheduled erasure is due, with its rows in the
     * app's tables; answers how many were erased (a deferred last admin is not).
     */
    readonly purgeDueAccounts: (app: App) => Effect.Effect<number, RetentionSweepError>
    /**
     * Delete the device codes and verification rows (passkey challenges,
     * emailed codes, link tokens) whose expiry has passed; answers how many
     * went from each table.
     */
    readonly purgeExpiredAuthRows: Effect.Effect<
      { readonly deviceCodes: number; readonly verifications: number },
      RetentionSweepError
    >
  }
>()('RetentionSweeps') {}
