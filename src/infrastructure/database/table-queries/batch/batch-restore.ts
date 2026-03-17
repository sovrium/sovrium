/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db, SessionContextError, type DrizzleTransaction } from '@/infrastructure/database'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseError } from '../shared/error-handling'
import { validateTableName } from '../shared/validation'
import { runEffectInTx } from './batch-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Validate records exist and filter to only soft-deleted ones
 * Returns array of record IDs that are actually soft-deleted
 * Throws error if any record is not found (404)
 */
async function validateAndFilterRecordsForRestore(
  tx: Readonly<DrizzleTransaction>,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Promise<readonly string[]> {
  const validationResults = await Promise.all(
    recordIds.map(async (recordId) => {
      const checkResult = (await tx.execute(
        sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
      )) as readonly Record<string, unknown>[]

      if (checkResult.length === 0) return { recordId, error: 'not found', isDeleted: false }

      const record = checkResult[0]
      const isDeleted = Boolean(record?.deleted_at)

      return { recordId, error: undefined, isDeleted }
    })
  )

  // Check for "not found" errors first (these should return 404)
  const notFoundError = validationResults.find((result) => result.error === 'not found')
  if (notFoundError) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for Effect.tryPromise error handling
    throw new Error(`Record ${notFoundError.recordId} not found`)
  }

  // Filter to only records that are actually soft-deleted (skip active records)
  return validationResults.filter((result) => result.isDeleted).map((result) => result.recordId)
}

/**
 * Validate and filter records for restore with Effect error handling
 * Returns array of record IDs that are actually soft-deleted
 */
function validateAndFilterRecordsWithEffect(
  tx: Readonly<DrizzleTransaction>,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Effect.Effect<readonly string[], SessionContextError> {
  return Effect.tryPromise({
    try: () => validateAndFilterRecordsForRestore(tx, tableIdent, recordIds),
    catch: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new SessionContextError(`Validation failed: ${errorMessage}`, error)
    },
  })
}

/**
 * Execute restore query using parameterized IN clause
 */
function executeRestoreQuery(
  tx: Readonly<DrizzleTransaction>,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
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
        sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id IN (${idParams}) RETURNING *`
      )) as readonly Record<string, unknown>[]
      return result
    },
    catch: (error) => new SessionContextError(`Failed to restore records in ${tableName}`, error),
  })
}

/**
 * Log restore activities for all restored records
 */
function logRestoreActivities(
  session: Readonly<Session>,
  tableName: string,
  restoredRecords: readonly Record<string, unknown>[]
): Effect.Effect<void, never> {
  return Effect.forEach(restoredRecords, (record) =>
    logActivity({
      session,
      tableName,
      action: 'restore',
      recordId: String(record.id),
      changes: { after: record },
    })
  ).pipe(Effect.asVoid)
}

/**
 * Batch restore soft-deleted records
 *
 * Restores multiple soft-deleted records in a transaction.
 * Validates all records exist and are soft-deleted before restoring any.
 * Rolls back if any record fails validation.
 * Permissions enforced at the presentation layer (route handler).
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordIds - Array of record IDs to restore
 * @returns Effect resolving to number of restored records or error
 */
export function batchRestoreRecords(
  session: Readonly<Session>,
  tableName: string,
  recordIds: readonly string[]
): Effect.Effect<number, SessionContextError> {
  return Effect.gen(function* () {
    const restoredRecords = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)
          const tableIdent = sql.identifier(tableName)

          // Validate and filter to only soft-deleted records
          const deletedRecordIds = await runEffectInTx(
            validateAndFilterRecordsWithEffect(tx, tableIdent, recordIds)
          )

          // If no records to restore, return empty array
          if (deletedRecordIds.length === 0) {
            return []
          }

          // Restore only the filtered soft-deleted records
          return await runEffectInTx(
            executeRestoreQuery(tx, tableIdent, tableName, deletedRecordIds)
          )
        }),
      catch: wrapDatabaseError(`Failed to restore records in ${tableName}`),
    })

    yield* logRestoreActivities(session, tableName, restoredRecords)

    return restoredRecords.length
  })
}
