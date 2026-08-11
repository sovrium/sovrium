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
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite'
import {
  parseDatabaseDialectConfig,
  resolveDatabasePoolMax,
} from '@/domain/models/env/database/database-dialect'
import { primeSqliteVec, resetSqliteVecCache } from '../sql/sqlite-vec-extension'
import { UnsupportedInSqliteError } from '../unsupported-in-sqlite'
import * as schemaPg from './schema'
import * as schemaSqlite from './schema-sqlite'

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
 *   - `sqlite` — `drizzle-orm/bun-sqlite` over a `bun:sqlite` `Database`. Selected
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
 * In SQLite mode the runtime object is a `drizzle-orm/bun-sqlite` client. Its
 * query-builder surface is structurally compatible for the portable subset
 * (`select` / `insert` / `update` / `delete` / `transaction` / `query` / `$with`
 * / `with`), so it is cast to `DrizzleDB` at the seam inside `getDb()`. The two
 * genuinely Postgres-only members are raw `execute()` and the materialized-view
 * helper; SQLite callers must not reach them. New code that requires guaranteed
 * Postgres semantics uses `getPgDb()` (below), which throws on SQLite.
 */
export type DrizzleDB = ReturnType<typeof drizzlePg<typeof schemaPg>>

/** Concrete SQLite client type — kept internal to this module. */
type SqliteDrizzleDB = ReturnType<typeof drizzleSqlite<typeof schemaSqlite>>

// eslint-disable-next-line functional/no-let, functional/prefer-immutable-types -- one-shot module-level memo cache; replaces the eager const that crashed at boot when DATABASE_URL was unset
let cached: DrizzleDB | undefined

/**
 * Build the dialect-appropriate Drizzle client.
 *
 * The SQLite branch opens the `bun:sqlite` database (creating the file if it
 * does not exist), applies the standard production PRAGMAs, then wraps it with
 * the `bun-sqlite` Drizzle driver. The resulting client is cast to the
 * `DrizzleDB` facade — the query-builder surface used by every `db` consumer is
 * structurally compatible across the two dialects.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- DrizzleDB is the upstream-mutable drizzle-orm/bun-sql return shape; same rationale as getDb
const buildClient = (): DrizzleDB => {
  const config = parseDatabaseDialectConfig()

  if (config.dialect === 'postgres') {
    // `max` is passed EXPLICITLY rather than left to bun:sql's implicit default,
    // so the pool size the application budgets its concurrent fan-outs against
    // is a stated number (see `resolveDatabasePoolMax`) instead of an assumption
    // about the driver — and so an operator on a larger Postgres can raise it
    // via `DATABASE_POOL_MAX` without patching code.
    return drizzlePg({
      connection: { url: config.databaseUrl, max: resolveDatabasePoolMax() },
      schema: schemaPg,
    })
  }

  // SQLite — open the file (create on first boot), then harden the connection.
  // Create the parent dir first; `{ create: true }` makes the file but not its
  // directory, and the zero-config default now nests under `./.sovrium/`. Skip
  // the in-memory sentinel (no filesystem path).
  if (config.path !== ':memory:') {
    // eslint-disable-next-line functional/no-expression-statements -- filesystem prep before the synchronous driver open
    mkdirSync(dirname(config.path), { recursive: true })
  }
  // Phase 2 RAG acceleration: when `RAG_SQLITE_VEC=on`, open the
  // sqlite-vec accelerated connection FIRST. `Database.setCustomSQLite` (needed
  // on macOS for native extension loading) is process-global + one-shot and must
  // run before any other `Database` opens — so this runs ahead of the primary
  // client below. No-op when acceleration is off / unavailable (frugal default).

  primeSqliteVec(config.path)
  const client = new BunSqlite(config.path, { create: true })
  // eslint-disable-next-line functional/no-expression-statements -- driver-level connection setup; bun:sqlite exec returns void
  client.exec('PRAGMA foreign_keys = ON')
  // eslint-disable-next-line functional/no-expression-statements -- WAL journaling for concurrent readers; required for the spawned-server + in-fixture connection pattern
  client.exec('PRAGMA journal_mode = WAL')
  // eslint-disable-next-line functional/no-expression-statements -- 5s lock wait before SQLITE_BUSY, matching the test-harness restart pattern
  client.exec('PRAGMA busy_timeout = 5000')

  // eslint-disable-next-line functional/prefer-immutable-types -- upstream-mutable drizzle-orm/bun-sqlite return shape; same rationale as getDb
  const sqliteDb: SqliteDrizzleDB = drizzleSqlite({ client, schema: schemaSqlite })
  // The bun-sqlite client exposes the same portable query-builder surface
  // (select/insert/update/delete/transaction/query/$with/with) the DrizzleDB
  // facade contracts. Postgres-only members (execute, materialized views) are
  // not reachable in SQLite mode — callers route through getPgDb() for those.
  return sqliteDb as unknown as DrizzleDB
}

// eslint-disable-next-line functional/prefer-immutable-types -- DrizzleDB is the upstream return shape from drizzle-orm/bun-sql; the lint rule cannot prove our consumers don't mutate it. We don't.
export const getDb = (): DrizzleDB => {
  if (cached !== undefined) return cached
  // eslint-disable-next-line functional/no-expression-statements -- module-level memo cache assignment
  cached = buildClient()
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
 * @internal Test-isolation hook for the module-level memo.
 */
export const resetDbCache = (): void => {
  // eslint-disable-next-line functional/no-expression-statements -- module-level memo reset; intentional mutation of the one-shot cache
  cached = undefined
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
// eslint-disable-next-line functional/prefer-immutable-types -- returns the upstream-mutable DrizzleDB; same rationale as getDb
export const getPgDb = (): DrizzleDB => {
  if (parseDatabaseDialectConfig().dialect !== 'postgres') {
    // eslint-disable-next-line functional/no-throw-statements -- explicit degradation boundary: raw SQL is unavailable on the SQLite runtime
    throw new UnsupportedInSqliteError({
      feature: 'raw-sql',
      message:
        'db.execute / raw SQL requires the PostgreSQL runtime. This operation is not available on the SQLite (zero-config) runtime.',
    })
  }
  return getDb()
}

/**
 * Lazy proxy preserving the eager `db` import API across ~36 static importers.
 * Each property access defers to `getDb()`; subsequent accesses reuse the
 * cached client.
 */
// eslint-disable-next-line functional/prefer-immutable-types -- DrizzleDB is upstream-mutable (Proxy<DrizzleDB> for the same reason as getDb's return)
export const db: DrizzleDB = new Proxy({} as DrizzleDB, {
  get: (_target, prop) => Reflect.get(getDb(), prop),
})
