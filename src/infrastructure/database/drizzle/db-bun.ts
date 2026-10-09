/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { Database as BunSqlite } from 'bun:sqlite'
import { drizzle as drizzlePg } from 'drizzle-orm/bun-sql'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { logError } from '@/infrastructure/logging/logger'
import { recordDbQueryIssued } from '@/infrastructure/telemetry/db-query-counter'
import { acceptsRuntimeSettings, postgresClientOptions } from '../sql/postgres-client-options'
import { requestPoolSize } from '../sql/postgres-connection-budget'
import { applySqlitePragmas } from '../sql/sqlite-pragmas'
import { primeSqliteVec, resetSqliteVecCache } from '../sql/sqlite-vec-extension'
import { UnsupportedInSqliteError } from '../unsupported-in-sqlite'
import { makeSerializedSqliteClient } from './sqlite-serialized-client'
import { refuseSharedDbInTransactionBody } from './transaction-body-guard'
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
 *
 * The `db` proxy preserves the eager-import API (`import { db } from
 * '@/infrastructure/database'` keeps working) by deferring property access to
 * `getDb()` on every read. Better Auth's `drizzleAdapter` consumes `db` the
 * same way and continues to work unchanged.
 */

/**
 * Public database facade.
 *
 * `DrizzleDB` is intentionally the PostgreSQL client type (`drizzle-orm/bun-sql`).
 * It is the canonical seam every `db` importer (~36 files) and the `Database`
 * Effect Context.Tag are typed against — the Postgres query-builder surface
 * (`select` / `insert` / `update` / `delete` / `transaction` / `query` / `$with`
 * / `with` / `execute`) is the contract repositories and CRUD code are written
 * to.
 *
 * In SQLite mode the runtime object is a drizzle SQLite client (async result
 * mode, transactions serialised — `sqlite-serialized-client.ts`). Its
 * query-builder surface is structurally compatible for the portable subset
 * (`select` / `insert` / `update` / `delete` / `transaction` / `query` / `$with`
 * / `with`), so it is cast to `DrizzleDB` at the seam inside `getDb()`. The two
 * genuinely Postgres-only members are raw `execute()` and the materialized-view
 * helper; SQLite callers must not reach them. New code that requires guaranteed
 * Postgres semantics uses `getPgDb()` (below), which throws on SQLite.
 *
 * ## No `schema` map, and why that is not a loss
 *
 * Drizzle v1 removed `schema` from every driver config outright
 * (`DrizzlePgConfig = Omit<DrizzleConfig, 'schema'>`), and the first type
 * parameter of `drizzle()` is now the RELATIONS config rather than the table
 * map — which is why `ReturnType<typeof drizzlePg<typeof schemaPg>>` stopped
 * type-checking rather than merely changing meaning. The table map only ever
 * powered the relational query builder (`db.query.*`), which this codebase has
 * never called: the surface every repository is written against (`select` /
 * `insert` / `update` / `delete` / `transaction` / `execute`) does not read it.
 * Nothing is given up. If RQB is ever wanted, v1 feeds it a `relations` object
 * built by `defineRelations` — a different artifact from the deleted
 * `relations()` graph, and not a revival of it.
 */
export type DrizzleDB = ReturnType<typeof drizzlePg>

let cached: DrizzleDB | undefined

/**
 * The PostgreSQL URL of a `cached` pool built WITHOUT the runtime settings
 * (`postgres-client-options.ts`), because no probe had yet seen the database
 * accept them. The start probes before anything reads the database, so this
 * stays `undefined` on a normal boot; it is the safety net for a reader that
 * reaches `db` first. Once a probe accepts, the next `getDb()` rebuilds the
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
 * outside a counted request (ALS store absent), so boot/cron/listener queries
 * cost one map lookup and record nothing.
 */
const countingLogger: Logger = {
  logQuery: (): void => recordDbQueryIssued(),
}

/**
 * Build the dialect-appropriate Drizzle client.
 *
 * The SQLite branch opens the `bun:sqlite` database (creating the file if it
 * does not exist), applies the standard production PRAGMAs, then wraps it with
 * the `bun-sqlite` Drizzle driver. The resulting client is cast to the
 * `DrizzleDB` facade — the query-builder surface used by every `db` consumer is
 * structurally compatible across the two dialects.
 */
