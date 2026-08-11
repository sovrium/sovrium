/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { DatabaseError } from '@/domain/errors'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import type { DrizzleTransaction } from '@/infrastructure/database/drizzle/db'

/**
 * Fetch a single record by ID (Promise-based for transaction use)
 *
 * Used before mutations (update/delete) for activity logging.
 * Throws DatabaseError on database failure.
 */
export async function fetchRecordById(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string
): Promise<Record<string, unknown> | undefined> {
  try {
    const result = await executeRaw(
      tx,
      sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id = ${recordId} LIMIT 1`
    )
    return result[0]
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
    throw new DatabaseError(`Failed to fetch record ${recordId}`, error)
  }
}

/**
 * Fetch a single record by ID (Effect-based for batch operations)
 *
 * Returns undefined on error — non-critical for batch activity logging.
 */
export function fetchRecordByIdEffect(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | undefined, never> {
  return Effect.tryPromise({
    try: async () => {
      const result = await executeRaw(
        tx,
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id = ${recordId} LIMIT 1`
      )
      return result[0]
    },
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined))
}

/**
 * Fetch multiple records by IDs (Effect-based for batch operations)
 *
 * Fails with DatabaseError on database failure.
 */
export function fetchRecordsByIds(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordIds: readonly string[]
): Effect.Effect<readonly Record<string, unknown>[], DatabaseError> {
  return Effect.tryPromise({
    try: async () => {
      const idParams = sql.join(
        recordIds.map((id) => sql`${id}`),
        sql.raw(', ')
      )
      const result = await executeRaw(
        tx,
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id IN (${idParams})`
      )
      return result
    },
    catch: (error) => new DatabaseError('Failed to fetch records before operation', error),
  })
}
