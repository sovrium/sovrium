/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { BatchValidationError } from '@/application/ports/repositories/tables/batch-repository'
import { reportCommittedRows } from '@/application/ports/services/record-change-feed'
import { BusinessRuleViolationError } from '@/domain/errors'
import { DatabaseError } from '@/infrastructure/database'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { columnExists } from '@/infrastructure/database/sql/dialect-introspection'
import { withOutboxTransaction } from '@/infrastructure/webhooks/webhook-outbox-queries'
import { fetchRecordsByIds } from '../mutation-helpers/record-fetch-helpers'
import {
  judgeInTransaction,
  judgePermanentDeleteInTransaction,
} from '../mutation-helpers/rule-judgement'
import { logActivity } from '../query-helpers/activity-log-helpers'
import {
  passthroughError,
  unwrapPassthrough,
  wrapDatabaseError,
  type PassthroughError,
} from '../statement/error-handling'
import { tableIdentifier, databaseTableName } from '../statement/validation'
import { BATCH_FANOUT_CONCURRENCY, deletedRowChanges } from './batch-helpers'
import type { InTransactionRuleJudge } from '@/application/ports/repositories/tables/in-transaction-rule-judge'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'
import type { Dialect, TransactionOn } from '@/infrastructure/database/drizzle/layer'

/**
 * Validate records exist for batch delete.
 *
 * FAN-OUT WIDTH: `BATCH_FANOUT_CONCURRENCY` — one existence probe per
 * `recordId`, so the width is input-size bounded (the caller's batch). Capped
 * rather than left to a raw `Promise.all`; see that constant for why the
 * transaction's single connection makes 2 the right ceiling.
 *
 * ORDER: `Effect.all` preserves array order exactly as `Promise.all` did, so
 * the `recordId` reported below is still the first MISSING id by array
 * position — not whichever probe happened to finish first.
 */
const validateRecordsForDelete = (
  { tx, dialect }: TransactionOn,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Effect.Effect<void, PassthroughError | BatchValidationError> =>
  Effect.forEach(
    recordIds,
    (recordId) =>
      // The `catch` TAGS the rejection into a `PassthroughError` carrier,
      // which `validateRecordsForDeleteWithEffect` unwraps before it
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
            sql`SELECT id FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
          )

          return checkResult.length === 0
            ? { recordId, error: 'not found' as string | undefined }
            : { recordId, error: undefined }
        },
        catch: passthroughError,
      }),
    { concurrency: BATCH_FANOUT_CONCURRENCY }
  ).pipe(
    Effect.flatMap((validationResults) => {
      const firstError = validationResults.find((result) => result.error !== undefined)
      // Absence is a FAILURE here, where the old async version threw. The
      // wording is what the handler below reads to compose `Validation failed:
      // <message>`, and the error itself becomes the `DatabaseError`'s `cause`
      // — where `classifyDriverFailure` walks the chain and finds no driver
      // marker, so it stays `application`-origin exactly as the thrown `Error`
      // did (`driver-failure.test.ts` pins that for this very message). A
      // TAGGED error rather than a global one, for the reason `PassthroughError`
      // gives: an untagged `Error` in a failure channel merges with every other.
      return firstError
        ? Effect.fail(
            new BatchValidationError({ message: `Record ${firstError.recordId} not found` })
          )
        : Effect.void
    })
  )

/**
 * Validate records exist for batch delete with Effect error handling
 */
