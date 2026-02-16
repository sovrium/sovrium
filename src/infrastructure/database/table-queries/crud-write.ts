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
  UniqueConstraintViolationError,
  type DrizzleTransaction,
} from '@/infrastructure/database'
import { logActivity } from './activity-log-helpers'
import { buildInsertClauses, isUniqueConstraintViolation } from './create-record-helpers'
import {
  cascadeSoftDelete,
  fetchRecordBeforeDeletion,
  executeSoftDelete,
  executeHardDelete,
  checkDeletedAtColumn,
} from './delete-helpers'
import {
  validateFieldsNotEmpty,
  fetchRecordBeforeUpdateCRUD,
  buildUpdateSetClauseCRUD,
  executeRecordUpdateCRUD,
} from './update-helpers'
import { validateTableName } from './validation'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Inject authorship metadata fields (created_by and updated_by) into record fields for INSERT
 * On creation, both created_by and updated_by are set to the same user ID
 *
 * @param fields - Original record fields
 * @param userId - User ID from session
 * @param tx - Database transaction
 * @param tableName - Table name
 * @returns Fields with authorship metadata injected
 */
async function injectAuthorshipFields(
  fields: Readonly<Record<string, unknown>>,
  userId: string,
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<Record<string, unknown>> {
  // Query table schema to check for authorship columns
  const schemaQuery = await tx.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name IN ('created_by', 'updated_by')`
  )
  const columnNames = new Set(
    (schemaQuery as unknown as readonly { column_name: string }[]).map((row) => row.column_name)
  )

  const hasCreatedBy = columnNames.has('created_by')
  const hasUpdatedBy = columnNames.has('updated_by')

  // Build new fields object with authorship metadata (immutable approach)
  // When userId is 'guest' (no auth configured), set authorship fields to NULL
  // On creation, both created_by and updated_by are set to the same user ID
  // eslint-disable-next-line unicorn/no-null -- NULL is intentional for database columns when no auth configured
  const authorUserId = userId === 'guest' ? null : userId
  return {
    ...fields,
    ...(hasCreatedBy ? { created_by: authorUserId } : {}),
    ...(hasUpdatedBy ? { updated_by: authorUserId } : {}),
  }
}

/**
 * Create a new record
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param fields - Record fields
 * @returns Effect resolving to created record
 */
export function createRecord(
  session: Readonly<Session>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
): Effect.Effect<Record<string, unknown>, SessionContextError | UniqueConstraintViolationError> {
  return Effect.gen(function* () {
    const record = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)

          // Validate we have fields to insert
          if (Object.keys(fields).length === 0) {
            // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
            throw new SessionContextError('Cannot create record with no fields', undefined)
          }

          // Inject authorship metadata (created_by, updated_by) from session
          const fieldsWithAuthorship = await injectAuthorshipFields(
            fields,
            session.userId,
            tx,
            tableName
          )

          // Build INSERT query
          const { columnsClause, valuesClause } = buildInsertClauses(fieldsWithAuthorship)

          // Execute INSERT directly (avoid Effect.runPromise which wraps errors in FiberFailure)
          const insertResult = (await tx.execute(
            sql`INSERT INTO ${sql.identifier(tableName)} (${columnsClause}) VALUES (${valuesClause}) RETURNING *`
          )) as readonly Record<string, unknown>[]
          return insertResult[0] ?? {}
        }),
      catch: (error) => {
        if (error instanceof SessionContextError) return error
        if (error instanceof UniqueConstraintViolationError) return error
        if (isUniqueConstraintViolation(error)) {
          return new UniqueConstraintViolationError('Unique constraint violation', error)
        }
        return new SessionContextError(`Failed to create record in ${tableName}`, error)
      },
    })

    // Log activity for record creation
    yield* logActivity({
      session,
      tableName,
      action: 'create',
      recordId: String(record.id),
      changes: { after: record },
    })

    return record
  })
}

/**
 * Log activity for record update
 */
function logRecordUpdateActivity(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly changes: {
    readonly before: Record<string, unknown> | undefined
    readonly after: Record<string, unknown>
  }
  readonly app?: App
}): Effect.Effect<void, never> {
  const { session, tableName, recordId, changes, app } = config
  return logActivity({
    session,
    tableName,
    action: 'update',
    recordId,
    changes,
    app,
  })
}

/**
 * Inject updated_by field into record fields for updates
 *
 * @param fields - Original record fields
 * @param userId - User ID from session
 * @param tx - Database transaction
 * @param tableName - Table name
 * @returns Fields with updated_by injected
 */
async function injectUpdatedByField(
  fields: Readonly<Record<string, unknown>>,
  userId: string,
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<Record<string, unknown>> {
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
}

/**
 * Update a record
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @param params - Update parameters
 * @returns Effect resolving to updated record
 */
export function updateRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  params: {
    readonly fields: Readonly<Record<string, unknown>>
    readonly app?: App
  }
): Effect.Effect<Record<string, unknown>, SessionContextError> {
  const { fields, app } = params
  return Effect.gen(function* () {
    const { recordBefore, updatedRecord } = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)

          // Inject updated_by from session
          const fieldsWithUpdatedBy = await injectUpdatedByField(
            fields,
            session.userId,
            tx,
            tableName
          )

          const entries = await validateFieldsNotEmpty(fieldsWithUpdatedBy)
          const before = await fetchRecordBeforeUpdateCRUD(tx, tableName, recordId)
          const setClause = buildUpdateSetClauseCRUD(entries)
          const updated = await executeRecordUpdateCRUD(tx, tableName, recordId, setClause)
          return { recordBefore: before, updatedRecord: updated }
        }),
      catch: (error) =>
        error instanceof SessionContextError
          ? error
          : new SessionContextError(`Failed to update record in ${tableName}`, error),
    })

    yield* logRecordUpdateActivity({
      session,
      tableName,
      recordId,
      changes: {
        before: recordBefore,
        after: updatedRecord,
      },
      app,
    })

    return updatedRecord
  })
}

/**
 * Delete a record (soft delete if deleted_at field exists)
 *
 * Implements soft delete pattern:
 * - If table has deleted_at field: Sets deleted_at to NOW() (soft delete)
 * - If no deleted_at field: Performs hard delete
 * - Permissions applied via application layer
 * - Cascade soft delete to related records if configured with onDelete: 'cascade'
 * - Activity logging captures record state before deletion (non-blocking)
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @param app - App schema (optional, for cascade delete logic)
 * @returns Effect resolving to success boolean
 */
// eslint-disable-next-line max-lines-per-function -- Delete logic requires soft-delete check, cascade, and hard-delete fallback
export function deleteRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  app?: {
    readonly tables?: ReadonlyArray<{
      readonly name: string
      readonly fields: ReadonlyArray<{
        readonly name: string
        readonly type: string
        readonly relatedTable?: string
        readonly onDelete?: string
      }>
    }>
  }
): Effect.Effect<boolean, SessionContextError> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)

          // Check if table supports soft delete
          const hasSoftDelete = await checkDeletedAtColumn(tx, tableName)

          // Fetch record before deletion for activity logging
          const recordBeforeData = await fetchRecordBeforeDeletion(tx, tableName, recordId)

          if (hasSoftDelete) {
            // Execute soft delete
            const success = await executeSoftDelete(tx, tableName, recordId, session.userId)

            if (!success) {
              return { success: false, recordBeforeData: undefined }
            }

            // Cascade to related records if configured
            if (app) {
              // eslint-disable-next-line functional/no-expression-statements -- Required for cascade operation
              await cascadeSoftDelete(tx, tableName, recordId, app, session.userId)
            }

            return { success: true, recordBeforeData }
          } else {
            // Execute hard delete
            const success = await executeHardDelete(tx, tableName, recordId)
            return { success, recordBeforeData: undefined }
          }
        }),
      catch: (error) =>
        error instanceof SessionContextError
          ? error
          : new SessionContextError(`Failed to delete record from ${tableName}`, error),
    })

    // Log activity for soft delete (outside transaction)
    if (result.success && result.recordBeforeData) {
      yield* logActivity({
        session,
        tableName,
        action: 'delete',
        recordId,
        changes: { before: result.recordBeforeData },
      })
    }

    return result.success
  })
}

/**
 * Permanently delete a record (hard delete)
 *
 * Permanently removes the record from the database, regardless of deleted_at field.
 * This operation is irreversible and should only be allowed for admin roles.
 * Permissions applied via application layer.
 * Activity logging captures record state before deletion (non-blocking).
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @returns Effect resolving to success boolean
 */
export function permanentlyDeleteRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<boolean, SessionContextError> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)

          // Fetch record before deletion for activity logging
          const recordBeforeData = await fetchRecordBeforeDeletion(tx, tableName, recordId)

          // Execute hard delete
          const success = await executeHardDelete(tx, tableName, recordId)

          return { success, recordBeforeData: success ? recordBeforeData : undefined }
        }),
      catch: (error) =>
        error instanceof SessionContextError
          ? error
          : new SessionContextError(`Failed to permanently delete record from ${tableName}`, error),
    })

    // Log activity for permanent delete (outside transaction)
    if (result.success && result.recordBeforeData) {
      yield* logActivity({
        session,
        tableName,
        action: 'delete',
        recordId,
        changes: { before: result.recordBeforeData },
      })
    }

    return result.success
  })
}

/**
 * Restore a soft-deleted record
 *
 * Clears the deleted_at timestamp to restore a soft-deleted record.
 * Returns error if record doesn't exist or is not soft-deleted.
 * Permissions applied via application layer.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @returns Effect resolving to restored record or null
 */
// eslint-disable-next-line max-lines-per-function -- Restore logic requires deleted_by column check and conditional restore
export function restoreRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | null, SessionContextError> {
  return Effect.gen(function* () {
    const restoredRecord = yield* Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          validateTableName(tableName)
          const tableIdent = sql.identifier(tableName)

          // Check if record exists (including soft-deleted records)
          const checkResult = (await tx.execute(
            sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
          )) as unknown as readonly Record<string, unknown>[]

          if (checkResult.length === 0) {
            // eslint-disable-next-line unicorn/no-null -- Null is intentional for non-existent records
            return null // Record not found
          }

          const record = checkResult[0]

          // Check if record is soft-deleted
          if (!record?.deleted_at) {
            // Record exists but is not deleted - return error via special marker
            return { _error: 'not_deleted' } as Record<string, unknown>
          }

          // Check if table has deleted_by column
          const deletedByCheck = (await tx.execute(
            sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_by'`
          )) as readonly Record<string, unknown>[]

          const hasDeletedBy = deletedByCheck.length > 0

          // Restore record by clearing deleted_at and deleted_by (if column exists)
          const result = hasDeletedBy
            ? ((await tx.execute(
                sql`UPDATE ${tableIdent} SET deleted_at = NULL, deleted_by = NULL WHERE id = ${recordId} RETURNING *`
              )) as unknown as readonly Record<string, unknown>[])
            : ((await tx.execute(
                sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id = ${recordId} RETURNING *`
              )) as unknown as readonly Record<string, unknown>[])

          return result[0] ?? {}
        }),
      catch: (error) =>
        error instanceof SessionContextError
          ? error
          : new SessionContextError(
              `Failed to restore record ${recordId} from ${tableName}`,
              error
            ),
    })

    // Log activity for record restoration (outside transaction)
    if (restoredRecord && !('_error' in restoredRecord)) {
      yield* logActivity({
        session,
        tableName,
        action: 'restore',
        recordId,
        changes: { after: restoredRecord },
      })
    }

    return restoredRecord
  })
}
