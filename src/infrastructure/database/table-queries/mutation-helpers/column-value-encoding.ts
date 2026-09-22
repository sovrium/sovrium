/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { type DrizzleTransaction } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { jsonbLiteral, pgTextArrayLiteral } from '@/infrastructure/database/sql/sql-utils'
import { validateColumnName, validateTableName } from '../statement/validation'

/**
 * How a JS value becomes the SQL that stores it — the single answer shared by
 * every write path.
 *
 * This module exists because the question was answered separately in two
 * places and both answers were wrong in the same way. INSERT and UPDATE each
 * bound an array with a plain `sql\`${value}\``, which drizzle expands into a
 * SQL ROW CONSTRUCTOR: `['a','b']` became `($1, $2)`. The failure was therefore
 * arity-dependent rather than type-dependent — two or more elements raised a
 * row-constructor error, while a ONE-element array bound to `($1)`, legal
 * scalar syntax, so the write answered success having stored the bare scalar
 * where the array belonged. Each path was then fixed on its own, leaving two
 * copies of one decision in two files, in a directory whose `create-` prefix
 * gave the UPDATE path no obvious reason to look there.
 *
 * Encoding and the introspection that drives it live together because they are
 * one operation split across a round-trip: {@link resolveArrayColumnTypes}
 * produces exactly the map {@link encodeColumnValue} consumes.
 */

/**
 * Encode one field value into the SQL fragment that carries it.
 *
 * `columnType` is the column's `data_type` as `information_schema` reports it.
 * Only `'ARRAY'` (e.g. `text[]`, as `multi-select` declares) selects a native
 * array literal; everything else — INCLUDING an absent entry — falls back to
 * JSON.
 *
 * That fallback is deliberately asymmetric. A JSON literal written to a genuine
 * array column fails loudly ("column is of type text[] but expression is of
 * type jsonb"), whereas guessing `text[]` for a JSONB column that legitimately
 * holds an array of primitives (`multiple-attachments`) would silently corrupt
 * it. A caller that cannot introspect the column is therefore safer omitting
 * the map than guessing at it.
 *
 * Scalars are BOUND (standing rule S3). The array and object branches inline an
 * escaped literal instead — not a relaxation of that rule but a driver
 * workaround: bun-sql's parameterised binds do not survive the `::jsonb` cast,
 * and it has no typed-array bind path at all. See `jsonbLiteral` and
 * `pgTextArrayLiteral`, which own the escaping that inlining requires.
 */
export const encodeColumnValue = (
  value: unknown,
  columnType: string | undefined
): Readonly<SQL> => {
  if (Array.isArray(value)) {
    // A native array literal can only carry scalars, so an array of objects
    // stays JSON even on a genuine array column.
    if (columnType === 'ARRAY') {
      const allScalar = value.every(
        (entry) =>
          typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
      )
      if (allScalar) return pgTextArrayLiteral(value)
    }
    return jsonbLiteral(value)
  }
  if (value !== null && typeof value === 'object') {
    return jsonbLiteral(value)
  }
  return sql`${value}`
}

/**
 * Column names carrying an ARRAY value across one or more records.
 *
 * The de-duplicated union is what {@link lookupArrayColumnTypes} needs: a batch
 * INSERT writes many records into ONE table, so a single introspection
 * round-trip over the union answers every record's encoding question. Returns
 * `[]` when nothing is array-shaped, which lets the caller skip the round-trip
 * entirely on the common scalar-only path.
 */
export const collectArrayColumnNames = (
  records: readonly Readonly<Record<string, unknown>>[]
): readonly string[] => [
  ...new Set(
    records.flatMap((fields) =>
      Object.entries(fields)
        .filter(([, value]) => Array.isArray(value))
        .map(([key]) => key)
    )
  ),
]

/**
 * Resolve PostgreSQL `data_type` for every column in `tableName` that is named
 * in `columnNames`, so {@link encodeColumnValue} can tell a `text[]` column
 * (multi-select) from a `jsonb` column that happens to hold an array of
 * primitives (multiple-attachments).
 *
 * Returns an empty map when `columnNames` is empty so the caller can skip the
 * introspection round-trip on the common scalar-only path. The schema lookup
 * uses `current_schema()` because Sovrium-managed tables always live in the
 * current search_path; auth tables in the `auth` schema never reach here.
 *
 * Promise-shaped (not Effect-shaped) because every call site already runs
 * inside an `await db.transaction(async (tx) => ...)` block; wrapping in Effect
 * would force a nested `runPromise` and make the surrounding transaction harder
 * to reason about.
 */
export async function lookupArrayColumnTypes(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  columnNames: ReadonlyArray<string>
): Promise<Readonly<Record<string, string>>> {
  if (columnNames.length === 0) return {}
  // SQLite has no native array type — array-shaped values are stored as JSON
  // text. `encodeColumnValue` falls back to `jsonbLiteral` (which emits a plain
  // JSON-text literal on SQLite) when a column is absent from this map, which
  // is exactly the desired encoding. Skip the introspection round-trip.
  if (parseDatabaseDialectConfig().dialect === 'sqlite') return {}
  validateTableName(tableName)
  // Defense in depth: validate every name through the same regex the clause
  // builders use, then bind each name as a SQL parameter via `sql\`${n}\``.
  // Per-name binding is required because `bun:sql` mishandles
  // `ANY($1::text[])` over a JS string[] — the array becomes JSONB-encoded TEXT
  // and PG rejects it with `25P02`, aborting the surrounding transaction.
  // Per-name binds round-trip cleanly and the validation gate keeps
  // `validateColumnName` as the single authoritative identifier check.
  try {
    const validatedNames = columnNames.map((name) => {
      validateColumnName(name)
      return name
    })
    const inList = sql.join(
      validatedNames.map((n) => sql`${n}`),
      sql.raw(', ')
    )
    const rows = (await executeRaw(
      tx,
      sql`SELECT column_name, data_type FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = ${tableName}
            AND column_name IN (${inList})`
    )) as unknown as ReadonlyArray<{
      readonly column_name: string
      readonly data_type: string
    }>
    return Object.fromEntries(rows.map((r) => [r.column_name, r.data_type]))
  } catch {
    // Fall back to JSONB encoding (the safe default) if introspection fails —
    // the transaction may be aborted, in which case the write will surface its
    // own clearer error downstream.
    return {}
  }
}

/**
 * The array-column type map for a set of records about to be written.
 *
 * Every write path needs exactly this composition — collect the array-shaped
 * column names across the records, then introspect that set once — and each had
 * been spelling it out itself. Naming it keeps the two steps from being
 * separated: a caller that collects but forgets to look up silently gets the
 * JSON fallback for a `text[]` column, which is the failure this whole module
 * exists to prevent.
 *
 * Pass every record that shares the statement's table: a batch resolves one map
 * for the whole batch, a single write passes `[fields]`.
 */
export const resolveArrayColumnTypes = (
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  records: readonly Readonly<Record<string, unknown>>[]
): Promise<Readonly<Record<string, string>>> =>
  lookupArrayColumnTypes(tx, tableName, collectArrayColumnNames(records))
