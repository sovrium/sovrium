/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { DatabaseError, type DrizzleTransaction } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { validateColumnName } from '../shared/validation'
import { encodeColumnValue } from './column-value-encoding'

/**
 * Validate fields object is not empty
 * Returns entries directly or throws error (Promise-based for transaction use)
 */
export async function validateFieldsNotEmpty(
  fields: Readonly<Record<string, unknown>>
): Promise<readonly [string, unknown][]> {
  const entries = Object.entries(fields)

  if (entries.length === 0) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
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
 * Execute UPDATE query with permission enforcement
 * Promise-based for transaction use
 */
export async function executeRecordUpdateCRUD(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  setClause: Readonly<ReturnType<typeof sql.join>>
): Promise<Record<string, unknown>> {
  try {
    const result = await executeRaw(
      tx,
      sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
    )

    // If no rows were updated, record not found or access denied
    if (result.length === 0) {
      // eslint-disable-next-line functional/no-throw-statements -- Permission blocking requires error propagation
      throw new Error(`Record not found or access denied`)
    }

    return result[0]!
  } catch (error) {
    // Preserve "not found" or "access denied" in wrapper message for API error handling
    const errorMsg = error instanceof Error ? error.message : String(error)
    if (errorMsg.includes('not found') || errorMsg.includes('access denied')) {
      // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
      throw new DatabaseError(errorMsg, error)
    }
    // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
    throw new DatabaseError(`Failed to update record ${recordId} in ${tableName}`, error)
  }
}
