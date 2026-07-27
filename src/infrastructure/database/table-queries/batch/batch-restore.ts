/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  db,
  NotFoundError,
  DatabaseError,
  type DrizzleTransaction,
} from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseError } from '../shared/error-handling'
import { validateTableName } from '../shared/validation'
import { BATCH_FANOUT_CONCURRENCY, runEffectInTx } from './batch-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

async function validateAndFilterRecordsForRestore(
  tx: Readonly<DrizzleTransaction>,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Promise<readonly string[]> {
  const validationResults = await runEffectInTx(
    Effect.all(
      recordIds.map((recordId) =>
        Effect.tryPromise({
          try: async () => {
            const checkResult = await executeRaw(
              tx,
              sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
            )

            if (checkResult.length === 0)
              return { recordId, error: 'not found' as string | undefined, isDeleted: false }

            const record = checkResult[0]
            const isDeleted = Boolean(record?.deleted_at)

            return { recordId, error: undefined, isDeleted }
          },
          catch: (error) => error,
        })
      ),
      { concurrency: BATCH_FANOUT_CONCURRENCY }
    )
  )

  const notFoundError = validationResults.find((result) => result.error === 'not found')
  if (notFoundError) {
    throw new NotFoundError('Record not found', notFoundError.recordId)
  }

  return validationResults.filter((result) => result.isDeleted).map((result) => result.recordId)
}

function validateAndFilterRecordsWithEffect(
  tx: Readonly<DrizzleTransaction>,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Effect.Effect<readonly string[], DatabaseError | NotFoundError> {
  return Effect.tryPromise({
    try: () => validateAndFilterRecordsForRestore(tx, tableIdent, recordIds),
    catch: (error) => {
      if (error instanceof NotFoundError) return error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new DatabaseError(`Validation failed: ${errorMessage}`, error)
    },
  })
}

function executeRestoreQuery(
  tx: Readonly<DrizzleTransaction>,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
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
        sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id IN (${idParams}) RETURNING *`
      )
      return result
    },
    catch: (error) => new DatabaseError(`Failed to restore records in ${tableName}`, error),
  })
}

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

export function batchRestoreRecords(
  session: Readonly<Session>,
  tableName: string,
  recordIds: readonly string[]
): Effect.Effect<number, DatabaseError | NotFoundError> {
  return Effect.gen(function* () {
    const restoredRecords = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)
          const tableIdent = sql.identifier(tableName)

          const deletedRecordIds = await runEffectInTx(
            validateAndFilterRecordsWithEffect(tx, tableIdent, recordIds)
          )

          if (deletedRecordIds.length === 0) {
            return []
          }

          return await runEffectInTx(
            executeRestoreQuery(tx, tableIdent, tableName, deletedRecordIds)
          )
        }),
      catch: (error) =>
        error instanceof NotFoundError
          ? error
          : wrapDatabaseError(`Failed to restore records in ${tableName}`)(error),
    })

    yield* logRestoreActivities(session, tableName, restoredRecords)

    return restoredRecords.length
  })
}
