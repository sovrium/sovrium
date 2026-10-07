/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { recordDbRowsReturned } from '@/infrastructure/telemetry/db-query-counter'
import { extractRows } from './sql-utils'
import type { SQL } from 'drizzle-orm'

/**
 * Dialect-aware raw-SQL executor for the dynamic records/forms CRUD layer.
 *
 * Why this helper exists
 * ----------------------
 * Sovrium's user-defined tables are created at runtime, so the records-CRUD
 * layer hand-writes raw SQL via Drizzle's `sql` template and ran it through
 * `tx.execute()`. `tx.execute()` is a method of the PostgreSQL Drizzle client
 * (`drizzle-orm/bun-sql`) **only** — the SQLite client (`drizzle-orm/bun-sqlite`)
 * has no `.execute()`; it exposes `.run()` / `.all()` / `.get()` / `.values()`.
 *
 * Routing every CRUD `.execute()` callsite through `executeRaw` makes the
 * dynamic SQL layer dialect-agnostic:
 *
 *   - **PostgreSQL** — `.execute(query)`. `bun-sql` returns the rows array
 *     directly.
 *   - **SQLite** — `.all(query)`. `bun-sqlite` returns the rows array directly
 *     for any statement, including `RETURNING` clauses (SQLite ≥ 3.35, which
 *     Bun ships). Non-row statements simply yield `[]`.
 *
 * Both arms are normalized to a plain `Record<string, unknown>[]` via
 * `extractRows`, so callers get one stable shape regardless of dialect.
 *
 * The runner object passed in is either the `db` facade or a `tx` transaction
 * handle. It is typed structurally — the only requirement is that it carries
 * *either* an `execute` *or* an `all` method — so this helper works with both
 * the Postgres and SQLite Drizzle clients without importing their concrete
 * types (which would re-introduce the coupling this helper removes).
 */

/**
 * Minimal structural shape of a Drizzle client / transaction handle that
 * `executeRaw` can drive. A Postgres handle carries `execute`; a SQLite handle
 * carries `all`. Both are optional here because the concrete handle only ever
 * has one of them; `executeRaw` picks whichever the active dialect needs.
 */
export interface RawSqlRunner {
  readonly execute?: (query: Readonly<SQL>) => Promise<unknown> | unknown
  readonly all?: (query: Readonly<SQL>) => Promise<unknown> | unknown
}

/** Report a result's length to the per-request row count, then hand it on. */
const counted = (
  rows: ReadonlyArray<Record<string, unknown>>
): ReadonlyArray<Record<string, unknown>> => {
  recordDbRowsReturned(rows.length)
  return rows
}

/**
 * Execute a raw Drizzle `sql` query against either dialect and return a
 * normalized rows array.
 *
 * Every result's length is reported to the per-request row count
 * (`X-Sovrium-Db-Rows`), which is how a read that loads a whole table is told
 * apart from one that reads a page: both cost one statement.
 *
 * @param runner - the `db` facade or a `tx` transaction handle
 * @param query  - a Drizzle `sql` template query
 * @returns the result rows as a plain `Record<string, unknown>[]`
 */
export const executeRaw = async (
  runner: Readonly<RawSqlRunner>,
  query: Readonly<SQL>
): Promise<ReadonlyArray<Record<string, unknown>>> => {
  const { dialect } = parseDatabaseDialectConfig()

  if (dialect === 'postgres') {
    if (typeof runner.execute !== 'function') {
      throw new TypeError('executeRaw: PostgreSQL runner is missing an execute() method')
    }
    return counted(extractRows(await runner.execute(query)))
  }

  // SQLite — bun-sqlite exposes .all() (row-returning) for every statement,
  // including RETURNING clauses. There is no .execute().
  if (typeof runner.all !== 'function') {
    throw new TypeError('executeRaw: SQLite runner is missing an all() method')
  }
  return counted(extractRows(await runner.all(query)))
}

/**
 * Typed variant of {@link executeRaw}. Centralizes the single `as` cast that
 * the per-callsite result typing requires, mirroring the now-superseded
 * `typedExecute` helper.
 *
 * @param runner - the `db` facade or a `tx` transaction handle
 * @param query  - a Drizzle `sql` template query
 * @returns the result rows typed as `readonly T[]`
 */
export const executeRawTyped = async <T = Record<string, unknown>>(
  runner: Readonly<RawSqlRunner>,
  query: Readonly<SQL>
): Promise<readonly T[]> => (await executeRaw(runner, query)) as readonly T[]
