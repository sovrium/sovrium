/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { db, SessionContextError } from '@/infrastructure/database'
import { logActivity } from './activity-log-helpers'
import { createSingleRecordInBatch, runEffectInTx } from './batch-helpers'
import { wrapDatabaseErrorWithValidation } from './error-handling'
import { validateTableName } from './validation'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { ValidationError } from '@/infrastructure/database'

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

          // Use Effect.reduce with runEffectInTx to properly propagate ValidationError
          return await runEffectInTx(
            Effect.reduce(recordsData, [] as readonly Record<string, unknown>[], (acc, fields) =>
              createSingleRecordInBatch(tx, tableName, fields).pipe(
                Effect.map((record) => (record ? [...acc, record] : acc))
              )
            )
          )
        }),
      catch: wrapDatabaseErrorWithValidation(`Failed to create batch records in ${tableName}`),
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
