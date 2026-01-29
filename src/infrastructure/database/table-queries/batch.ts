/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { withSessionContext, SessionContextError, ForbiddenError } from '@/infrastructure/database'
import { logActivity } from './activity-log-helpers'
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
    Effect.gen(function* () {
      validateTableName(tableName)

      if (recordsData.length === 0) {
        return yield* Effect.fail(
          new SessionContextError('Cannot create batch with no records', undefined)
        )
      }

      // Process records sequentially with immutable array building
      const createdRecords = yield* Effect.reduce(
        recordsData,
        [] as readonly Record<string, unknown>[],
        (acc, fields) =>
          Effect.gen(function* () {
            const record = yield* Effect.tryPromise({
              try: async () => {
                const result = await createSingleRecord(tx, tableName, fields)
                return result
              },
              catch: (error) =>
                new SessionContextError(`Failed to create record in ${tableName}`, error),
            })

            if (record) {
              // Log activity for created record
              yield* logActivity({
                session,
                tableName,
                action: 'create',
                recordId: String(record.id),
                changes: { after: record },
              })

              return [...acc, record]
            }

            return acc
          })
      )

      return createdRecords
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
/**
 * Check restore permission with Effect error handling
 */
function checkRestorePermissionWithEffect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  tx: any
): Effect.Effect<void, SessionContextError | ForbiddenError> {
  return Effect.tryPromise({
    try: () => checkRestorePermission(tx),
    catch: (error) => {
      if (error instanceof Error && error.name === 'ForbiddenError') {
        return new ForbiddenError(error.message)
      }
      return new SessionContextError('Permission check failed', error)
    },
  })
}

/**
 * Validate records for restore with Effect error handling
 */
function validateRecordsForRestoreWithEffect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  tx: any,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  tx: any,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  tableName: string,
  recordIds: readonly string[]
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const idParams = sql.join(
        recordIds.map((id) => sql`${id}`),
        sql.raw(', ')
      )
      const result = (await tx.execute(
        sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id IN (${idParams}) RETURNING *`
      )) as readonly Record<string, unknown>[]
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

export function batchRestoreRecords(
  session: Readonly<Session>,
  tableName: string,
  recordIds: readonly string[]
): Effect.Effect<number, SessionContextError | ForbiddenError> {
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      validateTableName(tableName)
      const tableIdent = sql.identifier(tableName)

      yield* checkRestorePermissionWithEffect(tx)
      yield* validateRecordsForRestoreWithEffect(tx, tableIdent, recordIds)

      const restoredRecords = yield* executeRestoreQuery(tx, tableIdent, tableName, recordIds)

      yield* logRestoreActivities(session, tableName, restoredRecords)

      return restoredRecords.length
    })
  )
}
/**
 * Extract fields from update object (handles both nested and flat formats)
 */
function extractFieldsFromUpdate(update: {
  readonly id: string
  readonly [key: string]: unknown
}): Record<string, unknown> {
  const { id: _id, fields: nestedFields, ...flatFields } = update
  // If 'fields' property exists (nested format), use it; otherwise use flat fields
  return nestedFields && typeof nestedFields === 'object' && !Array.isArray(nestedFields)
    ? (nestedFields as Record<string, unknown>)
    : flatFields
}

/**
 * Fetch record before update for activity logging
 */
function fetchRecordBeforeUpdate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  tx: any,
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
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))
}

/**
 * Build UPDATE SET clause with validated column names
 */
function buildUpdateSetClause(
  fields: Record<string, unknown>
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  tx: any,
  tableName: string,
  recordId: string,
  setClause: Readonly<ReturnType<typeof sql.join>>
): Effect.Effect<Record<string, unknown> | undefined, never> {
  return Effect.tryPromise({
    try: async () => {
      const result = (await tx.execute(
        sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
      )) as readonly Record<string, unknown>[]
      return result[0]
    },
    catch: () => undefined,
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))
}

/**
 * Update a single record within a batch operation
 */
function updateSingleRecordInBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  tx: any,
  tableName: string,
  session: Readonly<Session>,
  update: { readonly id: string; readonly [key: string]: unknown }
): Effect.Effect<Record<string, unknown> | undefined, never> {
  return Effect.gen(function* () {
    const fieldsToUpdate = extractFieldsFromUpdate(update)
    const entries = Object.entries(fieldsToUpdate)

    if (entries.length === 0) return undefined

    const recordBefore = yield* fetchRecordBeforeUpdate(tx, tableName, update.id)
    const setClause = buildUpdateSetClause(fieldsToUpdate)
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
    Effect.gen(function* () {
      validateTableName(tableName)

      // Process updates sequentially with immutable array building
      const updatedRecords = yield* Effect.reduce(
        updates,
        [] as readonly Record<string, unknown>[],
        (acc, update) =>
          updateSingleRecordInBatch(tx, tableName, session, update).pipe(
            Effect.map((record) => (record ? [...acc, record] : acc))
          )
      )

      return updatedRecords
    })
  )
}

/**
 * Validate records exist for batch delete
 */
async function validateRecordsForDelete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type from db.transaction callback
  tx: any,
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
    // eslint-disable-next-line functional/no-throw-statements -- Required for Effect.tryPromise error handling
    throw new Error(`Record ${firstError.recordId} not found`)
  }
}

/**
 * Validate records exist for batch delete with Effect error handling
 */
function validateRecordsForDeleteWithEffect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
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

/**
 * Fetch records before deletion for activity logging
 */
function fetchRecordsBeforeDelete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tableIdent: Readonly<ReturnType<typeof sql.identifier>>,
  recordIds: readonly string[]
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const idParams = sql.join(
        recordIds.map((id) => sql`${id}`),
        sql.raw(', ')
      )
      const result = (await tx.execute(
        sql`SELECT * FROM ${tableIdent} WHERE id IN (${idParams})`
      )) as readonly Record<string, unknown>[]
      return result
    },
    catch: (error) => new SessionContextError('Failed to fetch records before deletion', error),
  })
}

/**
 * Check if table supports soft delete (has deleted_at column)
 */
function checkSoftDeleteSupport(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
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

/**
 * Execute delete query (soft or hard delete based on deleted_at column)
 */
function executeDeleteQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tableName: string,
  recordIds: readonly string[],
  hasSoftDelete: boolean
): Effect.Effect<number, SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const tableIdent = sql.identifier(tableName)
      const idParams = sql.join(
        recordIds.map((id) => sql`${id}`),
        sql.raw(', ')
      )
      const query = hasSoftDelete
        ? sql`UPDATE ${tableIdent} SET deleted_at = NOW() WHERE id IN (${idParams}) RETURNING id`
        : sql`DELETE FROM ${tableIdent} WHERE id IN (${idParams}) RETURNING id`
      const result = (await tx.execute(query)) as readonly Record<string, unknown>[]
      return result.length
    },
    catch: (error) => new SessionContextError(`Failed to delete records in ${tableName}`, error),
  })
}

/**
 * Log delete activities for all deleted records
 */
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

/**
 * Batch delete records with session context
 *
 * Deletes multiple records (soft or hard delete based on deleted_at field).
 * Validates all records exist before deleting any.
 * Rolls back if any record is not found.
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
    Effect.gen(function* () {
      validateTableName(tableName)
      const tableIdent = sql.identifier(tableName)

      yield* validateRecordsForDeleteWithEffect(tx, tableIdent, recordIds)

      const recordsBefore = yield* fetchRecordsBeforeDelete(tx, tableIdent, recordIds)
      const hasSoftDelete = yield* checkSoftDeleteSupport(tx, tableName)

      const deletedCount = yield* executeDeleteQuery(tx, tableName, recordIds, hasSoftDelete)

      yield* logDeleteActivities(session, tableName, recordsBefore)

      return deletedCount
    })
  )
}
