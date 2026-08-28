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
import { passthroughError, unwrapPassthrough, wrapDatabaseError } from '../shared/error-handling'
import { validateTableName } from '../shared/validation'
import { BATCH_FANOUT_CONCURRENCY, runEffectInTx } from './batch-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Validate records exist and filter to only soft-deleted ones
 * Returns array of record IDs that are actually soft-deleted
 * Throws error if any record is not found (404)
 *
 * FAN-OUT WIDTH: `BATCH_FANOUT_CONCURRENCY` — one probe per `recordId`, so the
 * width is input-size bounded (the caller's batch). Capped rather than left to
 * a raw `Promise.all`; see that constant for why the transaction's single
 * connection makes 2 the right ceiling.
 *
 * ORDER: `Effect.all` preserves array order exactly as `Promise.all` did, which
 * this function depends on TWICE — the "not found" error names the first
 * missing id by array position, and the returned filtered id list keeps the
 * caller's ordering.
 */
async function validateAndFilterRecordsForRestore(
  tx: Readonly<DrizzleTransaction>,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Promise<readonly string[]> {
  const validationResults = await runEffectInTx(
    Effect.all(
      recordIds.map((recordId) =>
        // The `catch` TAGS the rejection into a `PassthroughError` carrier,
        // which `validateAndFilterRecordsWithEffect` unwraps before it
        // composes its message and stores its `cause`. That keeps the error
        // channel TYPED here without changing what the outer handler sees: the
        // final `DatabaseError` still reads its message from the driver error
        // and still points its `cause` AT it, at the chain depth
        // `classifyDriverFailure` is tested against. The plain identity mapper
        // this replaces left the channel `unknown`.
        // A "not found" record is NOT a rejection — it is a returned marker,
        // handled below.
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
          catch: passthroughError,
        })
      ),
      { concurrency: BATCH_FANOUT_CONCURRENCY }
    )
  )

  // Check for "not found" errors first (these should return 404)
  const notFoundError = validationResults.find((result) => result.error === 'not found')
  if (notFoundError) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for Effect.tryPromise error handling
    throw new NotFoundError('Record not found', notFoundError.recordId)
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
): Effect.Effect<readonly string[], DatabaseError | NotFoundError> {
  return Effect.tryPromise({
    try: () => validateAndFilterRecordsForRestore(tx, tableIdent, recordIds),
    catch: (error) => {
      // Pass the typed absence through UNWRAPPED. Re-wrapping it in a
      // `Validation failed: …` string is what forced `handleBatchRestoreError`
      // to substring-match prose and regex the record id back out of the
      // message; preserving the tag lets the route read `_tag` and `recordId`
      // directly.
      // Unwrap FIRST so both the composed message and the stored `cause`
      // refer to the original driver error, not to the carrier the inner
      // probe tagged it with. Depth here is a tested contract — see
      // `PassthroughError`.
      const original = unwrapPassthrough(error)
      if (original instanceof NotFoundError) return original
      const errorMessage = original instanceof Error ? original.message : 'Unknown error'
      return new DatabaseError(`Validation failed: ${errorMessage}`, original)
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
): Effect.Effect<number, DatabaseError | NotFoundError> {
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
      // `runEffectInTx` re-throws the squashed cause rather than a
      // FiberFailure, so a `NotFoundError` raised during validation arrives
      // here with its identity intact. Preserve it: `wrapDatabaseError` would
      // otherwise flatten it back into a `DatabaseError` and the route
      // would be reduced to substring-matching prose again.
      catch: (error) =>
        error instanceof NotFoundError
          ? error
          : wrapDatabaseError(`Failed to restore records in ${tableName}`)(error),
    })

    yield* logRestoreActivities(session, tableName, restoredRecords)

    return restoredRecords.length
  })
}
