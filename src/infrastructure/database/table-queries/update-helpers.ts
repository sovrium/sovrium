/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { SessionContextError, type DrizzleTransaction } from '@/infrastructure/database'
import { validateColumnName } from './validation'

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
    throw new SessionContextError('Cannot update record with no fields', undefined)
  }

  return entries
}

/**
 * Fetch record before update for activity logging (CRUD version)
 * Promise-based for transaction use
 */
export async function fetchRecordBeforeUpdateCRUD(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string
): Promise<Record<string, unknown> | undefined> {
  try {
    const result = (await tx.execute(
      sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id = ${recordId} LIMIT 1`
    )) as readonly Record<string, unknown>[]
    return result[0]
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
    throw new SessionContextError(`Failed to fetch record ${recordId}`, error)
  }
}

/**
 * Build UPDATE SET clause with validated columns (CRUD version)
 */
export function buildUpdateSetClauseCRUD(
  entries: readonly [string, unknown][]
): Readonly<ReturnType<typeof sql.join>> {
  const setClauses = entries.map(([key, value]) => {
    validateColumnName(key)
    return sql`${sql.identifier(key)} = ${value}`
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
    const result = (await tx.execute(
      sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
    )) as readonly Record<string, unknown>[]

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
      throw new SessionContextError(errorMsg, error)
    }
    // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
    throw new SessionContextError(`Failed to update record ${recordId} in ${tableName}`, error)
  }
}
