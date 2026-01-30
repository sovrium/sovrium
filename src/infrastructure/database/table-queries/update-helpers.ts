/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { SessionContextError } from '@/infrastructure/database'
import { validateColumnName } from './validation'

/**
 * Validate fields object is not empty
 */
export function validateFieldsNotEmpty(
  fields: Readonly<Record<string, unknown>>
): Effect.Effect<readonly [string, unknown][], SessionContextError> {
  const entries = Object.entries(fields)

  if (entries.length === 0) {
    return Effect.fail(new SessionContextError('Cannot update record with no fields', undefined))
  }

  return Effect.succeed(entries)
}

/**
 * Fetch record before update for activity logging (CRUD version)
 */
export function fetchRecordBeforeUpdateCRUD(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | undefined, SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const result = (await tx.execute(
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id = ${recordId} LIMIT 1`
      )) as readonly Record<string, unknown>[]
      return result[0]
    },
    catch: (error) => new SessionContextError(`Failed to fetch record ${recordId}`, error),
  })
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
 * Execute UPDATE query with RLS enforcement
 */
export function executeRecordUpdateCRUD(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tableName: string,
  recordId: string,
  setClause: Readonly<ReturnType<typeof sql.join>>
): Effect.Effect<Record<string, unknown>, SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const result = (await tx.execute(
        sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
      )) as readonly Record<string, unknown>[]

      // If RLS blocked the update, result will be empty
      if (result.length === 0) {
        // eslint-disable-next-line functional/no-throw-statements -- RLS blocking requires error propagation
        throw new Error(`Record not found or access denied`)
      }

      return result[0]!
    },
    catch: (error) => {
      // Preserve "not found" or "access denied" in wrapper message for API error handling
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (errorMsg.includes('not found') || errorMsg.includes('access denied')) {
        return new SessionContextError(errorMsg, error)
      }
      return new SessionContextError(`Failed to update record ${recordId} in ${tableName}`, error)
    },
  })
}
