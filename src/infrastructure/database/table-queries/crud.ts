/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db, withSessionContext, SessionContextError } from '@/infrastructure/database'
import { activityLogs } from '@/infrastructure/database/drizzle/schema/activity-log'
import { generateSqlCondition } from '@/infrastructure/database/filter-operators'
import {
  checkTableColumns,
  sanitizeFields,
  buildInsertClauses,
  executeInsert,
} from './create-record-helpers'
import { validateTableName, validateColumnName } from './validation'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { UniqueConstraintViolationError } from '@/infrastructure/database'

/**
 * Log record creation activity (non-critical operation)
 */
function logRecordCreation(
  session: Readonly<Session>,
  tableName: string,
  createdRecord: Record<string, unknown>
): Effect.Effect<void, never> {
  return Effect.ignore(
    Effect.tryPromise({
      try: async () => {
        // Get table ID from information_schema
        const tableIdResult = (await db.execute(
          sql`SELECT schemaname, tablename FROM pg_tables WHERE tablename = ${tableName} LIMIT 1`
        )) as readonly Record<string, unknown>[]

        // Use '1' as fallback table ID if not found in schema
        const tableId = tableIdResult[0] ? '1' : '1'

        // eslint-disable-next-line functional/no-expression-statements -- Database insert for logging is an acceptable side effect
        await db.insert(activityLogs).values({
          id: crypto.randomUUID(),
          userId: session.userId,
          action: 'create',
          tableName,
          tableId,
          recordId: String(createdRecord.id),
          changes: {
            after: createdRecord,
          },
        })
      },
      catch: (error) => new SessionContextError('Failed to log activity', error),
    })
  )
}

/**
 * Log record deletion activity (non-critical operation)
 */
function logRecordDeletion(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  recordBefore: Record<string, unknown>
): Effect.Effect<void, never> {
  return Effect.ignore(
    Effect.tryPromise({
      try: async () => {
        // Get table ID from information_schema
        const tableIdResult = (await db.execute(
          sql`SELECT schemaname, tablename FROM pg_tables WHERE tablename = ${tableName} LIMIT 1`
        )) as readonly Record<string, unknown>[]

        // Use '1' as fallback table ID if not found in schema
        const tableId = tableIdResult[0] ? '1' : '1'

        // eslint-disable-next-line functional/no-expression-statements -- Database insert for logging is an acceptable side effect
        await db.insert(activityLogs).values({
          id: crypto.randomUUID(),
          userId: session.userId,
          action: 'delete',
          tableName,
          tableId,
          recordId,
          changes: {
            before: recordBefore,
          },
        })
      },
      catch: (error) => new SessionContextError('Failed to log activity', error),
    })
  )
}

/**
 * List all records from a table with session context
 *
 * Returns all accessible records (RLS policies apply automatically via session context).
 *
 * @param config - Configuration object
 * @param config.session - Better Auth session
 * @param config.tableName - Name of the table to query
 * @param config.table - Table schema configuration (unused, kept for backward compatibility)
 * @param config.filter - Optional filter to apply to the query
 * @param config.includeDeleted - Whether to include soft-deleted records (default: false)
 * @returns Effect resolving to array of records
 */
export function listRecords(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly table?: { readonly permissions?: { readonly organizationScoped?: boolean } }
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly includeDeleted?: boolean
}): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  const { session, tableName, filter, includeDeleted } = config
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)

        // Check if table has deleted_at column to filter soft-deleted records
        const columnCheck = (await tx.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_at'`
        )) as readonly Record<string, unknown>[]

        const hasDeletedAt = columnCheck.length > 0

        // Add user-provided filters (static import - no performance overhead)
        const userFilterConditions =
          filter?.and && filter.and.length > 0
            ? (() => {
                const andConditions = filter.and ?? [] // Type narrowing
                return andConditions
                  .map((f) => {
                    validateColumnName(f.field)
                    return generateSqlCondition(f.field, f.operator, f.value, {
                      useEscapeSqlString: true,
                    })
                  })
                  .filter((c) => c !== '')
              })()
            : []

        // Add soft delete filter if table has deleted_at column and includeDeleted is not true
        const softDeleteCondition = hasDeletedAt && !includeDeleted ? ['deleted_at IS NULL'] : []

        const conditions = [...userFilterConditions, ...softDeleteCondition]

        // Build final query
        const whereClause =
          conditions.length > 0 ? sql.raw(` WHERE ${conditions.join(' AND ')}`) : sql.raw('')

        const result = await tx.execute(
          sql`SELECT * FROM ${sql.identifier(tableName)}${whereClause}`
        )

        return result as readonly Record<string, unknown>[]
      },
      catch: (error) => new SessionContextError(`Failed to list records from ${tableName}`, error),
    })
  )
}

