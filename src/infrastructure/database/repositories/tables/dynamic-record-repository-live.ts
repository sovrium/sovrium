/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Dynamic-Record Repository Implementation.
 *
 * Runs the AI chat read-query and record-mutation SQL — relocated **verbatim**
 * from `chat-query.ts` / `chat-mutation.ts`. The SQL here is a literal
 * extraction of the chat routes' prior `db.execute(sql`…`)` statements:
 *
 *  - `SELECT COUNT(*)::int AS count` (optionally `WHERE col = value`);
 *  - `SELECT AVG|SUM(col)::float AS value` (optionally `WHERE col = value`);
 *  - `SELECT * … [ORDER BY col DESC] LIMIT n`;
 *  - `INSERT INTO t (cols) VALUES (vals) RETURNING id` / `DEFAULT VALUES`;
 *  - `UPDATE t SET … WHERE id = … RETURNING id` / table-wide;
 *  - `DELETE FROM t [WHERE col = value] RETURNING id`.
 *
 * Column names bind via `sql.identifier()`; every value is a bound parameter.
 * `WHERE col = value` fragments come from `generateSqlConditionFragment` with
 * the `equals` operator — a parameterised `${col} = ${value}` fragment,
 * byte-identical to the routes' inline `WHERE` clause.
 *
 * This implementation deliberately does NOT call `table-queries/crud/`: no
 * activity-logging, no `created_by`/`updated_by`/`deleted_by` stamping, no
 * soft-delete filtering, no cascade. The behavior contract is "exactly what
 * the chat routes did before."
 *
 * DIALECT NOTE: every statement runs through `executeRawTyped`, NOT
 * `db.execute()`. `.execute()` is a method of the PostgreSQL client only — the
 * SQLite client (`drizzle-orm/bun-sqlite`) exposes `.run()`/`.all()`/`.get()`/
 * `.values()` instead. The extraction inherited `db.execute()` verbatim from the
 * chat routes, so on SQLite every one of these calls threw, `makeDbWrap` turned
 * it into a `DynamicRecordError`, and `POST /api/ai/chat` answered 500 — the
 * assistant could not answer a single question touching a table on the
 * ZERO-CONFIG DEFAULT engine. (Same defect class as the `tables-overview`
 * undercount, but LOUD rather than silent: there is no `catch → 0` guard here
 * to swallow it.)
 *
 * The SQL itself was already portable — `countAsIntSelectClause()` /
 * `castToFloat()` emit per-dialect casts, `DEFAULT VALUES` is valid in both
 * engines, and `RETURNING` works on SQLite >= 3.35 (which Bun ships) — so the
 * driver call was the only dialect-bound part.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  DynamicRecordError,
  DynamicRecordRepository,
  type DynamicRecordCondition,
  type DynamicRecordFilter,
} from '@/application/ports/repositories/tables/dynamic-record-repository'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { db } from '@/infrastructure/database'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'
import { generateSqlConditionFragment } from '@/infrastructure/database/table-queries/filter-operators'
import {
  castToFloat,
  countAsIntSelectClause,
} from '@/infrastructure/database/table-queries/query-helpers/aggregation-helpers'

/** Wrap a DB promise, adapting failures to DynamicRecordError. */
const wrap = makeDbWrap((cause) => new DynamicRecordError({ cause }))

/**
 * Build the optional ` WHERE column = value` fragment — a parameterised
 * `equals` condition, byte-identical to the chat routes' inline `whereClause`.
 */
const whereClause = (filter: DynamicRecordFilter | undefined) =>
  filter === undefined
    ? sql``
    : sql` WHERE ${generateSqlConditionFragment(filter.column, 'equals', filter.value)}`

/**
 * Build a ` WHERE <cond> AND <cond> …` fragment from a multi-condition list
 * (the AI structured-query path). Each condition is rendered through
 * `generateSqlConditionFragment` so identifiers go through `sql.identifier` and
 * every value is bound. An empty / undefined list yields no clause.
 *
 * When BOTH a single `filter` and `conditions` are present they AND together,
 * but the structured-query path uses only `conditions`.
 */
const conditionsClause = (
  filter: DynamicRecordFilter | undefined,
  conditions: ReadonlyArray<DynamicRecordCondition> | undefined
) => {
  const filterFragment =
    filter === undefined
      ? undefined
      : generateSqlConditionFragment(filter.column, 'equals', filter.value)
  const conditionFragments = (conditions ?? []).map((c) =>
    generateSqlConditionFragment(c.column, c.operator, c.value)
  )
  const all = [...(filterFragment ? [filterFragment] : []), ...conditionFragments]
  if (all.length === 0) return sql``
  return sql` WHERE ${sql.join(all, sql` AND `)}`
}

