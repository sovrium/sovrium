/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Live implementation of `StorageFootprintRepository`.
 *
 * QUERY BUDGET
 * ------------
 * Two statements per reading, INDEPENDENT of the table count: one catalog
 * query that sizes every table at once, and one whole-database total. SQLite
 * adds a third — the `dbstat` availability probe — exactly ONCE per process
 * (memoized below).
 *
 * This is deliberately the opposite shape from
 * `tables-overview-repository-live.ts`, whose whole architecture is a bounded
 * per-table fan-out. See the port's doc comment for why the two cost models do
 * not belong in one repository.
 *
 * DIALECT
 * -------
 *   - **PostgreSQL** — `pg_total_relation_size(c.oid)` over `pg_class` joined
 *     to `pg_namespace`, restricted to `nspname = 'public'` and
 *     `relkind = 'r'`. That figure includes the heap, its TOAST relation, and
 *     every index — i.e. what the table actually costs on disk.
 *   - **SQLite** — `dbstat`, a virtual table that reports the page size of
 *     every b-tree. Summing `pgsize` per `sqlite_master.tbl_name` (over both
 *     `'table'` and `'index'` rows) is the SQLite analogue of
 *     `pg_total_relation_size`: table pages plus the pages of every index that
 *     belongs to it.
 *
 * `dbstat` IS NOT GUARANTEED TO EXIST
 * ----------------------------------
 * It is a compile-time option (`SQLITE_ENABLE_DBSTAT_VTAB`). Bun's bundled
 * SQLite (3.51.0) ships it, but `Database.setCustomSQLite()` lets an operator
 * point Bun at a different libsqlite — so the table can genuinely be absent at
 * runtime. Assuming it exists would surface as a per-table `0`, i.e. the exact
 * fabricated-number defect this repository was written to remove. So we PROBE,
 * once, and fall back to `bytes: null` / `measurement: 'unavailable'`.
 *
 * DIALECT NOTE: every read below goes through `executeRawTyped`, NOT
 * `db.execute()`. `execute()` is a PostgreSQL-client method — the SQLite client
 * (`drizzle-orm/bun-sqlite`) has no `.execute()`, only `.run()`/`.all()`/
 * `.get()`. Reaching for it here would have reproduced the `records.total`
 * bug documented in `tables-overview-repository-live.ts`: a `TypeError` caught
 * by a degradation guard, every row silently zeroed, on the DEFAULT engine.
 */

import { sql } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  StorageFootprintError,
  StorageFootprintRepository,
  type DatabaseFootprint,
  type TableSizeRow,
} from '@/application/ports/repositories/footprint/storage-footprint-repository'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { db } from '@/infrastructure/database'
import { executeRawTyped, type RawSqlRunner } from '@/infrastructure/database/sql/dialect-execute'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/** Projection shared by both dialects' catalog queries. */
interface CatalogSizeRow {
  readonly table_name: string | null
  readonly bytes: number | string | null
}

/** Projection of the single-scalar whole-database total. */
interface TotalBytesRow {
  readonly bytes: number | string | null
}

/**
 * A table whose size could not be established — the sizing probe was
 * unavailable, or the relation is not in the catalog at all.
 *
 * `null`, never `0`: `0` is reserved for "the probe ran and the relation is
 * empty". Conflating them is what made the previous panel unreadable.
 */
const unmeasuredTable = (tableName: string): TableSizeRow => ({
  tableName,
  // eslint-disable-next-line unicorn/no-null -- `null` is the port's "not measured" sentinel, deliberately distinct from a measured `0`
  bytes: null,
  measurement: 'unavailable',
})

/**
 * Process-level memo for the `dbstat` availability probe.
 *
 * `undefined` = not yet probed. The answer is a property of the linked SQLite
 * build, which cannot change while the process lives, so one probe per process
 * is both sufficient and the cheapest correct cadence — re-probing on every
 * dashboard request would add a statement to answer a constant.
 */
// eslint-disable-next-line functional/no-let -- one-shot process-level memo; mirrors the `cached` client memo in drizzle/db-bun.ts
let dbstatAvailable: boolean | undefined

/**
 * Drop the memoized `dbstat` probe result.
 *
 * The memo is module-level state shared by every importer in a Bun test
 * process, so a test that exercises the probe-failure path would otherwise
 * poison the success-path test that runs after it (the same process-global
 * contamination class `resetDbCache` exists for). Production never calls this.
 *
 * @internal Test-isolation hook for the module-level memo.
 */
export const resetDbstatProbeCache = (): void => {
  // eslint-disable-next-line functional/no-expression-statements -- module-level memo reset; intentional mutation of the one-shot cache
  dbstatAvailable = undefined
}

/**
 * Whether this SQLite build exposes the `dbstat` virtual table.
 *
 * Probed with the cheapest possible statement (`LIMIT 1`, one column) and
 * memoized. A build without `SQLITE_ENABLE_DBSTAT_VTAB` raises
 * `no such table: dbstat`, which lands in the `catch`.
 */
const probeDbstat = async (runner: Readonly<RawSqlRunner>): Promise<boolean> => {
  if (dbstatAvailable !== undefined) return dbstatAvailable
  const available = await executeRawTyped(runner, sql`SELECT 1 AS ok FROM dbstat LIMIT 1`)
    .then(() => true)
    .catch(() => false)
  // eslint-disable-next-line functional/no-expression-statements -- module-level memo write
  dbstatAvailable = available
  return available
}

