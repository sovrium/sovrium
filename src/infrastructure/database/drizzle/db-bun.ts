/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { dirname } from 'node:path'
import { Database as BunSqlite } from 'bun:sqlite'
import { drizzle as drizzlePg } from 'drizzle-orm/bun-sql'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import {
  ensurePrivateDirectory,
  restrictSqliteFiles,
} from '@/infrastructure/filesystem/private-modes'
import { logError } from '@/infrastructure/logging/logger'
import { recordDbQueryIssued } from '@/infrastructure/telemetry/db-query-counter'
import { resetTableColumnCache } from '../sql/dialect-introspection'
import { acceptsRuntimeSettings, postgresClientOptions } from '../sql/postgres-client-options'
import { requestPoolSize } from '../sql/postgres-connection-budget'
import { applySqlitePragmas } from '../sql/sqlite-pragmas'
import { primeSqliteVec, resetSqliteVecCache } from '../sql/sqlite-vec-extension'
import { setActiveDialectKind } from './active-dialect'
import { isSqliteDialect, resetDialectCache } from './dialect-schema'
import { makeSerializedSqliteClient } from './sqlite-serialized-client'
import { refuseSharedDbInTransactionBody } from './transaction-body-guard'
import type { PortableDb } from './portable-db'
import type { Logger } from 'drizzle-orm'

/**
 * Dual-dialect lazy Drizzle initialization.
 *
 * The eager `drizzle(...)` call at module-import time crashed boot when
 * `DATABASE_URL` was unset, which forced ~7 callsites across the codebase to
 * defer the entire repository module via `await import('@/infrastructure/database/...')`
 * so boot paths that don't touch the database (CLI's `schema` / `validate`
 * subcommands, type-only test fixtures) wouldn't trip the assertion.
 *
 * Initialization lives in a memoizing `getDb()` function. The first caller
 * resolves the dialect via `parseDatabaseDialectConfig()` and constructs the
 * matching client; subsequent callers reuse the cached client. Boot paths that
 * don't touch the database never call `getDb()`.
 *
 * Two engines are supported:
 *
 *   - `postgres` — `drizzle-orm/bun-sql` over the `DATABASE_URL`. This is the
 *     historical behavior and is unchanged.
 *   - `sqlite` — a drizzle SQLite client over a `bun:sqlite` `Database`. Selected
 *     when no `DATABASE_URL` is configured (the zero-config, frugal-by-default
 *     engine). WAL journaling, foreign-key enforcement, and a busy timeout are
 *     enabled before the Drizzle wrapper is built.
 */

/**
 * The handle of a built client, kept beside it because closing it is
 * engine-specific and the portable surface names no driver.
 */
interface BuiltClient {
  readonly client: PortableDb
  /** End the connections: finishes in-flight statements on PostgreSQL. Idempotent. */
  readonly close: () => Promise<void> | void
}

let cached: BuiltClient | undefined

/**
 * The PostgreSQL URL of a `cached` pool built WITHOUT the runtime settings
 * (`postgres-client-options.ts`), because no probe had yet seen the database
 * accept them. The start probes before anything reads the database, so this
 * stays `undefined` on a normal boot; it is the safety net for a reader that
 * reaches the client first. Once a probe accepts, the next `getDb()` rebuilds the
 * pool with the settings and CLOSES the early one: a second pool left open
 * would hold its connections on top of the instance's `DATABASE_POOL_MAX`.
 */
let builtWithoutSettings: string | undefined

/** The size `cached` was built with, so a changed budget rebuilds it. */
let builtPoolSize: number | undefined

/** Whether `cached` was built before the database was seen to accept the runtime settings. */
const settingsArrivedSinceBuild = (): boolean =>
  builtWithoutSettings !== undefined && acceptsRuntimeSettings(builtWithoutSettings)

/** Whether `cached` is a PostgreSQL pool sized for another budget than today's. */
const budgetChangedSinceBuild = (): boolean =>
  builtPoolSize !== undefined && builtPoolSize !== requestPoolSize()

/**
 * Per-request query-count tap (the keystone of the query-count seam — see
 * `@/infrastructure/telemetry/db-query-counter`). Both driver sessions call
 * `logQuery` exactly once per issued statement (`bun-sql/session.js` and
 * `bun-sqlite/session.js`: `all()` either logs directly or delegates to
 * `values()`, which logs — never both), so incrementing here counts each
 * statement exactly once, on both dialects. `recordDbQueryIssued` is a no-op
 * outside a counted request (ALS store absent), so boot/listener queries
 * cost one map lookup and record nothing. The statement text is passed along
 * so a catalog lookup is counted as one too.
 */
const countingLogger: Logger = {
  logQuery: (query: string): void => recordDbQueryIssued(query),
}

/**
 * Build the dialect-appropriate Drizzle client.
 *
 * The SQLite branch opens the `bun:sqlite` database (creating the file if it
 * does not exist), applies the standard production PRAGMAs, then wraps it with
 * the `bun-sqlite` Drizzle driver. The resulting client is cast to the
 * `PortableDb` facade — the query-builder surface used by every `db` consumer is
 * structurally compatible across the two dialects.
 */
