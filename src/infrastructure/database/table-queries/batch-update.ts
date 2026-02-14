/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  db,
  SessionContextError,
  ValidationError,
  type DrizzleTransaction,
} from '@/infrastructure/database'
import { logActivity } from './activity-log-helpers'
import { runEffectInTx } from './batch-helpers'
import { validateTableName, validateColumnName } from './validation'
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
 * Fetch record before update for activity logging
 */
function fetchRecordBeforeUpdate(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | undefined, never> {
  return Effect.tryPromise({
    try: async () => {
      const result = (await tx.execute(
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id = ${recordId} LIMIT 1`
      )) as readonly Record<string, unknown>[]
      return result[0]
    },
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined))
}

/**
 * Inject updated_by field into record fields for updates
 */
function injectUpdatedByField(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  userId: string,
  fields: Readonly<Record<string, unknown>>
): Effect.Effect<Record<string, unknown>, never> {
  return Effect.tryPromise({
    try: async () => {
      // Query table schema to check for updated_by column
      const schemaQuery = await tx.execute(
        sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'updated_by'`
      )
      const columnNames = new Set(
        (schemaQuery as unknown as readonly { column_name: string }[]).map((row) => row.column_name)
      )

      const hasUpdatedBy = columnNames.has('updated_by')

      // Build new fields object with updated_by metadata (immutable approach)
      // When userId is 'guest' (no auth configured), set updated_by to NULL
      // eslint-disable-next-line unicorn/no-null -- NULL is intentional for database columns when no auth configured
      const authorUserId = userId === 'guest' ? null : userId
      return {
        ...fields,
        ...(hasUpdatedBy ? { updated_by: authorUserId } : {}),
      }
    },
    catch: () => fields, // Fallback to original fields on error
  }).pipe(Effect.orElseSucceed(() => fields))
}

/**
 * Build UPDATE SET clause with validated column names
 */
function buildUpdateSetClause(
  fields: Readonly<Record<string, unknown>>
): Readonly<ReturnType<typeof sql.join>> {
  const entries = Object.entries(fields)
  const setClauses = entries.map(([key, value]) => {
    validateColumnName(key)
    return sql`${sql.identifier(key)} = ${value}`
  })
  return sql.join(setClauses, sql.raw(', '))
}

/**
 * Execute UPDATE query and return updated record
 */
function executeRecordUpdate(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  setClause: Readonly<ReturnType<typeof sql.join>>
): Effect.Effect<Record<string, unknown> | undefined, ValidationError> {
  return Effect.tryPromise({
    try: async () => {
      const result = (await tx.execute(
        sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
      )) as readonly Record<string, unknown>[]
      return result[0]
    },
    catch: (error) => {
      // PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
      // 23502 = not_null_violation
      const pgError = error as { code?: string; message?: string; constraint?: string }
      if (pgError.code === '23502' || pgError.message?.includes('null value in column')) {
        // Extract field name from error message if possible
        const fieldMatch = pgError.message?.match(/column "([^"]+)"/)
        const fieldName: string = fieldMatch?.[1] ?? 'unknown'
        return new ValidationError(`Cannot set required field '${fieldName}' to null`, [
          { record: 0, field: fieldName, error: 'Required field cannot be null' },
        ])
      }
      // For other errors, return generic validation error
      const errorMessage: string =
        pgError.message !== undefined
          ? pgError.message
          : 'Update failed due to constraint violation'
      return new ValidationError(errorMessage, [])
    },
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
): Effect.Effect<Record<string, unknown> | undefined, ValidationError> {
  return Effect.gen(function* () {
    const fieldsToUpdate = extractFieldsFromUpdate(update)
    const entries = Object.entries(fieldsToUpdate)

    if (entries.length === 0) return undefined

    const recordBefore = yield* fetchRecordBeforeUpdate(tx, tableName, update.id)

    // Inject updated_by field for authorship metadata
    const fieldsWithAuthorship = yield* injectUpdatedByField(
      tx,
      tableName,
      session.userId,
      fieldsToUpdate
    )

    const setClause = buildUpdateSetClause(fieldsWithAuthorship)
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
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError | ValidationError> {
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
    catch: (error) =>
      error instanceof SessionContextError
        ? error
        : error instanceof ValidationError
          ? error
          : new SessionContextError(`Failed to batch update records in ${tableName}`, error),
  })
}
