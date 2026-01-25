/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { withSessionContext, SessionContextError, ForbiddenError } from '@/infrastructure/database'
import { validateTableName, validateColumnName } from './validation'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Helper to create a single record within a transaction
 */
async function createSingleRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  tx: Readonly<any>,
  tableName: string,
  fields: Record<string, unknown>
): Promise<Record<string, unknown> | undefined> {
  // Build entries from user fields
  const entries = Object.entries(fields)
  if (entries.length === 0) return undefined

  // Build column identifiers and values
  const columnIdentifiers = entries.map(([key]) => {
    validateColumnName(key)
    return sql.identifier(key)
  })
  const valueParams = entries.map(([, value]) => sql`${value}`)

  const columnsClause = sql.join(columnIdentifiers, sql.raw(', '))
  const valuesClause = sql.join(valueParams, sql.raw(', '))

  const result = (await tx.execute(
    sql`INSERT INTO ${sql.identifier(tableName)} (${columnsClause}) VALUES (${valuesClause}) RETURNING *`
  )) as readonly Record<string, unknown>[]

  return result[0] ?? undefined
}

/**
 * Batch create records with session context
 *
 * Creates multiple records in a single transaction.
 * RLS policies automatically applied via session context.
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
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)

        if (recordsData.length === 0) {
          // eslint-disable-next-line functional/no-throw-statements -- Validation requires throwing for empty batch
          throw new Error('Cannot create batch with no records')
        }

        const recordResults = await recordsData.reduce(
          async (accPromise, fields) => {
            const acc = await accPromise
            const record = await createSingleRecord(tx, tableName, fields)
            return record ? [...acc, record] : acc
          },
          Promise.resolve([] as readonly Record<string, unknown>[])
        )

        return recordResults
      },
      catch: (error) =>
        new SessionContextError(`Failed to batch create records in ${tableName}`, error),
    })
  )
}

/**
 * Check if user has permission to restore records
 */
async function checkRestorePermission(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  tx: any
): Promise<void> {
  const roleResult = (await tx.execute(
    sql`SELECT current_setting('app.user_role', true) as role`
  )) as Array<{ role: string | null }>

  const userRole = roleResult[0]?.role
  if (userRole === 'viewer') {
    // eslint-disable-next-line functional/no-throw-statements -- Required for Effect.tryPromise error handling
    throw new ForbiddenError('You do not have permission to restore records in this table')
  }
}

/**
 * Validate records exist and are soft-deleted
 */