const buildClient = (): BuiltClient => {
  const config = parseDatabaseDialectConfig(process.env)

  if (config.dialect === 'postgres') {
    // `max` is passed EXPLICITLY rather than left to bun:sql's implicit default,
    // so the pool size the application budgets its concurrent fan-outs against
    // is a stated number (see `resolveDatabasePoolMax`) instead of an assumption
    // about the driver — and so an operator on a larger Postgres can raise it
    // via `DATABASE_POOL_MAX` without patching code.
    //
    // The size is the REQUEST pool's share of `DATABASE_POOL_MAX`, not the
    // whole of it: the maintenance slot and the AI listeners count against the
    // same number (`postgres-connection-budget.ts`).
    builtWithoutSettings = acceptsRuntimeSettings(config.databaseUrl)
      ? undefined
      : config.databaseUrl
    builtPoolSize = requestPoolSize()
    const pg = drizzlePg({
      connection: postgresClientOptions(config.databaseUrl, { max: builtPoolSize }),
      logger: countingLogger,
    })
    // Undo the `bigint: true` that drizzle-orm 1.0.0-rc.4/rc.5 forces on EVERY client.
    //
    // `construct()` (bun-sql/postgres/driver.ts) opens with an unconditional
    // `client.options.bigint = true`, on all four `drizzle()` entry paths - so
    // passing `bigint: false` in `connection` above would be overwritten, and
    // resetting it here is the only available seam. 0.45.2 did not do this.
    //
    // Bun's own documented default is `false` (its type declaration says values
    // outside the 32-bit integer range come back as BigInt, and that by default
    // they are returned as strings), so this restores stock driver behaviour
    // rather than opting into a quirk. Measured on Bun 1.4.0 the flag is NOT
    // limited to that range as the wording suggests: with it on, `COUNT(*)` of
    // 3 arrives as `3n`.
    //
    // The `int8 -> string` wire contract is load-bearing. The only relations
    // emitting int8 are the generated lookup views (SUM/COUNT rollups), whose
    // values reach `formattedFieldValueSchema` - a union admitting no bigint,
    // which rejects with `Expected FormattedFieldValue` and turns every list and
    // create on a table carrying rollups into an HTTP 500. The contract is pinned
    // by `rollup.spec.ts` ROLLUP-007 (`toBe('4')`) and by the `toFiniteCount` /
    // `Number()` coercions the read paths depend on.
    pg.$client.options.bigint = false
    return { client: pg, close: () => pg.$client.close() }
  }

  // SQLite — open the file (create on first boot), then harden the connection.
  // Create the parent dir first; `{ create: true }` makes the file but not its
  // directory, and the zero-config default now nests under `./.sovrium/`. Skip
  // the in-memory sentinel (no filesystem path).
  builtPoolSize = undefined
  if (config.path !== ':memory:') {
    ensurePrivateDirectory(dirname(config.path))
  }
  // Phase 2 RAG acceleration: when `RAG_SQLITE_VEC=on`, open the
  // sqlite-vec accelerated connection FIRST. `Database.setCustomSQLite` (needed
  // on macOS for native extension loading) is process-global + one-shot and must
  // run before any other `Database` opens — so this runs ahead of the primary
  // client below. No-op when acceleration is off / unavailable (frugal default).

  primeSqliteVec(config.path)
  const client = new BunSqlite(config.path, { create: true })
  // Private before the WAL switch below, so the journal SQLite creates there
  // takes the same mode; a journal left by an earlier run is set after it.
  if (config.path !== ':memory:') restrictSqliteFiles(config.path)
  // Foreign keys, WAL journaling and the busy timeout, from the one module that
  // spells them. A local copy is a trap: with `busy_timeout` LAST, the WAL
  // switch runs unprotected against the very lock the timeout exists for.

  applySqlitePragmas(client)
  if (config.path !== ':memory:') restrictSqliteFiles(config.path)

  // Not the stock `drizzle-orm/bun-sqlite` client: its `transaction()` is
  // synchronous, so an async body committed at its first `await`. This client
  // opens transactions by hand and serialises them against every other
  // statement on the one shared connection — see `sqlite-serialized-client.ts`.
  const sqliteDb = makeSerializedSqliteClient(client, countingLogger)
  // The one place the portable claim is made for SQLite: its builders share the
  // subset `PortableDb` names, but drizzle types them per dialect, so no
  // assignment can state it. `schema-column-parity.test.ts` holds the tables.
  return { client: sqliteDb as unknown as PortableDb, close: () => client.close() }
}

/**
 * Release the driver handle of a client the memo no longer hands out.
 *
 * The runtime handle is a `bun:sqlite` `Database` (synchronous `close()`) or a
 * `bun:sql` pool (`close()` resolves once the in-flight queries have finished
 * and every connection is ended); both are idempotent. A failure to close is
 * logged and otherwise ignored: the client is already out of the memo, so the
 * caller has nothing left to act on, and the worst outcome is the leak this
 * close exists to prevent. The returned promise therefore never rejects.
 */
