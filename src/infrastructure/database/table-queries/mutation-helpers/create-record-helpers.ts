/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { findConstraintViolation } from '@/domain/errors/driver-failure'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { type DrizzleTransaction } from '@/infrastructure/database'
import { getBaseTableName } from '@/infrastructure/database/lookup/lookup-view-generators'
import { INSERTED_ID_SETTING } from '@/infrastructure/database/lookup/lookup-view-triggers'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { validateColumnName, tableIdentifier } from '../statement/validation'
import { encodeColumnValue } from './column-value-encoding'
import { rowAfterTriggers } from './record-fetch-helpers'

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
 * [internal ref] / a forms spec.
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
  // A value that is `undefined` — a template that rendered nothing as a whole
  // value — is not given: it would bind no parameter at all (`VALUES ($1, )`),
  // so the column takes its default, and a required one refuses the row by name.
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined)
  // No column to write: `insertAndResolveRow` inserts `DEFAULT VALUES`.
  if (entries.length === 0) return { columnsClause: undefined, valuesClause: undefined }

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
 * the view-backed-table write rule(b): Resolve the real row for a view-backed insert.
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
 * Dialect id resolution — whatever the key type, serial, uuid or text:
 *   - PostgreSQL: the PL/pgSQL `INSTEAD OF INSERT` trigger leaves the id of the
 *     base row it inserted in a transaction-local setting
 *     ({@link INSERTED_ID_SETTING}). `lastval()` served a serial key only: a text
 *     key (a scope table's) advances no sequence, and `lastval()` refused.
 *   - SQLite: `last_insert_rowid()` is UNSAFE here — after an `INSTEAD OF` trigger
 *     completes, its value REVERTS to the pre-trigger value (SQLite semantics),
 *     so the trigger's base-INSERT rowid is lost and a stale id (a previous
 *     insert's) is returned. The many-to-many junction-write rule surfaced this: an m2m junction (and the
 *     create response id) got written against the WRONG record on a view-backed
 *     table. Instead, read the id of the `<table>_base` row with the largest
 *     `rowid`: within this write transaction SQLite serializes writers and the
 *     rowid grows, so the just-inserted base row is the last one — for an
 *     integer key the rowid IS the id, and a text key's random value has no
 *     order of its own.
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
      ? sql`SELECT current_setting(${INSERTED_ID_SETTING}, true) AS id`
      : sql`SELECT id FROM ${tableIdentifier(getBaseTableName(tableName))} ORDER BY rowid DESC LIMIT 1`
  const idRows = await executeRaw(tx, idQuery)
  const newId = idRows[0]?.id
  // A custom setting once set in a session reads `''`, not NULL, outside the transaction that set it.
  if (newId === null || newId === undefined || newId === '') return undefined
  const rows = await executeRaw(
    tx,
    sql`SELECT * FROM ${tableIdentifier(tableName)} WHERE id = ${newId} LIMIT 1`
  )
  return rows[0]
}

/**
 * PostgreSQL: the transaction setting the view trigger leaves, returned beside the row.
 *
 * The alias holds a dot, which no stored column name can (a column name is
 * `[a-z0-9_]` only), so it never shadows a field of the table.
 */
const INSERTED_ID_COLUMN = INSERTED_ID_SETTING

/**
 * PostgreSQL: the row a view-backed insert created, read back from the view.
 *
 * The view's `INSTEAD OF INSERT` trigger writes the base row's id into its
 * `NEW` row, so `RETURNING *` carries that id — but every other column as `NEW`
 * held it (a lookup, a rollup, a default: blank). The trigger also left that id
 * in {@link INSERTED_ID_SETTING}, which the INSERT returns as
 * {@link INSERTED_ID_COLUMN}; when it matches the row's id, the row is
 * re-selected by id. A plain table therefore pays no extra query, and one whose
 * id equals a setting an earlier insert of the same transaction left re-selects
 * its own row, which reads the same. No match: `undefined`.
 */
async function rereadViewTriggerRow(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  id: unknown,
  insertedId: unknown
): Promise<Record<string, unknown> | undefined> {
  if (id === null || id === undefined || typeof insertedId !== 'string') return undefined
  if (insertedId !== String(id)) return undefined
  const rows = await executeRaw(
    tx,
    sql`SELECT * FROM ${tableIdentifier(tableName)} WHERE id = ${id} LIMIT 1`
  )
  return rows[0]
}

/**
 * Run the `INSERT ... RETURNING *` and, for view-backed tables, resolve the
 * real row (the view-backed-table write rule(b)): a nullish id through
 * {@link resolveViewBackedInsertRow}, the id the PostgreSQL trigger wrote
 * through {@link rereadViewTriggerRow}.
 */
export async function insertAndResolveRow(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  columnsClause: unknown,
  valuesClause: unknown
): Promise<Readonly<Record<string, unknown>>> {
  // A record carrying nothing but its many-to-many links has no column to
  // write: it is inserted with every column at its default, then linked.
  const insertBody =
    columnsClause === undefined
      ? sql`DEFAULT VALUES`
      : sql`(${columnsClause}) VALUES (${valuesClause})`
  const isPostgres = parseDatabaseDialectConfig().dialect === 'postgres'
  // Evaluated per row after the view's trigger ran, so it reads the id that
  // trigger recorded — or a stale or empty value on a plain table.
  const returning = isPostgres
    ? sql`*, current_setting(${INSERTED_ID_SETTING}, true) AS ${sql.identifier(INSERTED_ID_COLUMN)}`
    : sql`*`
  const insertResult = await executeRaw(
    tx,
    sql`INSERT INTO ${tableIdentifier(tableName)} ${insertBody} RETURNING ${returning}`
  )
  const { [INSERTED_ID_COLUMN]: insertedId, ...raw } = insertResult[0] ?? {}
  // A view-backed insert returns the `id` COLUMN as an explicit null (the view
  // over `<table>_base` selects `id`, the trigger's NEW row leaves it unset) —
  // so the key is PRESENT with a null value. A composite-primary-key table has
  // no `id` column at all, so the key is ABSENT. Only the former needs the
  // real-id resolution; gating on `'id' in raw` (not `raw.id === undefined`)
  // avoids reading the trigger's inserted id / `<table>_base` against a plain
  // composite-key table that has no `_base` companion (SQLite "no such table").
  if ('id' in raw && raw.id === null) {
    const resolved = await resolveViewBackedInsertRow(tx, tableName)
    if (resolved) return resolved
  }
  if (isPostgres && 'id' in raw) {
    const reread = await rereadViewTriggerRow(tx, tableName, raw.id, insertedId)
    if (reread) return reread
  }
  return rowAfterTriggers(tx, tableName, raw)
}
