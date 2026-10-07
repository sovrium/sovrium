/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL } from 'drizzle-orm'
import { StaleWriteError } from '@/domain/errors'
import { DatabaseError, type DrizzleTransaction } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { validateColumnName, tableIdentifier } from '../statement/validation'
import { encodeColumnValue } from './column-value-encoding'
import { rowAfterTriggers } from './record-fetch-helpers'

/**
 * Validate fields object is not empty
 * Returns entries directly or throws error (Promise-based for transaction use)
 */
export async function validateFieldsNotEmpty(
  fields: Readonly<Record<string, unknown>>
): Promise<readonly [string, unknown][]> {
  const entries = Object.entries(fields)

  if (entries.length === 0) {
    throw new DatabaseError('Cannot update record with no fields', undefined)
  }

  return entries
}

/**
 * Build UPDATE SET clause with validated columns (CRUD version)
 *
 * `arrayColumnTypes` answers the same question it answers for the INSERT
 * builder, and is answered by the same function — {@link encodeColumnValue}.
 * Resolve the map with `resolveArrayColumnTypes`, because PostgreSQL rejects
 * the wrong choice outright ("column is of type text[] but expression is of
 * type jsonb").
 *
 * It is REQUIRED rather than optional, and that is the whole point. When it was
 * optional, two of the three update paths — the CRUD update and
 * `batch-update` — simply never passed it, and every `PATCH` of a
 * `multi-select` or `array` field answered 500 on PostgreSQL at every arity.
 * Nothing in the type system asked them to. A caller that genuinely has no
 * column introspection passes `{}` and states that; forgetting is no longer
 * spellable.
 *
 * An absent entry still means the JSONB-for-everything fallback, which is the
 * safe default: a JSONB literal written to a genuine array column fails loudly,
 * whereas guessing `text[]` for a JSONB column would silently corrupt data.
 */
export function buildUpdateSetClauseCRUD(
  entries: readonly [string, unknown][],
  arrayColumnTypes: Readonly<Record<string, string>>
): Readonly<ReturnType<typeof sql.join>> {
  const setClauses = entries.map(([key, value]) => {
    validateColumnName(key)
    return sql`${sql.identifier(key)} = ${encodeColumnValue(value, arrayColumnTypes[key])}`
  })
  return sql.join(setClauses, sql.raw(', '))
}

/**
 * The predicate that holds when the stored `updated_at` is the optimistic-lock
 * token, compared to the MILLISECOND — the precision a client reads the token
 * at, while PostgreSQL stores microseconds.
 *
 * SQLite keeps `updated_at` as ISO-8601 text: `julianday` parses it whatever its
 * offset notation, and its double resolves well below a millisecond at present
 * dates, so rounding recovers the exact millisecond. PostgreSQL truncates, the
 * way a microsecond timestamp reads back as a JavaScript `Date`.
 */
const updatedAtIs = (epochMs: number): Readonly<SQL> => {
  const column = sql.identifier('updated_at')
  return isSqliteRuntime()
    ? sql`CAST(ROUND((julianday(${column}) - 2440587.5) * 86400000) AS INTEGER) = ${epochMs}`
    : sql`FLOOR(EXTRACT(EPOCH FROM ${column}) * 1000)::bigint = ${epochMs}`
}

/**
 * Execute the UPDATE of one record, optionally guarded by its optimistic-lock
 * token. Promise-based for transaction use.
 *
 * With `expectedUpdatedAtMs`, the token check is part of the UPDATE's own
 * `WHERE`: the comparison and the write are ONE statement, so no other write
 * can land between them. On PostgreSQL a concurrent edit holding the row makes
 * this statement wait, then re-evaluate its `WHERE` against the committed row
 * — whose `updated_at` has moved — and match nothing. Matching nothing while a
 * token was given is a {@link StaleWriteError}; the caller has already read the
 * row inside the same transaction, so "absent" is not the explanation.
 */
export async function executeRecordUpdateCRUD(
  tx: Readonly<DrizzleTransaction>,
  target: {
    readonly tableName: string
    readonly recordId: string
    /** The optimistic-lock token to compare, as epoch milliseconds; absent skips the check. */
    readonly expectedUpdatedAtMs?: number | undefined
  },
  setClause: Readonly<ReturnType<typeof sql.join>>
): Promise<Record<string, unknown>> {
  const { tableName, recordId, expectedUpdatedAtMs } = target
  const tokenGuard =
    expectedUpdatedAtMs === undefined ? sql`` : sql` AND ${updatedAtIs(expectedUpdatedAtMs)}`
  try {
    const result = await executeRaw(
      tx,
      sql`UPDATE ${tableIdentifier(tableName)} SET ${setClause} WHERE id = ${recordId}${tokenGuard} RETURNING *`
    )

    if (result.length === 0 && expectedUpdatedAtMs !== undefined) {
      throw new StaleWriteError(
        `Record ${recordId} in ${tableName} changed since it was read`,
        recordId
      )
    }

    // If no rows were updated, record not found or access denied
    if (result.length === 0) {
      throw new Error(`Record not found or access denied`)
    }

    return { ...(await rowAfterTriggers(tx, tableName, result[0]!)) }
  } catch (error) {
    if (error instanceof StaleWriteError) throw error
    // Preserve "not found" or "access denied" in wrapper message for API error handling
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (errorMsg.includes('not found') || errorMsg.includes('access denied')) {
      throw new DatabaseError(errorMsg, error)
    }
    throw new DatabaseError(`Failed to update record ${recordId} in ${tableName}`, error)
  }
}

/** A stored or client-sent `updated_at` as epoch milliseconds; `undefined` when unreadable. */
const epochMsOf = (value: unknown): number | undefined => {
  const ms =
    value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isNaN(ms) ? undefined : ms
}

/**
 * The optimistic-lock token to enforce for this write, as epoch milliseconds —
 * or `undefined` when there is nothing to enforce: the caller sent no token, the
 * record is absent, the table does not track `updated_at`, or either value is
 * unreadable (a malformed comparison skips the check rather than block a
 * legitimate write).
 */
export function lockTokenToEnforce(
  token: string | undefined,
  storedRecord: Readonly<Record<string, unknown>> | undefined
): number | undefined {
  if (token === undefined || storedRecord === undefined) return undefined
  if (epochMsOf(storedRecord['updated_at']) === undefined) return undefined
  return epochMsOf(token)
}

/**
 * Whether the record read inside the write transaction still carries the token.
 * For a write that changes no column of the row (only its links), where there
 * is no UPDATE to carry the comparison.
 */
export function storedRecordCarriesToken(
  storedRecord: Readonly<Record<string, unknown>>,
  tokenMs: number
): boolean {
  return epochMsOf(storedRecord['updated_at']) === tokenMs
}
