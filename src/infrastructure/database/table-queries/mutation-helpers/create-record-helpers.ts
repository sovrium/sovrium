/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  SessionContextError,
  UniqueConstraintViolationError,
  type DrizzleTransaction,
} from '@/infrastructure/database'
import { jsonbLiteral, pgTextArrayLiteral } from '@/infrastructure/database/sql/sql-utils'
import { validateColumnName, validateTableName } from '../shared/validation'

/**
 * Shape of PostgreSQL driver error objects that may contain unique constraint info.
 * Compatible with bun:sql, postgres.js, and pg error objects.
 */
interface PostgresErrorLike {
  readonly code?: string
  readonly constraint?: string
  readonly message?: string
  readonly cause?: PostgresErrorLike
}

/**
 * Check if an object has PostgreSQL unique constraint violation markers
 * (code 23505, constraint name, or 'unique constraint' in message)
 */
function hasUniqueViolationMarkers(obj: PostgresErrorLike | null | undefined): boolean {
  return obj?.code === '23505' || !!obj?.constraint || !!obj?.message?.includes('unique constraint')
}

/**
 * Check if an error is a PostgreSQL unique constraint violation (code 23505)
 * Checks the error itself and its cause for violation markers.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  const err = error as PostgresErrorLike | null | undefined
  return hasUniqueViolationMarkers(err) || hasUniqueViolationMarkers(err?.cause)
}

/**
 * Build SQL columns and values for INSERT query.
 *
 * `arrayColumnTypes` (when supplied) maps array-shaped column names to their
 * PostgreSQL data types as reported by `information_schema.columns`. Two
 * values are meaningful here:
 *   - `'ARRAY'` (e.g. `text[]`) — emitted via `pgTextArrayLiteral` so the
 *     literal parses as a native PG array. Required for `multi-select`.
 *   - any `jsonb`-like value (incl. `'jsonb'`, `'USER-DEFINED'`) — emitted
 *     via `jsonbLiteral`. Used by `multiple-attachments`, `json`, and any
 *     other JSONB-backed column that happens to receive an array literal.
 *
 * When the map is missing or omits a column (because the caller could not
 * introspect it), we fall back to JSONB. JSONB is the strictly safer
 * default — drizzle's TEXT-bind path produces a JSONB-string for a stray
 * `text[]` insert, which still rejects with a clear error (matching the
 * pre-Y-5 behaviour); whereas guessing `text[]` for a JSONB column would
 * silently corrupt data on JSONB columns that legitimately store arrays of
 * primitives (e.g. `multiple-attachments`).
 */
export function buildInsertClauses(
  fields: Readonly<Record<string, unknown>>,
  arrayColumnTypes?: Readonly<Record<string, string>>
): Readonly<{ columnsClause: unknown; valuesClause: unknown }> {
  const entries = Object.entries(fields)

  // Build column identifiers and values
  const columnIdentifiers = entries.map(([key]) => {
    validateColumnName(key)
    return sql.identifier(key)
  })
  const valueParams = entries.map(([key, value]) => {
    if (Array.isArray(value)) {
      // Resolve column type from caller-supplied introspection map. Only
      // emit a PG `text[]` literal when the column is genuinely an SQL
      // array; everything else (including jsonb-backed array columns
      // such as `multiple-attachments`) goes through `jsonbLiteral`.
      const pgType = arrayColumnTypes?.[key]
      if (pgType === 'ARRAY') {
        const allScalar = value.every(
          (entry) =>
            typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
        )
        if (allScalar) return pgTextArrayLiteral(value)
      }
      return jsonbLiteral(value)
    }
    if (value !== null && typeof value === 'object') {
      // Inline as a JSONB literal — see `jsonbLiteral` docstring for why
      // bun-sql parameterised binds don't survive the ::jsonb cast.
      return jsonbLiteral(value)
    }
    return sql`${value}`
  })

  // Build INSERT query using sql.join for columns and values
  const columnsClause = sql.join(columnIdentifiers, sql.raw(', '))
  const valuesClause = sql.join(valueParams, sql.raw(', '))

  return { columnsClause, valuesClause }
}

/**
 * Resolve PostgreSQL `data_type` for every column in `tableName` that is
 * named in `columnNames`. Used by `buildInsertClauses` to disambiguate
 * `text[]` columns (multi-select) from `jsonb` columns that happen to hold
 * arrays of primitives (multiple-attachments).
 *
 * Returns an empty map when `columnNames` is empty so the caller can skip
 * the introspection round-trip on the common scalar-only INSERT path. The
 * schema lookup uses `current_schema()` because Sovrium-managed tables
 * always live in the current search_path; auth tables in `auth` schema
 * never reach this path.
 *
 * Promise-shaped (not Effect-shaped) because the only call site already
 * runs inside an `await db.transaction(async (tx) => ...)` block; wrapping
 * in Effect there would force a nested `runPromise` and make the
 * surrounding transaction harder to reason about.
 */
export async function lookupArrayColumnTypes(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  columnNames: ReadonlyArray<string>
): Promise<Readonly<Record<string, string>>> {
  if (columnNames.length === 0) return {}
  validateTableName(tableName)
  // Defense in depth: validate every name through the same regex
  // `buildInsertClauses` uses, then bind each name as a SQL parameter
  // via `sql\`${n}\``. Per-name binding is required because `bun:sql`
  // mishandles `ANY($1::text[])` over a JS string[] — the array becomes
  // JSONB-encoded TEXT and PG rejects it with `25P02`, aborting the
  // surrounding transaction. Per-name binds round-trip cleanly and the
  // validation gate keeps `validateColumnName` as the single
  // authoritative identifier check.
  try {
    const validatedNames = columnNames.map((name) => {
      validateColumnName(name)
      return name
    })
    const inList = sql.join(
      validatedNames.map((n) => sql`${n}`),
      sql.raw(', ')
    )
    const rows = (await tx.execute(
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
    // Fall back to JSONB encoding (the safe default) if introspection
    // fails — the transaction may be aborted, in which case the INSERT
    // will surface its own clearer error downstream.
    return {}
  }
}

/**
 * Execute INSERT query and handle errors
 */
export function executeInsert(
  tableName: string,
  columnsClause: unknown,
  valuesClause: unknown,
  tx: Readonly<DrizzleTransaction>
): Effect.Effect<Record<string, unknown>, SessionContextError | UniqueConstraintViolationError> {
  return Effect.tryPromise({
    try: async () => {
      const insertResult = (await tx.execute(
        sql`INSERT INTO ${sql.identifier(tableName)} (${columnsClause}) VALUES (${valuesClause}) RETURNING *`
      )) as readonly Record<string, unknown>[]
      return insertResult[0] ?? {}
    },
    catch: (error) => {
      if (isUniqueConstraintViolation(error)) {
        return new UniqueConstraintViolationError('Unique constraint violation', error)
      }
      return new SessionContextError(`Failed to create record in ${tableName}`, error)
    },
  })
}
