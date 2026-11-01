/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { reportCommittedRows } from '@/application/ports/services/record-change-feed'
import { BusinessRuleViolationError, UniqueConstraintViolationError } from '@/domain/errors'
import { NotFoundError, DatabaseError, type PortableTx } from '@/infrastructure/database'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { withOutboxTransaction } from '@/infrastructure/webhooks/webhook-outbox-queries'
import { findRestoreUniqueConflict } from '../mutation-helpers/restore-unique-conflict'
import { judgeRestoreInTransaction } from '../mutation-helpers/rule-judgement'
import { logActivity } from '../query-helpers/activity-log-helpers'
import {
  passthroughError,
  unwrapPassthrough,
  wrapDatabaseError,
  type PassthroughError,
} from '../statement/error-handling'
import { tableIdentifier } from '../statement/validation'
import { BATCH_FANOUT_CONCURRENCY, insertedRowChanges } from './batch-helpers'
import type { InTransactionRuleJudge } from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { Dialect, TransactionOn } from '@/infrastructure/database/drizzle/layer'

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
const validateAndFilterRecordsForRestore = (
  { tx, dialect }: TransactionOn,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Effect.Effect<readonly string[], PassthroughError | NotFoundError> =>
  Effect.forEach(
    recordIds,
    (recordId) =>
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
          const checkResult = await executeRawOn(
            dialect.kind,
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
      }),
    { concurrency: BATCH_FANOUT_CONCURRENCY }
  ).pipe(
    Effect.flatMap((validationResults) => {
      // Check for "not found" errors first (these should return 404)
      const notFoundError = validationResults.find((result) => result.error === 'not found')
      if (notFoundError) {
        return Effect.fail(new NotFoundError('Record not found', notFoundError.recordId))
      }

      // Filter to only records that are actually soft-deleted (skip active records)
      return Effect.succeed(
        validationResults.filter((result) => result.isDeleted).map((result) => result.recordId)
      )
    })
  )

/**
 * Validate and filter records for restore with Effect error handling
 * Returns array of record IDs that are actually soft-deleted
 */
function validateAndFilterRecordsWithEffect(
  { tx, dialect }: TransactionOn,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Effect.Effect<readonly string[], DatabaseError | NotFoundError> {
  return validateAndFilterRecordsForRestore({ tx, dialect }, tableIdent, recordIds).pipe(
    Effect.mapError((error) => {
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
    })
  )
}

/**
 * Execute restore query using parameterized IN clause
 */
function executeRestoreQuery(
  { tx, dialect }: TransactionOn,
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
      const result = await executeRawOn(
        dialect.kind,
        tx,
        sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id IN (${idParams}) RETURNING *`
      )
      return result
    },
    catch: (error) => new DatabaseError(`Failed to restore records in ${tableName}`, error),
  })
}

/**
 * Fail with the unique field a restore of `recordIds` would duplicate, if any.
 */
const refuseUniqueConflict = (
  tx: Readonly<PortableTx>,
  dialect: Dialect,
  tableName: string,
  recordIds: readonly string[]
): Effect.Effect<void, DatabaseError | UniqueConstraintViolationError> =>
  Effect.tryPromise({
    try: () => findRestoreUniqueConflict(tx, dialect, tableName, recordIds),
    catch: (error) => new DatabaseError(`Failed to restore records in ${tableName}`, error),
  }).pipe(
    Effect.flatMap((field) =>
      field === undefined
        ? Effect.void
        : Effect.fail(
            new UniqueConstraintViolationError(
              'Restore duplicates a unique value',
              undefined,
              field
            )
          )
    )
  )

/**
 * The table's business rules, judged on every record of the batch as this
 * transaction reads it in the trash, as it will stand restored
 * (`rule-judgement.ts`) — before any is restored. A refusal fails the whole batch.
 */
const judgedRestore = (
  on: TransactionOn,
  tableName: string,
  recordIds: readonly string[],
  judge: InTransactionRuleJudge | undefined
): Effect.Effect<void, BusinessRuleViolationError | DatabaseError> =>
  judge === undefined
    ? Effect.void
    : Effect.tryPromise({
        try: () => judgeRestoreInTransaction(on, tableName, recordIds, judge),
        catch: (error) =>
          error instanceof BusinessRuleViolationError
            ? error
            : new DatabaseError(`Failed to read the records of a restore in ${tableName}`, error),
      })

/**
 * Log restore activities for all restored records
 */
function logRestoreActivities(
  db: PortableDb,
  session: Readonly<Session>,
  tableName: string,
  restoredRecords: readonly Record<string, unknown>[]
): Effect.Effect<void, never> {
  return Effect.forEach(restoredRecords, (record) =>
    logActivity(db, {
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
 * @param options - the table's business rules, judged inside the transaction
 * @returns Effect resolving to number of restored records or error
 */
export const batchRestoreRecords =
  (db: PortableDb, dialect: Dialect) =>
  (
    session: Readonly<Session>,
    tableName: string,
    recordIds: readonly string[],
    options: { readonly judge?: InTransactionRuleJudge | undefined } = {}
  ): Effect.Effect<
    number,
    DatabaseError | NotFoundError | UniqueConstraintViolationError | BusinessRuleViolationError
  > => {
    return Effect.gen(function* () {
      // A restored row comes back into view: announced (and owed) as an insert.
      const restoredRecords = yield* withOutboxTransaction(
        { client: db, dialect },
        insertedRowChanges(tableName)
      )(
        (tx) =>
          Effect.gen(function* () {
            const tableIdent = tableIdentifier(tableName)

            // The rules first, behind each record's lock: a refusal restores none.
            yield* judgedRestore({ tx, dialect }, tableName, recordIds, options.judge)

            // Validate and filter to only soft-deleted records
            const deletedRecordIds = yield* validateAndFilterRecordsWithEffect(
              { tx, dialect },
              tableIdent,
              recordIds
            )

            // If no records to restore, return empty array
            if (deletedRecordIds.length === 0) {
              return [] as readonly Record<string, unknown>[]
            }

            // A batch that would duplicate a unique value — with a live record, or
            // between two of its own records — is refused whole, before any write.
            yield* refuseUniqueConflict(tx, dialect, tableName, deletedRecordIds)

            // Restore only the filtered soft-deleted records
            return yield* executeRestoreQuery(
              { tx, dialect },
              tableIdent,
              tableName,
              deletedRecordIds
            )
          }),
        // `withTransaction` re-throws the squashed cause rather than a
        // FiberFailure, so a `NotFoundError` raised during validation arrives
        // here with its identity intact. Preserve it: `wrapDatabaseError` would
        // otherwise flatten it back into a `DatabaseError` and the route
        // would be reduced to substring-matching prose again.
        (error) =>
          error instanceof NotFoundError ||
          error instanceof UniqueConstraintViolationError ||
          error instanceof BusinessRuleViolationError
            ? error
            : wrapDatabaseError(`Failed to restore records in ${tableName}`)(error)
      )

      yield* logRestoreActivities(db, session, tableName, restoredRecords)
      yield* reportCommittedRows(insertedRowChanges(tableName)(restoredRecords))

      return restoredRecords.length
    })
  }
