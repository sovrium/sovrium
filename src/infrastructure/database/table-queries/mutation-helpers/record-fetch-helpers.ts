/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { SessionContextError } from '@/domain/errors'
import type { DrizzleTransaction } from '@/infrastructure/database/drizzle/db'

/**
 * Fetch a single record by ID (Promise-based for transaction use)
 *
 * Used before mutations (update/delete) for activity logging.
 * Throws SessionContextError on database failure.
 */
export async function fetchRecordById(
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
      const result = (await tx.execute(
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id = ${recordId} LIMIT 1`
      )) as readonly Record<string, unknown>[]
      return result[0]
    },
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined))
}

/**
 * Fetch multiple records by IDs (Effect-based for batch operations)
 *
 * Fails with SessionContextError on database failure.
 */
export function fetchRecordsByIds(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordIds: readonly string[]
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const idParams = sql.join(
        recordIds.map((id) => sql`${id}`),
        sql.raw(', ')
      )
      const result = (await tx.execute(
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id IN (${idParams})`
      )) as readonly Record<string, unknown>[]
      return result
    },
    catch: (error) => new SessionContextError('Failed to fetch records before operation', error),
  })
}
