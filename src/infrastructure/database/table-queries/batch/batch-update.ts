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
  type ValidationError,
  type DrizzleTransaction,
  type DatabaseError,
} from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { injectUpdateAuthorship } from '../mutation-helpers/authorship-helpers'
import { resolveArrayColumnTypes } from '../mutation-helpers/column-value-encoding'
import { fetchRecordByIdEffect } from '../mutation-helpers/record-fetch-helpers'
import { buildUpdateSetClauseCRUD } from '../mutation-helpers/update-helpers'
import { logActivity } from '../query-helpers/activity-log-helpers'
import { wrapDatabaseErrorWithValidation, wrapWriteStatementError } from '../shared/error-handling'
import { validateTableName } from '../shared/validation'
import { runEffectInTx } from './batch-helpers'
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
        sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
      )
      return result[0]
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
): Effect.Effect<Record<string, unknown> | undefined, DatabaseError | ValidationError> {
  return Effect.gen(function* () {
    const fieldsToUpdate = extractFieldsFromUpdate(update)

    if (Object.keys(fieldsToUpdate).length === 0) return undefined

    // Inject updated_by authorship metadata
    const fieldsWithAuthorship = yield* Effect.promise(() =>
      injectUpdateAuthorship(fieldsToUpdate, session.userId, tx, tableName)
    )

    const entries = Object.entries(fieldsWithAuthorship)
    const recordBefore = yield* fetchRecordByIdEffect(tx, tableName, update.id)
    // Same resolution every other write path performs, and for the same reason:
    // a `text[]` column needs a native array literal, a `jsonb` one needs JSON,
    // and PostgreSQL rejects the wrong choice outright.
    const arrayColumnTypes = yield* Effect.promise(() =>
      resolveArrayColumnTypes(tx, tableName, [fieldsWithAuthorship])
    )
    const setClause = buildUpdateSetClauseCRUD(entries, arrayColumnTypes)
    const updatedRecord = yield* executeRecordUpdate(tx, tableName, update.id, setClause)

    if (updatedRecord) {
      yield* logActivity({
        session,
        tableName,
        action: 'update',
        recordId: String(update.id),
        changes: { before: recordBefore, after: updatedRecord },
      })
      return updatedRecord
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
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)

        return await runEffectInTx(
          // Process updates sequentially with immutable array building
          Effect.reduce(updates, [] as readonly Record<string, unknown>[], (acc, update) =>
            updateSingleRecordInBatch(tx, tableName, session, update).pipe(
              Effect.map((record) => (record ? [...acc, record] : acc))
            )
          )
        )
      }),
    catch: wrapDatabaseErrorWithValidation(`Failed to batch update records in ${tableName}`),
  })
}
