/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { Effect } from 'effect'
import { planDatabaseConnections } from '@/domain/models/process-env/database/database-connection-plan'
import { resolveDatabasePoolMax } from '@/domain/models/process-env/database/database-dialect'
import { postgresClientOptions, probePostgresRuntimeSettings } from './postgres-client-options'
import type { Scope } from 'effect'

/**
 * The `LISTEN` connections this process has said it will open, as the start
 * declared them before the request pool was first built (see
 * `DatabaseMigrator.migrate`). Process-wide: there is one request pool per
 * process, and it is sized against this number.
 */
let reservedListeners = 0

/**
 * Declare how many `LISTEN` connections this process will hold, so the request
 * pool leaves room for them inside `DATABASE_POOL_MAX`. A pool already built
 * with another size is rebuilt on the next `getDb()`, and the one it replaces is
 * closed.
 */
export const reserveListenerConnections = (listeners: number): void => {
  reservedListeners = Math.max(0, Math.floor(listeners))
}

/**
 * The size of the request pool: `DATABASE_POOL_MAX`, minus the maintenance
 * slot every short-lived client shares, minus the reserved listeners
 * (`planDatabaseConnections`).
 *
 * A budget too small for the plan is refused before the server starts
 * (`validateBootEnvironment`); a command that opens the database without
 * starting a server (`sovrium migrate`, `seed`) still gets a pool of one rather
 * than none.
 */
export const requestPoolSize = (): number => {
  const planned = planDatabaseConnections({
    poolMax: resolveDatabasePoolMax(),
    listeners: reservedListeners,
  })
  return planned.ok ? planned.plan.requestPool : 1
}

/**
 * Check that `url` answers, on one short-lived connection (the maintenance
 * slot), after probing its runtime settings. For a start's first read: it
 * builds no request pool, so the pool is built once, after the probe answered.
 */
export const pingThroughMaintenanceSlot = async (url: string): Promise<void> => {
  await probePostgresRuntimeSettings(url)
  const client = new SQL(postgresClientOptions(url, { max: 1 }))
  try {
    await client.unsafe('SELECT 1')
  } finally {
    await client.close()
  }
}

/**
 * The maintenance slot as a scoped resource: one connection on `url`, closed
 * on EVERY exit of the scope. A `try`/`finally` around `yield*` cannot do
 * this, because `Effect.gen` abandons its generator on failure and never runs
 * the `finally` — a failed start would keep the connection open against
 * `DATABASE_POOL_MAX`.
 */
export const acquireMaintenanceClient = (url: string): Effect.Effect<SQL, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => new SQL(postgresClientOptions(url, { max: 1 }))),
    // effect-promise: total -- `SQL.close()` resolves once the pool is drained and has no rejection path; as the RELEASE arm it must stay infallible, or a teardown failure would displace the outcome of the work it served.
    (client) => Effect.promise(() => client.close())
  )
