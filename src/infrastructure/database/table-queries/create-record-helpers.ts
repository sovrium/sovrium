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
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Check if table has owner_id column
 */
export function checkTableColumns(
  tableName: string,
  tx: Readonly<DrizzleTransaction>
): Effect.Effect<{ hasOwnerId: boolean }, SessionContextError> {
  return Effect.tryPromise({
    try: () =>
      tx.execute(
        sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'owner_id'`
      ) as Promise<readonly Record<string, unknown>[]>,
    catch: (error) => new SessionContextError('Failed to check table columns', error),
  }).pipe(
    Effect.map((result) => ({
      hasOwnerId: result.some((row) => row.column_name === 'owner_id'),
    }))
  )
}

/**
 * Sanitize fields by removing owner_id if table has that column
 */
export function sanitizeFields(
  fields: Readonly<Record<string, unknown>>,
  _hasOrgId: boolean,
  hasOwnerId: boolean
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => !(hasOwnerId && key === 'owner_id'))
  )
}

/**
 * Build SQL columns and values for INSERT query
 */
export function buildInsertClauses(
  sanitizedFields: Readonly<Record<string, unknown>>,
  _hasOrgId: boolean,
  hasOwnerId: boolean,
  session: Readonly<Session>
): Readonly<{ columnsClause: unknown; valuesClause: unknown }> {
  const baseEntries = Object.entries(sanitizedFields)

  // Build column identifiers and values
  const baseColumnIdentifiers = baseEntries.map(([key]) => {
    validateColumnName(key)
    return sql.identifier(key)
  })
  const baseValueParams = baseEntries.map(([, value]) => sql`${value}`)

  // Add owner_id column and value from session (immutable)
  const columnIdentifiers = hasOwnerId
    ? [...baseColumnIdentifiers, sql.identifier('owner_id')]
    : baseColumnIdentifiers
  const valueParams = hasOwnerId ? [...baseValueParams, sql`${session.userId}`] : baseValueParams

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
      // PostgreSQL unique constraint error code or constraint name in error cause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Error cause structure is dynamic
      const cause = (error as any)?.cause
      const isUniqueViolation =
        cause?.code === '23505' ||
        cause?.constraint ||
        cause?.message?.includes('unique constraint')

      if (isUniqueViolation) {
        return new UniqueConstraintViolationError('Unique constraint violation', error)
      }
      return new SessionContextError(`Failed to create record in ${tableName}`, error)
    },
  })
}