/**
 * List soft-deleted records from a table with session context
 *
 * Returns all accessible soft-deleted records (RLS policies apply automatically via session context).
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table to query
 * @returns Effect resolving to array of soft-deleted records
 */
export function listTrash(
  session: Readonly<Session>,
  tableName: string
): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)

        // Check if table has deleted_at column
        const columnCheck = (await tx.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_at'`
        )) as readonly Record<string, unknown>[]

        const hasDeletedAt = columnCheck.length > 0

        if (!hasDeletedAt) {
          // If table doesn't have deleted_at, return empty array (no soft-deleted records)
          return []
        }

        // Only fetch soft-deleted records (deleted_at IS NOT NULL)
        const result = await tx.execute(
          sql`SELECT * FROM ${sql.identifier(tableName)} WHERE deleted_at IS NOT NULL`
        )

        return result as readonly Record<string, unknown>[]
      },
      catch: (error) => new SessionContextError(`Failed to list trash from ${tableName}`, error),
    })
  )
}

/**
 * Get a single record by ID with session context
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @returns Effect resolving to record or null
 */
export function getRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | null, SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)

        // Use parameterized query for recordId (automatic via template literal)
        const result = (await tx.execute(
          sql`SELECT * FROM ${sql.identifier(tableName)} WHERE id = ${recordId} LIMIT 1`
        )) as readonly Record<string, unknown>[]

        // eslint-disable-next-line unicorn/no-null -- Null is intentional for database records that don't exist
        return result[0] ?? null
      },
      catch: (error) => {
        return new SessionContextError(`Failed to get record ${recordId} from ${tableName}`, error)
      },
    })
  )
}

/**
 * Create a new record with session context
 *
 * Automatically sets owner_id from session.
 * Security: Silently overrides any user-provided owner_id to prevent unauthorized ownership.
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
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      yield* Effect.sync(() => validateTableName(tableName))

      // Check if table has owner_id column
      const { hasOwnerId } = yield* checkTableColumns(tableName, tx)

      // Security: Filter out any user-provided owner_id
      const sanitizedFields = sanitizeFields(fields, false, hasOwnerId)

      // Validate we have fields to insert
      if (Object.keys(sanitizedFields).length === 0 && !hasOwnerId) {
        return yield* Effect.fail(
          new SessionContextError('Cannot create record with no fields', undefined)
        )
      }

      // Build INSERT query
      const { columnsClause, valuesClause } = buildInsertClauses(
        sanitizedFields,
        false,
        hasOwnerId,
        session
      )

      // Execute INSERT and get created record
      const createdRecord = yield* executeInsert(tableName, columnsClause, valuesClause, tx)

      // Log activity for record creation (outside session context)
      yield* logRecordCreation(session, tableName, createdRecord)

      return createdRecord
    })
  )
}

/**
 * Update a record with session context
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @param fields - Fields to update
 * @returns Effect resolving to updated record
 */
