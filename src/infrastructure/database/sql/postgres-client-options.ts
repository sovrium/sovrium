/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SQL } from 'bun'
import { logWarning } from '@/infrastructure/logging/logger'

/**
 * The options every PostgreSQL client the engine opens is built with.
 *
 * `jit = off` is sent as a startup parameter on each connection. PostgreSQL's
 * JIT compiler kicks in on a query whose estimated cost crosses
 * `jit_above_cost`, and the engine's queries — a record page, a lookup view, a
 * catalog probe — are short: compiling them costs more than it saves, and the
 * planner's estimate over a lookup view is high enough to trigger it. One
 * builder, so the pool and every short-lived client agree and a unit test has
 * one place to assert.
 *
 * A connection pooler in front of the server can refuse a startup parameter it
 * does not know: a stock PgBouncer answers « unsupported startup parameter:
 * jit » and refuses the CONNECTION, which would stop the app from starting at
 * all. So the setting is sent only to a database that has been seen to accept
 * it — {@link probePostgresRuntimeSettings}, run first thing when migrations
 * run (every start, and `sovrium migrate`) — and a client built before or
 * without that probe sends none: JIT then stays the server's default, which
 * costs speed, never the start.
 */

/** PostgreSQL runtime settings sent when a connection opens. */
export const POSTGRES_RUNTIME_SETTINGS = { jit: 'off' } as const

/**
 * Seconds a pooled connection may sit idle before the pool closes it itself.
 *
 * A server, a pooler or a network path may end an idle connection on its own
 * schedule (PostgreSQL's `idle_session_timeout`, a proxy's idle cut, a NAT
 * table expiry). The pool does not notice until it hands that connection to
 * the next query, which then fails with « terminating connection due to
 * idle-session timeout » — a request that did nothing wrong answers with an
 * error. Work that runs after a quiet spell is exposed first: the realtime
 * re-check sweep runs every 30 seconds, and against a server that ends idle
 * sessions after 30 seconds its first read met a dead connection and closed a
 * healthy subscription. Retiring idle connections at 20 seconds keeps the pool
 * ahead of any such cut down to that bound, at the cost of reopening a
 * connection after a quiet spell.
 */
export const POSTGRES_POOL_IDLE_TIMEOUT_SECONDS = 20

/** What {@link postgresClientOptions} builds: Bun `SQL`'s own option names. */
export interface PostgresClientOptions {
  readonly url: string
  readonly max?: number
  readonly idleTimeout?: number
  readonly connection?: typeof POSTGRES_RUNTIME_SETTINGS
}

/**
 * The database URLs whose server (or pooler) accepted the runtime settings.
 * Process-wide by design: every client of the process reads the one answer.
 */
const acceptingUrls = new Set<string>()

/** The database URLs that refused them — probed once, and said once. */
const refusingUrls = new Set<string>()

/** Whether a probe has seen `url` accept the runtime settings. */
export const acceptsRuntimeSettings = (url: string): boolean => acceptingUrls.has(url)

/**
 * The options for a PostgreSQL client on `url`: for a pool (a size is given),
 * that size and the idle retirement above; and the runtime settings above once
 * `url` has been seen to accept them.
 */
export const postgresClientOptions = (
  url: string,
  pool?: Readonly<{ readonly max?: number }>
): PostgresClientOptions => ({
  url,
  ...(pool?.max === undefined
    ? {}
    : { max: pool.max, idleTimeout: POSTGRES_POOL_IDLE_TIMEOUT_SECONDS }),
  ...(acceptsRuntimeSettings(url) ? { connection: POSTGRES_RUNTIME_SETTINGS } : {}),
})

/** A refusal of the startup parameter itself, as opposed to a database that is down. */
export const isStartupParameterRefusal = (error: unknown): boolean =>
  /unsupported startup parameter|unrecognized configuration parameter/i.test(String(error))

/**
 * Open one connection WITH the runtime settings and remember whether it was
 * accepted. Never rejects: a refusal (a pooler) leaves the settings off and
 * says so; any other failure leaves them off quietly, and the caller's own
 * first query reports it.
 *
 * @total
 */
export const probePostgresRuntimeSettings = async (url: string): Promise<boolean> => {
  if (acceptingUrls.has(url)) return true
  if (refusingUrls.has(url)) return false
  const client = new SQL({ url, max: 1, connection: POSTGRES_RUNTIME_SETTINGS })
  const accepted = await client.unsafe('SELECT 1').then(
    () => true,
    (error: unknown) => {
      if (isStartupParameterRefusal(error)) {
        refusingUrls.add(url)
        logWarning(
          '[database] the connection refuses runtime settings (a pooler such as PgBouncer?) — JIT compilation is left to the server',
          { reason: String(error) }
        )
      }
      return false
    }
  )
  await client.close().catch(() => undefined)
  if (accepted) {
    acceptingUrls.add(url)
  }
  return accepted
}
