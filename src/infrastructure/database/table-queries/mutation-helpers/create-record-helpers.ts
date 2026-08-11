/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { findConstraintViolation } from '@/domain/errors/driver-failure'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import { type DrizzleTransaction } from '@/infrastructure/database'
import { getBaseTableName } from '@/infrastructure/database/lookup/lookup-view-generators'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { validateColumnName } from '../shared/validation'
import { encodeColumnValue } from './column-value-encoding'

/**
 * Check if an error is a uniqueness conflict, on EITHER dialect.
 *
 * Delegates to the single dialect-aware classifier
 * ({@link findConstraintViolation}) instead of re-deriving driver markers
 * here. The previous local heuristic was PostgreSQL-shaped and wrong in both
 * directions: it matched `!!error.constraint`, which Postgres also sets for
 * CHECK and FK violations (so a CHECK failure was reported as "Resource
 * already exists"), and its only dialect-neutral test was a case-SENSITIVE
 * `message.includes('unique constraint')`, which never matches SQLite's
 * upper-case `UNIQUE constraint failed: …` (so a genuine conflict on the
 * zero-config default engine fell through to a 500).
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  return findConstraintViolation(error) === 'unique'
}

/**
 * Check if an error is a foreign-key violation, on EITHER dialect.
 *
 * Matched on the driver's own result code — Postgres SQLSTATE `23503`, SQLite
 * `SQLITE_CONSTRAINT_FOREIGNKEY` — both measured, rather than on wire text.
 *
 * Bug 3 / [internal ref].
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return findConstraintViolation(error) === 'foreign-key'
}

/**
 * Build SQL columns and values for INSERT query.
 *
 * `arrayColumnTypes` maps array-shaped column names to their PostgreSQL data
 * types as reported by `information_schema.columns`; resolve it with
 * `resolveArrayColumnTypes`. Per-value encoding is {@link encodeColumnValue}'s
 * decision — the same one the UPDATE builder makes, written once, because two
 * independent copies of it drifted into the same silent-wrong-data defect on
 * both write paths.
 *
 * It is REQUIRED rather than optional, for the same reason it is required on
 * `buildUpdateSetClauseCRUD`: when the UPDATE side was optional, two of its
 * three callers simply never passed it and every `PATCH` of a `multi-select`
 * answered 500 on PostgreSQL, with nothing in the type system asking them to.
 * Every INSERT caller already resolves the map, so requiring it costs nothing
 * today and turns the next forgetful caller from a runtime failure into a
 * compile error. A caller that genuinely has no column introspection passes
 * `{}` and says so; forgetting is not spellable.
 *
 * An absent ENTRY still means the JSONB-for-everything fallback, which is the
 * safe default: a JSONB literal written to a genuine array column fails loudly,
 * whereas guessing `text[]` for a JSONB column would silently corrupt data.
 */
export function buildInsertClauses(
  fields: Readonly<Record<string, unknown>>,
  arrayColumnTypes: Readonly<Record<string, string>>
): Readonly<{ columnsClause: unknown; valuesClause: unknown }> {
  const entries = Object.entries(fields)

  // Build column identifiers and values
  const columnIdentifiers = entries.map(([key]) => {
    validateColumnName(key)
    return sql.identifier(key)
  })
  const valueParams = entries.map(([key, value]) => encodeColumnValue(value, arrayColumnTypes[key]))

  // Build INSERT query using sql.join for columns and values
  const columnsClause = sql.join(columnIdentifiers, sql.raw(', '))
  const valuesClause = sql.join(valueParams, sql.raw(', '))

  return { columnsClause, valuesClause }
}

/**
 * [internal ref](b): Resolve the real row for a view-backed insert.
 *
 * A table carrying a rollup / lookup / count field is materialized as a VIEW
 * over `<table>_base` with an `INSTEAD OF INSERT` trigger. `RETURNING *` on the
 * view yields the trigger's `NEW` row, whose auto/computed columns never
 * materialize — the primary key comes back NULL and any DB-side default
 * (created-at) / rollup is absent. That makes create return `id: "null"`,
 * breaks navigate-after-create, and dispatches the record-create automation
 * event with a bogus id.
 *
 * When the returned `id` is nullish we treat the insert as view-backed: read
 * the id the trigger's base INSERT just generated and re-select the full row
 * from the view so create returns the same shape a plain table would (real id,
 * stamped defaults, computed columns).
 *
 * Dialect id resolution:
 *   - PostgreSQL: `lastval()` returns the last sequence value advanced in this
 *     session. A PL/pgSQL `INSTEAD OF INSERT` trigger's base INSERT advances the
 *     base table's identity sequence persistently, so `lastval()` is correct.
 *   - SQLite: `last_insert_rowid()` is UNSAFE here — after an `INSTEAD OF` trigger
 *     completes, its value REVERTS to the pre-trigger value (SQLite semantics),
 *     so the trigger's base-INSERT rowid is lost and a stale id (a previous
 * insert's) is returned. [internal ref] surfaced this: an m2m junction (and the
 *     create response id) got written against the WRONG record on a view-backed
 *     table. Instead, read `MAX(id)` of the `<table>_base` table: within this
 *     write transaction SQLite serializes writers and the id auto-increments, so
 *     the just-inserted base row always carries the table's MAX(id).
 *
 * Returns `undefined` when the id cannot be resolved so the caller falls back
 * to the raw `RETURNING *` row (no regression for the plain-table path, which
 * never has a nullish id).
 */
async function resolveViewBackedInsertRow(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<Record<string, unknown> | undefined> {
  const { dialect } = parseDatabaseDialectConfig()
  const idQuery =
    dialect === 'postgres'
      ? sql`SELECT lastval() AS id`
      : sql`SELECT MAX(id) AS id FROM ${sql.identifier(getBaseTableName(tableName))}`
  const idRows = await executeRaw(tx, idQuery)
  const newId = idRows[0]?.id
  if (newId === null || newId === undefined) return undefined
  const rows = await executeRaw(
    tx,
    sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id = ${newId} LIMIT 1`
  )
  return rows[0]
}

/**
 * Run the `INSERT ... RETURNING *` and, for view-backed tables (nullish id),
 * resolve the real row ([internal ref](b) via {@link resolveViewBackedInsertRow}).
 */
export async function insertAndResolveRow(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  columnsClause: unknown,
  valuesClause: unknown
): Promise<Readonly<Record<string, unknown>>> {
  const insertResult = await executeRaw(
    tx,
    sql`INSERT INTO ${sql.identifier(tableName)} (${columnsClause}) VALUES (${valuesClause}) RETURNING *`
  )
  const raw = insertResult[0] ?? {}
  // A view-backed insert returns the `id` COLUMN as an explicit null (the view
  // over `<table>_base` selects `id`, the trigger's NEW row leaves it unset) —
  // so the key is PRESENT with a null value. A composite-primary-key table has
  // no `id` column at all, so the key is ABSENT. Only the former needs the
  // real-id resolution; gating on `'id' in raw` (not `raw.id === undefined`)
  // avoids running `lastval()` / `MAX(id) FROM <table>_base` against a plain
  // composite-key table that has neither a sequence nor a `_base` companion
  // (Postgres 55000 "lastval is not yet defined", SQLite "no such table").
  if ('id' in raw && raw.id === null) {
    const resolved = await resolveViewBackedInsertRow(tx, tableName)
    if (resolved) return resolved
  }
  return raw
}