export function updateRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  fields: Readonly<Record<string, unknown>>
): Effect.Effect<Record<string, unknown>, SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)
        const entries = Object.entries(fields)

        if (entries.length === 0) {
          // eslint-disable-next-line functional/no-throw-statements -- Validation requires throwing for empty fields
          throw new Error('Cannot update record with no fields')
        }

        // Build SET clause with validated columns and parameterized values
        const setClauses = entries.map(([key, value]) => {
          validateColumnName(key)
          return sql`${sql.identifier(key)} = ${value}`
        })
        const setClause = sql.join(setClauses, sql.raw(', '))

        const result = (await tx.execute(
          sql`UPDATE ${sql.identifier(tableName)} SET ${setClause} WHERE id = ${recordId} RETURNING *`
        )) as readonly Record<string, unknown>[]

        // If RLS blocked the update, result will be empty
        if (result.length === 0) {
          // eslint-disable-next-line functional/no-throw-statements -- RLS blocking requires error propagation
          throw new Error(`Record not found or access denied`)
        }

        return result[0]!
      },
      catch: (error) => {
        // Preserve "not found" or "access denied" in wrapper message for API error handling
        const errorMsg = error instanceof Error ? error.message : String(error)
        if (errorMsg.includes('not found') || errorMsg.includes('access denied')) {
          return new SessionContextError(errorMsg, error)
        }
        return new SessionContextError(`Failed to update record ${recordId} in ${tableName}`, error)
      },
    })
  )
}

/**
 * Cascade soft delete to related records
 *
 * Helper function to cascade soft delete to child records based on onDelete: 'cascade' configuration
 */
async function cascadeSoftDelete(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Transaction type is complex Drizzle type
  tx: any,
  tableName: string,
  recordId: string,
  app: {
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
): Promise<void> {
  if (!app.tables) return

  // Find all tables with relationship fields that reference this table with onDelete: 'cascade'
  const relatedTables = app.tables.flatMap((table) =>
    table.fields
      .filter(
        (field) =>
          field.type === 'relationship' &&
          field.relatedTable === tableName &&
          field.onDelete === 'cascade'
      )
      .map((field) => ({
        tableName: table.name,
        fieldName: field.name,
      }))
  )

  // Cascade soft delete to each related table
  // eslint-disable-next-line functional/no-expression-statements -- Database updates for cascade delete are required side effects
  await Promise.all(
    relatedTables.map(async (relatedInfo) => {
      const childTable = relatedInfo.tableName
      const childColumn = relatedInfo.fieldName

      validateTableName(childTable)
      validateColumnName(childColumn)

      // Check if child table has deleted_at column
      const childColumnCheck = (await tx.execute(
        sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${childTable} AND column_name = 'deleted_at'`
      )) as readonly Record<string, unknown>[]

      if (childColumnCheck.length > 0) {
        // Cascade soft delete to related records
        // eslint-disable-next-line functional/no-expression-statements -- Database update for cascade is required
        await tx.execute(
          sql`UPDATE ${sql.identifier(childTable)} SET deleted_at = NOW() WHERE ${sql.identifier(childColumn)} = ${recordId} AND deleted_at IS NULL`
        )
      }
    })
  )
}

/**
 * Delete a record with session context (soft delete if deleted_at field exists)
 *
 * Implements soft delete pattern:
 * - If table has deleted_at field: Sets deleted_at to NOW() (soft delete)
 * - If no deleted_at field: Performs hard delete
 * - RLS policies automatically applied via session context
 * - Cascade soft delete to related records if configured with onDelete: 'cascade'
 * - Activity logging captures record state before deletion (non-blocking)
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @param app - App schema (optional, for cascade delete logic)
 * @returns Effect resolving to success boolean
 */
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
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      validateTableName(tableName)
      const tableIdent = sql.identifier(tableName)

      // Check if table has deleted_at column for soft delete
      const columnCheck = (yield* Effect.tryPromise({
        try: () =>
          tx.execute(
            sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_at'`
          ) as Promise<readonly Record<string, unknown>[]>,
        catch: (error) =>
          new SessionContextError(`Failed to check columns for ${tableName}`, error),
      })) as readonly Record<string, unknown>[]

      // Fetch record BEFORE deletion for activity logging
      const recordBefore = (yield* Effect.tryPromise({
        try: () =>
          tx.execute(sql`SELECT * FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`) as Promise<
            readonly Record<string, unknown>[]
          >,
        catch: (error) => new SessionContextError(`Failed to fetch record before deletion`, error),
      })) as readonly Record<string, unknown>[]

      const recordBeforeData = recordBefore[0]

      if (columnCheck.length > 0) {
        // Soft delete: set deleted_at timestamp (parameterized)
        // Use RETURNING to check if update affected any rows (RLS may block access)
        // Only update records that are NOT already soft-deleted (deleted_at IS NULL)
        const result = (yield* Effect.tryPromise({
          try: () =>
            tx.execute(
              sql`UPDATE ${tableIdent} SET deleted_at = NOW() WHERE id = ${recordId} AND deleted_at IS NULL RETURNING id`
            ) as Promise<readonly Record<string, unknown>[]>,
          catch: (error) =>
            new SessionContextError(`Failed to delete record ${recordId} from ${tableName}`, error),
        })) as readonly Record<string, unknown>[]

        // If RLS blocked the update, result will be empty
        if (result.length === 0) {
          return false
        }

        // Cascade soft delete to related records if configured and app schema is provided
        if (app) {
          yield* Effect.tryPromise({
            try: () => cascadeSoftDelete(tx, tableName, recordId, app),
            catch: (error) =>
              new SessionContextError(`Failed to cascade delete for ${tableName}`, error),
          })
        }

        // Log activity for soft delete (non-blocking, runs outside transaction)
        if (recordBeforeData) {
          yield* logRecordDeletion(session, tableName, recordId, recordBeforeData)
        }

        return true
      } else {
        // Hard delete: remove record (parameterized)
        // Use RETURNING to check if delete affected any rows (RLS may block access)
        const result = (yield* Effect.tryPromise({
          try: () =>
            tx.execute(
              sql`DELETE FROM ${tableIdent} WHERE id = ${recordId} RETURNING id`
            ) as Promise<readonly Record<string, unknown>[]>,
          catch: (error) =>
            new SessionContextError(`Failed to delete record ${recordId} from ${tableName}`, error),
        })) as readonly Record<string, unknown>[]

        // If RLS blocked the delete, result will be empty
        return result.length > 0
      }
    })
  )
}

