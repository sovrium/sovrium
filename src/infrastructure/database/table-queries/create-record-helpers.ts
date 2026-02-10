/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
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
import { validateColumnName } from './validation'

/**
 * Check if an object has PostgreSQL unique constraint violation markers
 * (code 23505, constraint name, or 'unique constraint' in message)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Error cause structure is dynamic
function hasUniqueViolationMarkers(obj: any): boolean {
  return obj?.code === '23505' || !!obj?.constraint || !!obj?.message?.includes('unique constraint')
}

/**
 * Check if an error is a PostgreSQL unique constraint violation (code 23505)
 * Checks the error itself and its cause for violation markers.
 */
export function isUniqueConstraintViolation(error: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Error cause structure is dynamic
  return hasUniqueViolationMarkers(error) || hasUniqueViolationMarkers((error as any)?.cause)
}

/**
 * Build SQL columns and values for INSERT query
 */
export function buildInsertClauses(
  fields: Readonly<Record<string, unknown>>
): Readonly<{ columnsClause: unknown; valuesClause: unknown }> {
  const entries = Object.entries(fields)

  // Build column identifiers and values
  const columnIdentifiers = entries.map(([key]) => {
    validateColumnName(key)
    return sql.identifier(key)
  })
  const valueParams = entries.map(([, value]) => sql`${value}`)

  // Build INSERT query using sql.join for columns and values
  const columnsClause = sql.join(columnIdentifiers, sql.raw(', '))
  const valuesClause = sql.join(valueParams, sql.raw(', '))

  return { columnsClause, valuesClause }
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
