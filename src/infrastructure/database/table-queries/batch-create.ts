/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { db, SessionContextError, ValidationError } from '@/infrastructure/database'
import { logActivity } from './activity-log-helpers'
import { createSingleRecord } from './batch-helpers'
import { validateTableName } from './validation'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Batch create records
 *
 * Creates multiple records in a single transaction.
 * Permissions applied via application layer.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordsData - Array of field objects to insert
 * @returns Effect resolving to array of created records
 */
export function batchCreateRecords(
  session: Readonly<Session>,
  tableName: string,
  recordsData: readonly Record<string, unknown>[]
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError | ValidationError> {
  return Effect.gen(function* () {
    const createdRecords = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)

          if (recordsData.length === 0) {
            // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
            throw new SessionContextError('Cannot create batch with no records', undefined)
          }

          // Process records sequentially, collecting results using immutable array operations
          // eslint-disable-next-line functional/no-let,functional/no-loop-statements -- Required for sequential processing in transaction
          let records: readonly Record<string, unknown>[] = []
          for (const fields of recordsData) {
            const record = await createSingleRecord(tx, tableName, fields)
            if (record) {
              records = [...records, record as Record<string, unknown>]
            }
          }

          return records
        }),
      catch: (error) => {
        // Check error type by _tag property (more reliable than instanceof after serialization)
        const errorObj = error as { _tag?: string; message?: string; details?: readonly unknown[] }

        // Let ValidationError propagate unchanged for proper error handling
        if (errorObj._tag === 'ValidationError') {
          return error as ValidationError
        }
        // Let ValidationError instances propagate unchanged
        if (error instanceof ValidationError) {
          return error
        }
        // Let SessionContextError propagate unchanged
        if (errorObj._tag === 'SessionContextError') {
          return error as SessionContextError
        }
        if (error instanceof SessionContextError) {
          return error
        }
        // Wrap other errors in SessionContextError
        return new SessionContextError(`Failed to create batch records in ${tableName}`, error)
      },
    })

    // Log activity for each created record
    yield* Effect.forEach(createdRecords, (record) =>
      logActivity({
        session,
        tableName,
        action: 'create',
        recordId: String(record.id),
        changes: { after: record },
      })
    ).pipe(Effect.asVoid)

    return createdRecords
  })
}
