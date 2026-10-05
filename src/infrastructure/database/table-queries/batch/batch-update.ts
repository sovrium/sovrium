/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  reportCommittedRows,
  type CommittedRowChange,
} from '@/application/ports/services/record-change-feed'
import {
  db,
  type ValidationError,
  type DrizzleTransaction,
  type DatabaseError,
} from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { withTransaction } from '@/infrastructure/database/transaction'
import { injectUpdateAuthorship } from '../mutation-helpers/authorship-helpers'
import { resolveArrayColumnTypes } from '../mutation-helpers/column-value-encoding'
import { fetchRecordByIdEffect, rowAfterTriggers } from '../mutation-helpers/record-fetch-helpers'
import { buildUpdateSetClauseCRUD } from '../mutation-helpers/update-helpers'
import { logCommittedRowChanges } from '../query-helpers/activity-log-helpers'
import {
  wrapDatabaseErrorWithValidation,
  wrapWriteStatementError,
} from '../statement/error-handling'
import { tableIdentifier } from '../statement/validation'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Extract fields from update object (requires nested format)
 */
function extractFieldsFromUpdate(update: {
  readonly id: string
  readonly fields?: Readonly<Record<string, unknown>>
}): Readonly<Record<string, unknown>> {
  // Return fields property or empty object if not provided
  return update.fields ?? {}
}

/**
 * Execute UPDATE query and return updated record.
 *
 * The catch is the SHARED write-statement handler — the same one the batch
 * INSERT uses. This site previously carried its own near-copy of it, so fixing
 * one would have left the other leaking. Its NOT NULL branch additionally
 * regexed the column out of the driver message and put it in BOTH the message
 * and a `details` entry, which disclosed schema even on the arm that was
 * working as designed; the branch was in any case unreachable on either engine.
 */
function executeRecordUpdate(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  setClause: Readonly<ReturnType<typeof sql.join>>
): Effect.Effect<Record<string, unknown> | undefined, DatabaseError | ValidationError> {
  return Effect.tryPromise({
    try: async () => {
      const result = await executeRaw(
        tx,
        sql`UPDATE ${tableIdentifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
      )
      const [updated] = result
      return updated === undefined
        ? undefined
        : { ...(await rowAfterTriggers(tx, tableName, updated)) }
    },
    catch: wrapWriteStatementError(`Failed to update a batch record in ${tableName}`),
  })
}

/**
 * Update a single record within a batch operation
 */
function updateSingleRecordInBatch(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  session: Readonly<Session>,
  update: { readonly id: string; readonly fields?: Record<string, unknown> }
): Effect.Effect<CommittedRowChange | undefined, DatabaseError | ValidationError> {
  return Effect.gen(function* () {
    const fieldsToUpdate = extractFieldsFromUpdate(update)

    if (Object.keys(fieldsToUpdate).length === 0) return undefined

    // Inject updated_by authorship metadata
    // Both of the next two are DATABASE round trips on the transaction — the
    // authorship lookup and the column-type resolution — and both were declared
    // infallible. A rejection there became a defect that skipped this
    // function's own error mapping, so a driver failure mid-batch bypassed the
    // constraint-to-validation translation every other write path gets.
    const fieldsWithAuthorship = yield* Effect.tryPromise({
      try: () => injectUpdateAuthorship(fieldsToUpdate, session.userId, tx, tableName),
      catch: wrapWriteStatementError(
        `Failed to resolve authorship for a batch update in ${tableName}`
      ),
    })

    const entries = Object.entries(fieldsWithAuthorship)
    const recordBefore = yield* fetchRecordByIdEffect(tx, tableName, update.id)
    // Same resolution every other write path performs, and for the same reason:
    // a `text[]` column needs a native array literal, a `jsonb` one needs JSON,
    // and PostgreSQL rejects the wrong choice outright.
    const arrayColumnTypes = yield* Effect.tryPromise({
      try: () => resolveArrayColumnTypes(tx, tableName, [fieldsWithAuthorship]),
      catch: wrapWriteStatementError(
        `Failed to resolve column types for a batch update in ${tableName}`
      ),
    })
    const setClause = buildUpdateSetClauseCRUD(entries, arrayColumnTypes)
    const updatedRecord = yield* executeRecordUpdate(tx, tableName, update.id, setClause)

    if (updatedRecord) {
      return {
        tableName,
        event: 'update',
        recordId: String(update.id),
        row: updatedRecord,
        previous: recordBefore,
      }
    }

    return undefined
  })
}

/**
 * Batch update records
 *
 * Updates multiple records in a transaction with permission enforcement.
 * Only records the user has permission to update will be affected.
 * Records without permission are silently skipped.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param updates - Array of records with id and fields to update (requires nested format)
 * @returns Effect resolving to array of updated records
 */
export function batchUpdateRecords(
  session: Readonly<Session>,
  tableName: string,
  updates: readonly { readonly id: string; readonly fields?: Record<string, unknown> }[]
): Effect.Effect<readonly Record<string, unknown>[], DatabaseError | ValidationError> {
  return Effect.gen(function* () {
    const committed = yield* withTransaction(
      db,
      (tx) =>
        // Process updates sequentially with immutable array building
        Effect.reduce(
          updates,
          () => [] as readonly CommittedRowChange[],
          (acc, update) =>
            updateSingleRecordInBatch(tx, tableName, session, update).pipe(
              Effect.map((change) => (change ? [...acc, change] : acc))
            )
        ),
      wrapDatabaseErrorWithValidation(`Failed to batch update records in ${tableName}`)
    )
    // Logged and reported once the transaction has committed — a rolled-back
    // batch changed nothing.
    yield* logCommittedRowChanges(session, committed)
    yield* reportCommittedRows(committed)
    return committed.flatMap((change) => (change.row === undefined ? [] : [{ ...change.row }]))
  })
}