const buildClient = (): DrizzleDB => {
  const config = parseDatabaseDialectConfig()

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
    // Undo the `bigint: true` that drizzle-orm 1.0.0-rc.4 forces on EVERY client.
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
    return pg
  }

  // SQLite — open the file (create on first boot), then harden the connection.
  // Create the parent dir first; `{ create: true }` makes the file but not its
  // directory, and the zero-config default now nests under `./.sovrium/`. Skip
  // the in-memory sentinel (no filesystem path).
  builtPoolSize = undefined
  if (config.path !== ':memory:') {
    mkdirSync(dirname(config.path), { recursive: true })
  }
  // Phase 2 RAG acceleration: when `RAG_SQLITE_VEC=on`, open the
  // sqlite-vec accelerated connection FIRST. `Database.setCustomSQLite` (needed
  // on macOS for native extension loading) is process-global + one-shot and must
  // run before any other `Database` opens — so this runs ahead of the primary
  // client below. No-op when acceleration is off / unavailable (frugal default).

  primeSqliteVec(config.path)
  const client = new BunSqlite(config.path, { create: true })
  // Foreign keys, WAL journaling and the busy timeout, from the one module that
  // spells them. A local copy is a trap: with `busy_timeout` LAST, the WAL
  // switch runs unprotected against the very lock the timeout exists for.

  applySqlitePragmas(client)

  // Not the stock `drizzle-orm/bun-sqlite` client: its `transaction()` is
  // synchronous, so an async body committed at its first `await`. This client
  // opens transactions by hand and serialises them against every other
  // statement on the one shared connection — see `sqlite-serialized-client.ts`.
  const sqliteDb = makeSerializedSqliteClient(client, countingLogger)
  // The SQLite client exposes the same portable query-builder surface
  // (select/insert/update/delete/transaction/query/$with/with) the DrizzleDB
  // facade contracts. Postgres-only members (execute, materialized views) are
  // not reachable in SQLite mode — callers route through getPgDb() for those.
  return sqliteDb as unknown as DrizzleDB
}

/**
 * Release the driver handle of a client the memo no longer hands out.
 *
 * The runtime handle is a `bun:sqlite` `Database` (synchronous `close()`) or a
 * `bun:sql` pool (`close()` resolves once the in-flight queries have finished
 * and every connection is ended); both are idempotent. A failure to close is
 * logged and otherwise ignored: the client is already out of the memo, so the
 * caller has nothing left to act on, and the worst outcome is the leak this
 * close exists to prevent.
 */
const closeRetiredClient = (client: DrizzleDB): void => {
  const handle: unknown = client.$client
  Promise.resolve()
    .then(() => (handle instanceof BunSqlite ? handle.close() : client.$client.close()))
    .catch((cause: unknown) =>
      logError(
        '[database] could not close a database client dropped from the cache; its connections may stay open',
        cause
      )
    )
}

/**
 * Whether the request pool (or the SQLite handle) has been built. A check that
 * runs before it — a start's first read — goes through the maintenance slot
 * instead, so the pool is built once, after the runtime-settings probe; a check
 * that runs after it reuses the pool rather than opening a connection beside it.
 */
export const hasBuiltDbClient = (): boolean => cached !== undefined

export const getDb = (): DrizzleDB => {
  if (cached !== undefined && !settingsArrivedSinceBuild() && !budgetChangedSinceBuild()) {
    return cached
  }
  const retired = cached
  cached = buildClient()
  if (retired !== undefined) closeRetiredClient(retired)
  return cached
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
 * (after setting the env var, before the first `db`/`getDb()` access) so the
 * client points at their database, and again in `afterAll` so they don't leave a
 * stale client pointing at a now-deleted temp file for the next test. Production
 * never calls this — the memo is built once at boot and reused.
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
  const retired = cached
  cached = undefined
  if (retired !== undefined) closeRetiredClient(retired)
  builtWithoutSettings = undefined
  builtPoolSize = undefined
  // Keep the Phase 2 sqlite-vec acceleration memo in lock-step: a test that
  // re-points DATABASE_URL / toggles `RAG_SQLITE_VEC` must re-resolve
  // acceleration against the new connection rather than reuse a stale handle.
  resetSqliteVecCache()
}

/**
 * Typed PostgreSQL escape hatch.
 *
 * Returns the `db` client typed as the full PostgreSQL `DrizzleDB`, and throws
 * when the active dialect is SQLite. Use this — not `db` directly — for raw
 * `execute(sql\`…\`)` and any other genuinely Postgres-only operation, so the
 * SQLite-degradation boundary is explicit at the call site.
 *
 * @public Forward-prep: the canonical typed boundary for Postgres-only raw SQL
 * (see the dual-dialect plan). The pre-existing Postgres-only `db.execute(…)`
 * callsites outside the dual-dialect feature scope (FTS, analytics, RAG,
 * bytea storage, MCP tools, GDPR account erasure) are the intended adoption
 * sites — each should migrate to `getPgDb()` so the
 * degradation boundary is explicit. Tracked as a follow-up, not part of this
 * branch's scope. Until then this export has no callers but is deliberately
 * retained as the public seam.
 *
 * @throws {UnsupportedInSqliteError} when the active dialect is SQLite
 */
export const getPgDb = (): DrizzleDB => {
  if (parseDatabaseDialectConfig().dialect !== 'postgres') {
    throw new UnsupportedInSqliteError({
      feature: 'raw-sql',
      message:
        'db.execute / raw SQL requires the PostgreSQL runtime. This operation is not available on the SQLite (zero-config) runtime.',
    })
  }
  return getDb()
}

/** Whether the active runtime is SQLite — read only by the transaction-body guard. */
const isSqliteDialect = (): boolean => parseDatabaseDialectConfig().dialect === 'sqlite'

/**
 * Lazy proxy preserving the eager `db` import API across ~36 static importers.
 * Each property access defers to `getDb()`; subsequent accesses reuse the
 * cached client.
 */
export const db: DrizzleDB = new Proxy({} as DrizzleDB, {
  get: (_target, prop) => {
    // A transaction body reaching the shared client would deadlock on SQLite.
    refuseSharedDbInTransactionBody(isSqliteDialect)
    return Reflect.get(getDb(), prop)
  },
})