const closeRetiredClient = (built: BuiltClient): Promise<void> =>
  Promise.resolve()
    .then(built.close)
    .catch((cause: unknown) =>
      logError(
        '[database] could not close a database client dropped from the cache; its connections may stay open',
        cause
      )
    )

/**
 * How many times {@link resetDbCache} has retired the client. A layer acquired
 * in an older generation (an in-process harness re-booting while the previous
 * server still stops) releases nothing, rather than closing the NEXT server's.
 */
const generation = new Map<'count', number>([['count', 0]])

/** The current client generation (see {@link resetDbCache}). */
export const dbClientGeneration = (): number => generation.get('count') ?? 0

/**
 * Forget the client and every memo built beside it, handing back the client
 * that was dropped so the caller decides how to close it.
 */
const forgetClient = (): BuiltClient | undefined => {
  const retired = cached
  cached = undefined
  builtWithoutSettings = undefined
  builtPoolSize = undefined
  // The sqlite-vec acceleration, the table selectors' dialect and the column
  // cache, in lock-step with the connection: a rebuilt one re-resolves them.
  resetSqliteVecCache()
  resetDialectCache()
  resetTableColumnCache()
  return retired
}

/**
 * Close the client because the last `Database` layer holding it released, and
 * WAIT for the close, so a stop ends with its connections ended. Unlike
 * {@link resetDbCache} it starts no new generation. Never rejects.
 */
export const releaseDbClient = async (): Promise<void> => {
  const retired = forgetClient()
  if (retired !== undefined) await closeRetiredClient(retired)
}

/**
 * Whether the request pool (or the SQLite handle) has been built. A check that
 * runs before it — a start's first read — goes through the maintenance slot
 * instead, so the pool is built once, after the runtime-settings probe; a check
 * that runs after it reuses the pool rather than opening a connection beside it.
 */
export const hasBuiltDbClient = (): boolean => cached !== undefined

export const getDb = (): PortableDb => {
  if (cached !== undefined && !settingsArrivedSinceBuild() && !budgetChangedSinceBuild()) {
    return cached.client
  }
  const retired = cached
  const built = buildClient()
  cached = built
  if (retired !== undefined) void closeRetiredClient(retired)
  return built.client
}

/**
 * Drop the memoized client so the next `getDb()` re-resolves the dialect from
 * the *current* `DATABASE_URL` and rebuilds.
 *
 * The `cached` memo is module-level state shared across every importer in the
 * Bun test process. A test that triggers `getDb()` (e.g. starting a server)
 * freezes `cached` to whatever `DATABASE_URL` was active at that moment; a later
 * test that re-points `DATABASE_URL` at its own database then silently reuses
 * the stale client (see `auth.sqlite.smoke.test.ts`). This is the same
 * process-global contamination class as `mock.module()` — `mock.restore()`
 * doesn't evict it because it isn't a mock.
 *
 * Tests that pin `DATABASE_URL` to a dedicated file MUST call this in `beforeAll`
 * (after setting the env var, before the first `getDb()` access) so the
 * client points at their database, and again in `afterAll` so they don't leave a
 * stale client pointing at a now-deleted temp file for the next test. Production
 * never calls this: there the running `Database` layer owns the client and
 * closes it when the server stops (`database-lease.ts`).
 *
 * A reset starts a new client GENERATION: a layer acquired before it owns
 * nothing any more, and its later release closes nothing.
 *
 * The dropped client is CLOSED, not merely forgotten. A process that boots the
 * server several times (an in-process test harness, one boot per story) would
 * otherwise keep every earlier pool's connections open until its database is
 * dropped, and run the PostgreSQL server out of connection slots part-way
 * through. Closing is graceful: a PostgreSQL pool finishes the queries already
 * in flight before it disconnects. The reset itself stays synchronous for its
 * callers; the close completes in the background.
 *
 * @internal Test-isolation hook for the module-level memo.
 */
export const resetDbCache = (): void => {
  const retired = forgetClient()
  generation.set('count', dbClientGeneration() + 1)
  // The leases of the old generation own nothing now; the next one to be
  // acquired publishes the dialect again.
  setActiveDialectKind(undefined)
  if (retired !== undefined) void closeRetiredClient(retired)
}

/**
 * A client forwarding every property read to the memoised one (built on first
 * read), so a holder reaches a REBUILT pool instead of keeping a closed one.
 * `assertUsable` runs first, so a released holder fails by name instead of
 * quietly reopening a pool.
 *
 * @param assertUsable - throws when the holder may no longer reach the client
 */
export const makeForwardingClient = (assertUsable: () => void): PortableDb =>
  new Proxy({} as PortableDb, {
    get: (_target, prop) => {
      assertUsable()
      // A transaction body reaching the shared client would deadlock on SQLite.
      refuseSharedDbInTransactionBody(isSqliteDialect)
      return Reflect.get(getDb(), prop)
    },
  })
