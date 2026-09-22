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
import { logError } from '@/infrastructure/logging/logger'
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
    catch: (cause) => new DatabaseError(`Failed to read a record from ${tableName}`, cause),
  }).pipe(
    // A SELECT that fails and a row that does not exist both arrived here as
    // `undefined`, through two swallows in a row — so a driver failure inside a
    // write transaction read as "record not found", and the write path then
    // reported a 404 for a database that was down. The value is unchanged
    // (callers treat `undefined` as absent, and a probe must not fail the
    // transaction), but the two cases are now distinguishable in the log.
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[records] could not read a record during a write', cause, {
          'sovrium.table': tableName,
          'sovrium.record.id': recordId,
        })
      })
    ),
    Effect.orElseSucceed(() => undefined)
  )
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