function validateRecordsForDeleteWithEffect(
  { tx, dialect }: TransactionOn,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Effect.Effect<void, DatabaseError> {
  return validateRecordsForDelete({ tx, dialect }, tableIdent, recordIds).pipe(
    Effect.mapError((error) => {
      // Unwrap FIRST so both the composed message and the stored `cause`
      // refer to the original driver error, not to the carrier the inner
      // probe tagged it with. Depth here is a tested contract — see
      // `PassthroughError`.
      const original = unwrapPassthrough(error)
      const errorMessage = original instanceof Error ? original.message : 'Unknown error'
      return new DatabaseError(`Validation failed: ${errorMessage}`, original)
    })
  )
}

/**
 * Check if table supports soft delete (has deleted_at column)
 */
function checkSoftDeleteSupport(
  { tx, dialect }: TransactionOn,
  tableName: string
): Effect.Effect<boolean, DatabaseError> {
  return Effect.tryPromise({
    try: () => columnExists(dialect.kind, tx, databaseTableName(tableName), 'deleted_at'),
    catch: (error) => new DatabaseError('Failed to check deleted_at column', error),
  })
}

/**
 * Check if table has deleted_by column for authorship tracking
 */
function checkDeletedBySupport(
  { tx, dialect }: TransactionOn,
  tableName: string
): Effect.Effect<boolean, DatabaseError> {
  return Effect.tryPromise({
    try: () => columnExists(dialect.kind, tx, databaseTableName(tableName), 'deleted_by'),
    catch: (error) => new DatabaseError('Failed to check deleted_by column', error),
  })
}

/**
 * Execute delete query (soft or hard delete based on parameters)
 */
function executeDeleteQuery(
  { tx, dialect }: TransactionOn,
  params: {
    readonly tableName: string
    readonly recordIds: readonly string[]
    readonly hasSoftDelete: boolean
    readonly hasDeletedBy: boolean
    readonly permanent: boolean
    readonly userId: string
  }
): Effect.Effect<number, DatabaseError> {
  return Effect.tryPromise({
    try: async () => {
      const tableIdent = tableIdentifier(params.tableName)
      const idParams = sql.join(
        params.recordIds.map((id) => sql`${id}`),
        sql.raw(', ')
      )

      // Determine query type: permanent delete, soft delete, or hard delete (no soft delete support)
      const query = params.permanent
        ? sql`DELETE FROM ${tableIdent} WHERE id IN (${idParams}) RETURNING id`
        : params.hasSoftDelete
          ? params.hasDeletedBy
            ? sql`UPDATE ${tableIdent} SET deleted_at = ${dialect.sql.nowExpr()}, deleted_by = ${params.userId} WHERE id IN (${idParams}) AND deleted_at IS NULL RETURNING id`
            : sql`UPDATE ${tableIdent} SET deleted_at = ${dialect.sql.nowExpr()} WHERE id IN (${idParams}) AND deleted_at IS NULL RETURNING id`
          : sql`DELETE FROM ${tableIdent} WHERE id IN (${idParams}) RETURNING id`

      const result = await executeRawOn(dialect.kind, tx, query)
      return result.length
    },
    catch: (error) => new DatabaseError(`Failed to delete records in ${params.tableName}`, error),
  })
}

/**
 * Log delete activities for all deleted records
 */
function logDeleteActivities(
  db: PortableDb,
  session: Readonly<Session>,
  tableName: string,
  recordsBefore: readonly Record<string, unknown>[]
): Effect.Effect<void, never> {
  return Effect.forEach(recordsBefore, (record) =>
    logActivity(db, {
      session,
      tableName,
      action: 'delete',
      recordId: String(record.id),
      changes: { before: record },
    })
  ).pipe(Effect.asVoid)
}

/**
 * The table's business rules, judged on every row of the batch as this
 * transaction reads it (`rule-judgement.ts`), before any row is removed. A
 * permanent delete judges a row already in the trash as it judges a live one.
 */
const judgedDeletes = (
  on: TransactionOn,
  tableName: string,
  recordIds: readonly string[],
  rules: { readonly judge: InTransactionRuleJudge | undefined; readonly permanent: boolean }
): Effect.Effect<void, BusinessRuleViolationError | DatabaseError> => {
  const { judge } = rules
  if (judge === undefined) return Effect.void
  const judgeRows = rules.permanent ? judgePermanentDeleteInTransaction : judgeInTransaction
  return Effect.tryPromise({
    try: () => judgeRows(on, tableName, recordIds, judge),
    catch: (error) =>
      error instanceof BusinessRuleViolationError
        ? error
        : new DatabaseError(`Failed to read the records of a batch in ${tableName}`, error),
  })
}

/**
 * Batch delete records
 *
 * Deletes multiple records (soft or hard delete based on parameters).
 * Validates all records exist before deleting any.
 * Rolls back if any record is not found.
 * Permissions applied via application layer.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordIds - Array of record IDs to delete
 * @param options - `permanent`: hard delete, else soft delete (if supported);
 *   `judge`: the table's business rules, judged on the rows inside the transaction
 * @returns Effect resolving to number of deleted records
 */
export const batchDeleteRecords =
  (db: PortableDb, dialect: Dialect) =>
  (
    session: Readonly<Session>,
    tableName: string,
    recordIds: readonly string[],
    options: {
      readonly permanent?: boolean | undefined
      readonly judge?: InTransactionRuleJudge | undefined
    } = {}
  ): Effect.Effect<number, DatabaseError | BusinessRuleViolationError> => {
    const { permanent = false, judge } = options
    const wrap = wrapDatabaseError(`Failed to delete records in ${tableName}`)
    return Effect.gen(function* () {
      const { deletedCount, recordsBefore } = yield* withOutboxTransaction(
        { client: db, dialect },

        (deleted: { readonly recordsBefore: readonly Record<string, unknown>[] }) =>
          deletedRowChanges(tableName)(deleted.recordsBefore)
      )(
        (tx) =>
          Effect.gen(function* () {
            const tableIdent = tableIdentifier(tableName)

            yield* judgedDeletes({ tx, dialect }, tableName, recordIds, { judge, permanent })
            yield* validateRecordsForDeleteWithEffect({ tx, dialect }, tableIdent, recordIds)

            const before = yield* fetchRecordsByIds({ tx, dialect }, tableName, recordIds)
            const hasSoftDelete = yield* checkSoftDeleteSupport({ tx, dialect }, tableName)
            const hasDeletedBy = yield* checkDeletedBySupport({ tx, dialect }, tableName)

            const count = yield* executeDeleteQuery(
              { tx, dialect },
              {
                tableName,
                recordIds,
                hasSoftDelete,
                hasDeletedBy,
                permanent,
                userId: session.userId,
              }
            )

            return { deletedCount: count, recordsBefore: before }
          }),
        (error) => (error instanceof BusinessRuleViolationError ? error : wrap(error))
      )

      yield* logDeleteActivities(db, session, tableName, recordsBefore)
      yield* reportCommittedRows(deletedRowChanges(tableName)(recordsBefore))

      return deletedCount
    })
  }