/**
 * Permanently delete a record with session context (hard delete)
 *
 * Permanently removes the record from the database, regardless of deleted_at field.
 * This operation is irreversible and should only be allowed for admin/owner roles.
 * RLS policies automatically applied via session context.
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
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      validateTableName(tableName)
      const tableIdent = sql.identifier(tableName)

      // Fetch record BEFORE deletion for activity logging
      const recordBefore = (yield* Effect.tryPromise({
        try: () =>
          tx.execute(sql`SELECT * FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`) as Promise<
            readonly Record<string, unknown>[]
          >,
        catch: (error) => new SessionContextError(`Failed to fetch record before deletion`, error),
      })) as readonly Record<string, unknown>[]

      const recordBeforeData = recordBefore[0]

      // Hard delete: remove record permanently (parameterized)
      // Use RETURNING to check if delete affected any rows (RLS may block access)
      const result = (yield* Effect.tryPromise({
        try: () =>
          tx.execute(sql`DELETE FROM ${tableIdent} WHERE id = ${recordId} RETURNING id`) as Promise<
            readonly Record<string, unknown>[]
          >,
        catch: (error) =>
          new SessionContextError(
            `Failed to permanently delete record ${recordId} from ${tableName}`,
            error
          ),
      })) as readonly Record<string, unknown>[]

      // If RLS blocked the delete, result will be empty
      if (result.length === 0) {
        return false
      }

      // Log activity for permanent delete (non-blocking, runs outside transaction)
      if (recordBeforeData) {
        yield* logRecordDeletion(session, tableName, recordId, recordBeforeData)
      }

      return true
    })
  )
}

/**
 * Restore a soft-deleted record with session context
 *
 * Clears the deleted_at timestamp to restore a soft-deleted record.
 * Returns error if record doesn't exist or is not soft-deleted.
 * RLS policies automatically applied via session context.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @returns Effect resolving to restored record or error
 */
export function restoreRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | null, SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.tryPromise({
      try: async () => {
        validateTableName(tableName)
        const tableIdent = sql.identifier(tableName)

        // Check if record exists (including soft-deleted records)
        const checkResult = (await tx.execute(
          sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
        )) as readonly Record<string, unknown>[]

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

        // Restore record by clearing deleted_at
        const result = (await tx.execute(
          sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id = ${recordId} RETURNING *`
        )) as readonly Record<string, unknown>[]

        return result[0] ?? {}
      },
      catch: (error) =>
        new SessionContextError(`Failed to restore record ${recordId} from ${tableName}`, error),
    })
  )
}
