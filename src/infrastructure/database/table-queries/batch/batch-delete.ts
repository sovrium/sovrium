/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db, SessionContextError, type DrizzleTransaction } from '@/infrastructure/database'
import { fetchRecordsByIds } from '../mutation-helpers/record-fetch-helpers'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseError } from '../shared/error-handling'
import { validateTableName } from '../shared/validation'
import { runEffectInTx } from './batch-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

async function validateRecordsForDelete(
  tx: Readonly<DrizzleTransaction>,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Promise<void> {
  const validationResults = await Promise.all(
    recordIds.map(async (recordId) => {
      const checkResult = (await tx.execute(
        sql`SELECT id FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
      )) as readonly Record<string, unknown>[]

      if (checkResult.length === 0) {
        return { recordId, error: 'not found' }
      }

      return { recordId, error: undefined }
    })
  )

  const firstError = validationResults.find((result) => result.error !== undefined)
  if (firstError) {
    throw new Error(`Record ${firstError.recordId} not found`)
  }
}

function validateRecordsForDeleteWithEffect(
  tx: Readonly<DrizzleTransaction>,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Effect.Effect<void, SessionContextError> {
  return Effect.tryPromise({
    try: () => validateRecordsForDelete(tx, tableIdent, recordIds),
    catch: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new SessionContextError(`Validation failed: ${errorMessage}`, error)
    },
  })
}

function checkSoftDeleteSupport(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Effect.Effect<boolean, SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const columnCheck = (await tx.execute(
        sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_at'`
      )) as readonly Record<string, unknown>[]
      return columnCheck.length > 0
    },
    catch: (error) => new SessionContextError('Failed to check deleted_at column', error),
  })
}

function checkDeletedBySupport(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Effect.Effect<boolean, SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const columnCheck = (await tx.execute(
        sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_by'`
      )) as readonly Record<string, unknown>[]
      return columnCheck.length > 0
    },
    catch: (error) => new SessionContextError('Failed to check deleted_by column', error),
  })
}

function executeDeleteQuery(
  tx: Readonly<DrizzleTransaction>,
  params: {
    readonly tableName: string
    readonly recordIds: readonly string[]
    readonly hasSoftDelete: boolean
    readonly hasDeletedBy: boolean
    readonly permanent: boolean
    readonly userId: string
  }
): Effect.Effect<number, SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const tableIdent = sql.identifier(params.tableName)
      const idParams = sql.join(
        params.recordIds.map((id) => sql`${id}`),
        sql.raw(', ')
      )

      const query = params.permanent
        ? sql`DELETE FROM ${tableIdent} WHERE id IN (${idParams}) RETURNING id`
        : params.hasSoftDelete
          ? params.hasDeletedBy
            ? sql`UPDATE ${tableIdent} SET deleted_at = NOW(), deleted_by = ${params.userId} WHERE id IN (${idParams}) AND deleted_at IS NULL RETURNING id`
            : sql`UPDATE ${tableIdent} SET deleted_at = NOW() WHERE id IN (${idParams}) AND deleted_at IS NULL RETURNING id`
          : sql`DELETE FROM ${tableIdent} WHERE id IN (${idParams}) RETURNING id`

      const result = (await tx.execute(query)) as readonly Record<string, unknown>[]
      return result.length
    },
    catch: (error) =>
      new SessionContextError(`Failed to delete records in ${params.tableName}`, error),
  })
}

function logDeleteActivities(
  session: Readonly<Session>,
  tableName: string,
  recordsBefore: readonly Record<string, unknown>[]
): Effect.Effect<void, never> {
  return Effect.forEach(recordsBefore, (record) =>
    logActivity({
      session,
      tableName,
      action: 'delete',
      recordId: String(record.id),
      changes: { before: record },
    })
  ).pipe(Effect.asVoid)
}

export function batchDeleteRecords(
  session: Readonly<Session>,
  tableName: string,
  recordIds: readonly string[],
  permanent = false
): Effect.Effect<number, SessionContextError> {
  return Effect.gen(function* () {
    const { deletedCount, recordsBefore } = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)
          const tableIdent = sql.identifier(tableName)

          await runEffectInTx(validateRecordsForDeleteWithEffect(tx, tableIdent, recordIds))

          const before = await runEffectInTx(fetchRecordsByIds(tx, tableName, recordIds))
          const hasSoftDelete = await runEffectInTx(checkSoftDeleteSupport(tx, tableName))
          const hasDeletedBy = await runEffectInTx(checkDeletedBySupport(tx, tableName))

          const count = await runEffectInTx(
            executeDeleteQuery(tx, {
              tableName,
              recordIds,
              hasSoftDelete,
              hasDeletedBy,
              permanent,
              userId: session.userId,
            })
          )

          return { deletedCount: count, recordsBefore: before }
        }),
      catch: wrapDatabaseError(`Failed to delete records in ${tableName}`),
    })

    yield* logDeleteActivities(session, tableName, recordsBefore)

    return deletedCount
  })
}