/**
 * Build the SELECT column list. An explicit projection lists each validated
 * column via `sql.identifier`; omitting it falls back to `*`.
 */
const selectClause = (columns: ReadonlyArray<string> | undefined) =>
  columns === undefined || columns.length === 0
    ? sql`*`
    : sql.join(
        columns.map((column) => sql.identifier(column)),
        sql`, `
      )

/**
 * Dynamic-Record Repository Implementation.
 *
 * Every method issues raw parameterised SQL against the `public`-schema table
 * the engine created from `app.tables[]`.
 */
export const DynamicRecordRepositoryLive = Layer.succeed(DynamicRecordRepository, {
  count: (input) =>
    wrap(async () => {
      const query = sql`SELECT ${countAsIntSelectClause()} AS count FROM ${sql.identifier(
        input.table
      )}${conditionsClause(input.filter, input.conditions)}`
      const result = await executeRawTyped<{ readonly count: number }>(db, query)
      return toFiniteCount(result[0]?.count)
    }),

  aggregate: (input) =>
    wrap(async () => {
      const aggExpr =
        input.fn === 'AVG'
          ? castToFloat(sql`AVG(${sql.identifier(input.column)})`)
          : castToFloat(sql`SUM(${sql.identifier(input.column)})`)
      const query = sql`SELECT ${aggExpr} AS value FROM ${sql.identifier(
        input.table
      )}${whereClause(input.filter)}`
      const result = await executeRawTyped<{ readonly value: number | null }>(db, query)
      const value = result[0]?.value
      return value === null || value === undefined ? undefined : Number(value)
    }),

  list: (input) =>
    wrap(async () => {
      const orderBy =
        input.sortColumn !== undefined
          ? sql` ORDER BY ${sql.identifier(input.sortColumn)} ${sql.raw(
              input.sortDirection === 'asc' ? 'ASC' : 'DESC'
            )}`
          : sql``
      const query = sql`SELECT ${selectClause(input.columns)} FROM ${sql.identifier(
        input.table
      )}${conditionsClause(input.filter, input.conditions)}${orderBy} LIMIT ${input.limit}`
      return await executeRawTyped<Record<string, unknown>>(db, query)
    }),

  insert: (input) =>
    wrap(async () => {
      const entries = Object.entries(input.data)
      // An empty payload inserts a row with all-default column values — every
      // engine-created column is nullable, so `DEFAULT VALUES` is valid SQL.
      const query =
        entries.length === 0
          ? sql`INSERT INTO ${sql.identifier(input.table)} DEFAULT VALUES RETURNING id`
          : sql`INSERT INTO ${sql.identifier(input.table)} (${sql.join(
              entries.map(([key]) => sql.identifier(key)),
              sql`, `
            )}) VALUES (${sql.join(
              entries.map(([, value]) => sql`${value}`),
              sql`, `
            )}) RETURNING id`
      const result = await executeRawTyped<{ readonly id: number | string }>(db, query)
      return result[0]?.id ?? 0
    }),

  updateById: (input) =>
    wrap(async () => {
      const assignments = sql.join(
        Object.entries(input.data).map(([key, value]) => sql`${sql.identifier(key)} = ${value}`),
        sql`, `
      )
      const result = await executeRawTyped<{ readonly id: number }>(
        db,
        sql`UPDATE ${sql.identifier(
          input.table
        )} SET ${assignments} WHERE id = ${input.recordId} RETURNING id`
      )
      return result.length > 0
    }),

  updateAll: (input) =>
    wrap(async () => {
      const assignments = sql.join(
        Object.entries(input.data).map(([key, value]) => sql`${sql.identifier(key)} = ${value}`),
        sql`, `
      )
      const result = await executeRawTyped<{ readonly id: number }>(
        db,
        sql`UPDATE ${sql.identifier(input.table)} SET ${assignments} RETURNING id`
      )
      return result.map((row) => row.id)
    }),

  delete: (input) =>
    wrap(async () => {
      const query =
        input.filter === undefined
          ? sql`DELETE FROM ${sql.identifier(input.table)} RETURNING id`
          : sql`DELETE FROM ${sql.identifier(input.table)}${whereClause(input.filter)} RETURNING id`
      const result = await executeRawTyped<{ readonly id: number }>(db, query)
      return result.map((row) => row.id)
    }),
})
