/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How one instance spends its PostgreSQL connection budget.
 *
 * `DATABASE_POOL_MAX` is the instance's TOTAL: at no instant does one process
 * hold more PostgreSQL connections than that number. It is split three ways:
 *
 * - `listeners` — one `LISTEN` connection for each AI listener the app uses
 *   (the compute listener, the knowledge listener), held for the life of the
 *   server;
 * - `maintenance` — ONE connection for every short-lived client (migrations,
 *   their pre-flight, schema initialisation, the dry run, the command-search
 *   index, the runtime-settings probe), which run one after another;
 * - `requestPool` — everything left, the pool that serves requests.
 *
 * Bun's driver opens every connection of a pool on its first query, so a
 * pool's size is its footprint from the first read: the split has to hold from
 * the start, not merely under load.
 */
export interface DatabaseConnectionPlan {
  readonly requestPool: number
  readonly maintenance: 1
  readonly listeners: number
}

/** A budget too small for this app: what it was, and the smallest it accepts. */
export interface DatabaseConnectionRefusal {
  readonly poolMax: number
  readonly minimum: number
  readonly listeners: number
}

/**
 * Split `poolMax` connections between the request pool, the maintenance slot
 * and the `listeners` `LISTEN` connections — or refuse when `poolMax` cannot
 * give the request pool at least one connection (the minimum is `2 + listeners`).
 */
export const planDatabaseConnections = (input: {
  readonly poolMax: number
  readonly listeners: number
}):
  | { readonly ok: true; readonly plan: DatabaseConnectionPlan }
  | { readonly ok: false; readonly refusal: DatabaseConnectionRefusal } => {
  const listeners = Math.max(0, Math.floor(input.listeners))
  // A fractional value counts its whole connections only: the driver cannot
  // build a pool of 2.5 connections (it fails on the first query).
  const poolMax = Math.floor(input.poolMax)
  const minimum = 2 + listeners
  if (poolMax < minimum) {
    return { ok: false, refusal: { poolMax: input.poolMax, minimum, listeners } }
  }
  return {
    ok: true,
    plan: { requestPool: poolMax - 1 - listeners, maintenance: 1, listeners },
  }
}

/** The sentence a boot refused for a budget too small is stopped with. */
export const describeDatabaseConnectionRefusal = (refusal: DatabaseConnectionRefusal): string =>
  `DATABASE_POOL_MAX=${refusal.poolMax} is too small for this app: it needs at least ` +
  `${refusal.minimum} PostgreSQL connections — 1 to serve requests, 1 for migrations and ` +
  `maintenance${
    refusal.listeners === 0
      ? ''
      : `, and ${refusal.listeners} for the AI listener${refusal.listeners === 1 ? '' : 's'} it declares`
  }. Set DATABASE_POOL_MAX to ${refusal.minimum} or more.`