/**
 * Size every regular table of the `public` schema in ONE statement.
 *
 * `pg_total_relation_size` counts heap + TOAST + indexes, which is the figure
 * an operator means by "how much does this table cost".
 */
const readPostgresCatalog = (runner: Readonly<RawSqlRunner>): Promise<readonly CatalogSizeRow[]> =>
  executeRawTyped<CatalogSizeRow>(
    runner,
    sql`SELECT c.relname AS table_name, pg_total_relation_size(c.oid) AS bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'`
  )

/**
 * Size every table of the SQLite database in ONE statement.
 *
 * `dbstat` reports one row per b-tree PAGE GROUP keyed by object name, so the
 * join to `sqlite_master` maps each index back onto its owning table via
 * `tbl_name` — summing table pages and index pages together, matching what
 * `pg_total_relation_size` counts on the other engine.
 */
const readSqliteCatalog = (runner: Readonly<RawSqlRunner>): Promise<readonly CatalogSizeRow[]> =>
  executeRawTyped<CatalogSizeRow>(
    runner,
    sql`SELECT m.tbl_name AS table_name, SUM(d.pgsize) AS bytes
        FROM dbstat d
        JOIN sqlite_master m ON m.name = d.name
        WHERE m.type IN ('table', 'index')
        GROUP BY m.tbl_name`
  )

/**
 * Whole-database size in bytes.
 *
 * Sourced from a primitive that stays available even when per-table sizing
 * does not, so the panel can always report a scoped database total:
 *   - PostgreSQL — `pg_database_size(current_database())`.
 *   - SQLite — `page_count × page_size`, i.e. the on-disk file size including
 *     the freelist. Deliberately NOT `SUM(pgsize) FROM dbstat`, which would
 *     make the total inherit the probe's availability.
 */
const readTotalBytes = async (
  runner: Readonly<RawSqlRunner>,
  dialect: DatabaseDialect
): Promise<number> => {
  const rows =
    dialect === 'postgres'
      ? await executeRawTyped<TotalBytesRow>(
          runner,
          sql`SELECT pg_database_size(current_database()) AS bytes`
        )
      : await executeRawTyped<TotalBytesRow>(
          runner,
          sql`SELECT (SELECT * FROM pragma_page_count()) * (SELECT * FROM pragma_page_size()) AS bytes`
        )
  return toFiniteCount(rows[0]?.bytes)
}

/**
 * Map the catalog reading onto the REQUESTED table names, preserving input
 * order.
 *
 * A requested name the catalog does not carry is `unavailable`, not `0`: the
 * relation does not exist, so nothing about its size was measured.
 */
const projectCatalog = (
  tableNames: ReadonlyArray<string>,
  catalog: ReadonlyArray<CatalogSizeRow>,
  measurement: 'pg_total_relation_size' | 'sqlite_dbstat'
): readonly TableSizeRow[] => {
  const sizes = new Map(
    catalog
      .filter((row) => typeof row.table_name === 'string')
      .map((row) => [String(row.table_name), toFiniteCount(row.bytes)] as const)
  )
  return tableNames.map((tableName) => {
    const bytes = sizes.get(tableName)
    return bytes === undefined ? unmeasuredTable(tableName) : { tableName, bytes, measurement }
  })
}

/** Per-table sizes for the active dialect; every failure degrades to `unavailable`. */
const readTableSizes = async (
  runner: Readonly<RawSqlRunner>,
  tableNames: ReadonlyArray<string>,
  dialect: DatabaseDialect
): Promise<readonly TableSizeRow[]> => {
  const unavailable = (): readonly TableSizeRow[] => tableNames.map(unmeasuredTable)
  try {
    if (dialect === 'postgres') {
      return projectCatalog(tableNames, await readPostgresCatalog(runner), 'pg_total_relation_size')
    }
    // SQLite — no `dbstat` in this build means no per-table attribution at all.
    if (!(await probeDbstat(runner))) return unavailable()
    return projectCatalog(tableNames, await readSqliteCatalog(runner), 'sqlite_dbstat')
  } catch {
    return unavailable()
  }
}

/**
 * Read the database footprint through an explicit runner.
 *
 * The runner is a parameter rather than the module-level `db` so the SQLite
 * arm — which the Postgres-defaulting E2E suite never reaches — is unit
 * testable against a real temp-file database AND against a stub that simulates
 * a `dbstat`-less build.
 *
 * @param runner - the `db` facade or a transaction handle
 * @param tableNames - configured (sanitized) table names
 */
export const readDatabaseFootprint = async (
  runner: Readonly<RawSqlRunner>,
  tableNames: ReadonlyArray<string>
): Promise<DatabaseFootprint> => {
  const { dialect } = parseDatabaseDialectConfig()
  const totalBytes = await readTotalBytes(runner, dialect).catch(() => 0)
  return { tables: await readTableSizes(runner, tableNames, dialect), totalBytes }
}

/**
 * Live layer providing the storage-footprint repository.
 *
 * Two statements per reading regardless of table count — see the QUERY BUDGET
 * note at the top of this file.
 */
export const StorageFootprintRepositoryLive = Layer.succeed(StorageFootprintRepository, {
  measureDatabaseFootprint: (tableNames) =>
    Effect.tryPromise({
      try: () => readDatabaseFootprint(db, tableNames),
      catch: (cause) => new StorageFootprintError({ cause }),
    }),
})
