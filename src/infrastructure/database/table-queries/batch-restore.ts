/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, eq } from 'drizzle-orm'
import { Effect } from 'effect'
import { users, type Session } from '@/infrastructure/auth/better-auth/schema'
import {
  db,
  SessionContextError,
  ForbiddenError,
  type DrizzleTransaction,
} from '@/infrastructure/database'
import { logActivity } from './activity-log-helpers'
import { runEffectInTx } from './batch-helpers'
import { validateTableName } from './validation'

/**
 * Check if user has permission to restore records
 * Looks up user role from the database (application-layer enforcement)
 */
function checkRestorePermission(
  session: Readonly<Session>
): Effect.Effect<void, ForbiddenError | SessionContextError> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db.select({ role: users.role }).from(users).where(eq(users.id, session.userId)).limit(1),
      catch: (error) => new SessionContextError('Failed to check user role', error),
    })

    const userRole = result[0]?.role
    if (userRole === 'viewer') {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to restore records in this table')
      )
    }
  })
}

/**
 * Validate records exist and are soft-deleted
 */
async function validateRecordsForRestore(
  tx: Readonly<DrizzleTransaction>,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Promise<void> {
  const validationResults = await Promise.all(
    recordIds.map(async (recordId) => {
      const checkResult = (await tx.execute(
        sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
      )) as readonly Record<string, unknown>[]

      if (checkResult.length === 0) return { recordId, error: 'not found' }

      const record = checkResult[0]
      if (!record?.deleted_at) return { recordId, error: 'not deleted' }

      return { recordId, error: undefined }
    })
  )

  const firstError = validationResults.find((result) => result.error !== undefined)
  if (firstError) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for Effect.tryPromise error handling
    throw new Error(
      firstError.error === 'not found'
        ? `Record ${firstError.recordId} not found`
        : `Record ${firstError.recordId} is not deleted`
    )
  }
}

/**
 * Validate records for restore with Effect error handling
 */
function validateRecordsForRestoreWithEffect(
  tx: Readonly<DrizzleTransaction>,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Effect.Effect<void, SessionContextError> {
  return Effect.tryPromise({
    try: () => validateRecordsForRestore(tx, tableIdent, recordIds),
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
      // Check if table has deleted_by column
      const columnCheck = (await tx.execute(
        sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_by'`
      )) as readonly Record<string, unknown>[]
      const hasDeletedBy = columnCheck.length > 0

      const idParams = sql.join(
        recordIds.map((id) => sql`${id}`),
        sql.raw(', ')
      )

      // Clear both deleted_at and deleted_by if the column exists
      const result = hasDeletedBy
        ? ((await tx.execute(
            sql`UPDATE ${tableIdent} SET deleted_at = NULL, deleted_by = NULL WHERE id IN (${idParams}) RETURNING *`
          )) as readonly Record<string, unknown>[])
        : ((await tx.execute(
            sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id IN (${idParams}) RETURNING *`
          )) as readonly Record<string, unknown>[])

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
 * Permissions applied via application layer.
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
): Effect.Effect<number, SessionContextError | ForbiddenError> {
  return Effect.gen(function* () {
    yield* checkRestorePermission(session)

    const restoredRecords = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)
          const tableIdent = sql.identifier(tableName)

          // eslint-disable-next-line functional/no-expression-statements -- Required for transaction validation
          await runEffectInTx(validateRecordsForRestoreWithEffect(tx, tableIdent, recordIds))

          return await runEffectInTx(executeRestoreQuery(tx, tableIdent, tableName, recordIds))
        }),
      catch: (error) =>
        error instanceof SessionContextError
          ? error
          : new SessionContextError(`Failed to restore records in ${tableName}`, error),
    })

    yield* logRestoreActivities(session, tableName, restoredRecords)

    return restoredRecords.length
  })
}
