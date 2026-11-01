/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The live {@link RetentionSweeps}: the same sweep functions the daily crons
 * call (`infrastructure/scheduling/register-*.ts`), each behind a typed
 * failure.
 *
 * Built over the `Database` service the composition provides: every sweep
 * reads and deletes through its client and asks its dialect. The sweeps open
 * their own transactions per call and hold nothing between calls, so there is
 * no resource for a scope to release.
 */

import { Effect, Layer } from 'effect'
import { RetentionSweepError, RetentionSweeps } from '@/application/ports/services/retention-sweeps'
import { resolvePurgeTableAuthorship } from './account-purge-authorship'
import { purgeDueAccounts } from './account-purge-sweep'
import { purgeExpiredActivityLogs } from './activity-log-retention'
import { purgeExpiredAuthRows } from './auth-expired-rows-sweep'
import { pruneExpiredAutomationRuns } from './automation-run-retention'
import { Database } from './drizzle/layer'
import { purgeReadNotifications } from './notification-retention'
import { purgeExpiredTableRows } from './table-retention'

/** Run one sweep, naming it on failure. */
const sweep = <A>(name: string, run: () => Promise<A>): Effect.Effect<A, RetentionSweepError> =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new RetentionSweepError({ sweep: name, cause }),
  })

export const RetentionSweepsLive = Layer.effect(
  RetentionSweeps,
  Effect.map(Database, (database) =>
    RetentionSweeps.of({
      pruneAutomationRuns: sweep('automation run history', () =>
        pruneExpiredAutomationRuns(database)
      ),
      purgeExpiredTableRows: (app) =>
        sweep('table retention', () => purgeExpiredTableRows(database, app)),
      purgeReadNotifications: (app) =>
        sweep('notification retention', () => purgeReadNotifications(database.client, app)),
      purgeExpiredActivityLogs: sweep('activity-log retention', () =>
        purgeExpiredActivityLogs(database)
      ),
      purgeExpiredAuthRows: sweep('expired sign-in rows', () => purgeExpiredAuthRows(database)),
      // Authorship columns are resolved from each table's DECLARED FIELD TYPES,
      // not assumed to be the literal `created_by`: a `{ name: 'author',
      // type: 'created-by' }` field is valid config, and matching by literal name
      // would delete nothing while still counting the account as erased.
      purgeDueAccounts: (app) =>
        sweep('account erasure', () =>
          purgeDueAccounts(
            database,
            (app.tables ?? []).map((table) => resolvePurgeTableAuthorship(app.tables, table.name)),
            app
          )
        ),
    })
  )
)