async function validateRecordsForRestore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  tx: any,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Promise<void> {
  const validationResults = await Promise.all(
    recordIds.map(async (recordId) => {
      const checkResult = (await tx.execute(
        sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
      )) as readonly Record<string, unknown>[]

      if (checkResult.length === 0) {
        return { recordId, error: 'not found' }
      }

      const record = checkResult[0]
      if (!record?.deleted_at) {
        return { recordId, error: 'not deleted' }
      }

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
 * Batch restore soft-deleted records with session context
 *
 * Restores multiple soft-deleted records in a transaction.
 * Validates all records exist and are soft-deleted before restoring any.
 * Rolls back if any record fails validation.
 * RLS policies automatically applied via session context.
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
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)
        const tableIdent = sql.identifier(tableName)

        // eslint-disable-next-line functional/no-expression-statements -- Permission check with side effects
        await checkRestorePermission(tx)
        // eslint-disable-next-line functional/no-expression-statements -- Validation function with side effects
        await validateRecordsForRestore(tx, tableIdent, recordIds)

        // All records validated - restore them all using parameterized IN clause
        const idParams = sql.join(
          recordIds.map((id) => sql`${id}`),
          sql.raw(', ')
        )
        const result = (await tx.execute(
          sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id IN (${idParams}) RETURNING id`
        )) as readonly Record<string, unknown>[]

        return result.length
      },
      catch: (error) => {
        // Re-throw ForbiddenError unchanged (authorization failure)
        if (error instanceof Error && error.name === 'ForbiddenError') {
          return new ForbiddenError(error.message)
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return new SessionContextError(
          `Failed to batch restore records in ${tableName}: ${errorMessage}`,
          error
        )
      },
    })
  )
}

/**
 * Batch update records with session context
 *
 * Updates multiple records in a transaction with RLS policy enforcement.
 * Only records the user has permission to update will be affected.
 * Records without permission are silently skipped (RLS behavior).
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param updates - Array of records with id and fields to update (supports both nested and flat format)
 * @returns Effect resolving to array of updated records
 */
export function batchUpdateRecords(
  session: Readonly<Session>,
  tableName: string,
  updates: readonly { readonly id: string; readonly [key: string]: unknown }[]
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)

        // Update each record individually with RLS enforcement
        const updatedRecords = await Promise.all(
          updates.map(async (update) => {
            // Extract fields - handle both nested format { id, fields: {...} } and flat format { id, ...fields }
            const { id, fields: nestedFields, ...flatFields } = update
            // If 'fields' property exists (nested format), use it; otherwise use flat fields
            const fieldsToUpdate =
              nestedFields && typeof nestedFields === 'object' && !Array.isArray(nestedFields)
                ? (nestedFields as Record<string, unknown>)
                : flatFields

            const entries = Object.entries(fieldsToUpdate)

            if (entries.length === 0) {
              // eslint-disable-next-line unicorn/no-null -- Null for skipped records
              return null
            }

            // Build SET clause with validated columns and parameterized values
            const setClauses = entries.map(([key, value]) => {
              validateColumnName(key)
              return sql`${sql.identifier(key)} = ${value}`
            })
            const setClause = sql.join(setClauses, sql.raw(', '))

            const query = sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${id} RETURNING *`

            try {
              const result = (await tx.execute(query)) as readonly Record<string, unknown>[]

              // If RLS blocked the update, result will be empty - skip this record
              // eslint-disable-next-line unicorn/no-null -- Null for records blocked by RLS
              return result[0] ?? null
            } catch {
              // If update fails (e.g., RLS policy), skip this record
              // eslint-disable-next-line unicorn/no-null -- Null for failed updates
              return null
            }
          })
        )

        // Filter out null values (records blocked by RLS or failed updates)
        return updatedRecords.filter((record): record is Record<string, unknown> => record !== null)
      },
      catch: (error) =>
        new SessionContextError(`Failed to batch update records in ${tableName}`, error),
    })
  )
}

/**
 * Batch delete records with session context
 *
 * Deletes multiple records (soft or hard delete based on deleted_at field).
 * RLS policies automatically enforced via session context.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordIds - Array of record IDs to delete
 * @returns Effect resolving to number of deleted records
 */
export function batchDeleteRecords(
  session: Readonly<Session>,
  tableName: string,
  recordIds: readonly string[]
): Effect.Effect<number, SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)
        const tableIdent = sql.identifier(tableName)

        // Check if table has deleted_at column for soft delete
        const columnCheck = (await tx.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_at'`
        )) as readonly Record<string, unknown>[]

        // Build parameterized IN clause
        const idParams = sql.join(
          recordIds.map((id) => sql`${id}`),
          sql.raw(', ')
        )

        if (columnCheck.length > 0) {
          // Soft delete: set deleted_at timestamp
          const result = (await tx.execute(
            sql`UPDATE ${tableIdent} SET deleted_at = NOW() WHERE id IN (${idParams}) RETURNING id`
          )) as readonly Record<string, unknown>[]

          return result.length
        } else {
          // Hard delete: remove records
          const result = (await tx.execute(
            sql`DELETE FROM ${tableIdent} WHERE id IN (${idParams}) RETURNING id`
          )) as readonly Record<string, unknown>[]

          return result.length
        }
      },
      catch: (error) =>
        new SessionContextError(`Failed to batch delete records in ${tableName}`, error),
    })
  )
}
