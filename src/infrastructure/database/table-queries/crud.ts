/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { withSessionContext, SessionContextError } from '@/infrastructure/database'
import { logActivity } from './activity-log-helpers'
import {
  buildAggregationSelects,
  parseAggregationResult,
  buildOrderByClause,
  buildWhereClause,
  checkDeletedAtColumn as checkDeletedAtColumnHelper,
} from './aggregation-helpers'
import {
  checkTableColumns,
  sanitizeFields,
  buildInsertClauses,
  executeInsert,
} from './create-record-helpers'
import {
  cascadeSoftDelete,
  fetchRecordBeforeDeletion,
  executeSoftDelete,
  executeHardDelete,
  checkDeletedAtColumn,
} from './delete-helpers'
import { buildTrashFilters, addTrashSorting } from './trash-helpers'
import {
  validateFieldsNotEmpty,
  fetchRecordBeforeUpdateCRUD,
  buildUpdateSetClauseCRUD,
  executeRecordUpdateCRUD,
} from './update-helpers'
import { validateTableName } from './validation'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { UniqueConstraintViolationError } from '@/infrastructure/database'

/**
 * List all records from a table with session context
 *
 * Returns all accessible records (Permissions applied via application layer).
 *
 * @param config - Configuration object
 * @param config.session - Better Auth session
 * @param config.tableName - Name of the table to query
 * @param config.table - Table schema configuration (unused, kept for backward compatibility)
 * @param config.filter - Optional filter to apply to the query
 * @param config.includeDeleted - Whether to include soft-deleted records (default: false)
 * @param config.sort - Optional sort specification (e.g., 'field:asc' or 'field:desc')
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
  readonly sort?: string
  readonly app?: {
    readonly tables?: readonly { readonly name: string; readonly fields: readonly unknown[] }[]
  }
}): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  const { session, tableName, filter, includeDeleted, sort, app } = config
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      validateTableName(tableName)

      const hasDeletedAt = yield* checkDeletedAtColumnHelper(tx, tableName)

      // Build query clauses
      const whereClause = buildWhereClause(hasDeletedAt, includeDeleted, filter)
      const orderByClause = buildOrderByClause(sort, app, tableName)

      const result = yield* Effect.tryPromise({
        try: () =>
          tx.execute(sql`SELECT * FROM ${sql.identifier(tableName)}${whereClause}${orderByClause}`),
        catch: (error) =>
          new SessionContextError(`Failed to list records from ${tableName}`, error),
      })

      return result as readonly Record<string, unknown>[]
    })
  )
}

/**
 * Compute aggregations on records from a table with session context
 *
 * @param config - Configuration object
 * @param config.session - Better Auth session
 * @param config.tableName - Name of the table to query
 * @param config.filter - Optional filter to apply to the query
 * @param config.includeDeleted - Whether to include soft-deleted records (default: false)
 * @param config.aggregate - Aggregation configuration
 * @returns Effect resolving to aggregation results
 */
export function computeAggregations(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly includeDeleted?: boolean
  readonly aggregate: {
    readonly count?: boolean
    readonly sum?: readonly string[]
    readonly avg?: readonly string[]
    readonly min?: readonly string[]
    readonly max?: readonly string[]
  }
}): Effect.Effect<
  {
    readonly count?: string
    readonly sum?: Record<string, number>
    readonly avg?: Record<string, number>
    readonly min?: Record<string, number>
    readonly max?: Record<string, number>
  },
  SessionContextError
> {
  const { session, tableName, filter, includeDeleted, aggregate } = config
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      validateTableName(tableName)
      const hasDeletedAt = yield* checkDeletedAtColumnHelper(tx, tableName)
      const whereClause = buildWhereClause(hasDeletedAt, includeDeleted, filter)
      const aggregationSelects = buildAggregationSelects(aggregate)
      if (aggregationSelects.length === 0) return {}

      const selectClause = sql.raw(aggregationSelects.join(', '))
      const result = yield* Effect.tryPromise({
        try: () =>
          tx.execute(sql`SELECT ${selectClause} FROM ${sql.identifier(tableName)}${whereClause}`),
        catch: (error) =>
          new SessionContextError(`Failed to compute aggregations from ${tableName}`, error),
      })

      const rows = result as readonly Record<string, unknown>[]
      if (rows.length === 0) return {}

      return parseAggregationResult(rows[0]!, aggregate)
    })
  )
}

/**
 * List soft-deleted records from a table with session context
 *
 * Returns all accessible soft-deleted records (Permissions applied via application layer).
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table to query
 * @returns Effect resolving to array of soft-deleted records
 */
export function listTrash(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly sort?: string
}): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  const { session, tableName, filter, sort } = config
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      validateTableName(tableName)

      const hasDeletedAt = yield* checkDeletedAtColumnHelper(tx, tableName)

      if (!hasDeletedAt) {
        return []
      }

      const baseQuery = sql`SELECT * FROM ${sql.identifier(tableName)} WHERE deleted_at IS NOT NULL`
      const queryWithFilters = buildTrashFilters(baseQuery, filter?.and)
      const query = addTrashSorting(queryWithFilters, sort)

      const result = yield* Effect.tryPromise({
        try: () => tx.execute(query),
        catch: (error) => new SessionContextError(`Failed to list trash from ${tableName}`, error),
      })

      return result as readonly Record<string, unknown>[]
    })
  )
}

/**
 * Get a single record by ID with session context
 *
 * Excludes soft-deleted records by default (deleted_at IS NULL).
 * Use includeDeleted parameter to fetch soft-deleted records.
 *
 * @param session - Better Auth session
 * @param tableName - Name of the table
 * @param recordId - Record ID
 * @param includeDeleted - Whether to include soft-deleted records (default: false)
 * @returns Effect resolving to record or null
 */
export function getRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  includeDeleted?: boolean
): Effect.Effect<Record<string, unknown> | null, SessionContextError> {
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      validateTableName(tableName)

      const hasDeletedAt = yield* checkDeletedAtColumnHelper(tx, tableName)

      // Build WHERE clause with soft-delete filter if applicable
      const whereClause =
        hasDeletedAt && !includeDeleted
          ? sql` WHERE id = ${recordId} AND deleted_at IS NULL`
          : sql` WHERE id = ${recordId}`

      // Use parameterized query for recordId (automatic via template literal)
      const result = yield* Effect.tryPromise({
        try: () =>
          tx.execute(sql`SELECT * FROM ${sql.identifier(tableName)}${whereClause} LIMIT 1`),
        catch: (error) =>
          new SessionContextError(`Failed to get record ${recordId} from ${tableName}`, error),
      })

      const rows = result as readonly Record<string, unknown>[]

      // eslint-disable-next-line unicorn/no-null -- Null is intentional for database records that don't exist
      return rows[0] ?? null
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
      yield* logActivity({
        session,
        tableName,
        action: 'create',
        recordId: String(createdRecord.id),
        changes: { after: createdRecord },
      })

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
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      validateTableName(tableName)

      const entries = yield* validateFieldsNotEmpty(fields)
      const recordBefore = yield* fetchRecordBeforeUpdateCRUD(tx, tableName, recordId)
      const setClause = buildUpdateSetClauseCRUD(entries)
      const updatedRecord = yield* executeRecordUpdateCRUD(tx, tableName, recordId, setClause)

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
  )
}

/**
 * Delete a record with session context (soft delete if deleted_at field exists)
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

      // Check if table supports soft delete
      const hasSoftDelete = yield* checkDeletedAtColumn(tx, tableName)

      // Fetch record before deletion for activity logging
      const recordBeforeData = yield* fetchRecordBeforeDeletion(tx, tableName, recordId)

      if (hasSoftDelete) {
        // Execute soft delete
        const success = yield* executeSoftDelete(tx, tableName, recordId)

        if (!success) {
          return false
        }

        // Cascade to related records if configured
        if (app) {
          yield* Effect.tryPromise({
            try: () => cascadeSoftDelete(tx, tableName, recordId, app),
            catch: (error) =>
              new SessionContextError(`Failed to cascade delete for ${tableName}`, error),
          })
        }

        // Log activity for soft delete
        if (recordBeforeData) {
          yield* logActivity({
            session,
            tableName,
            action: 'delete',
            recordId,
            changes: { before: recordBeforeData },
          })
        }

        return true
      } else {
        // Execute hard delete
        return yield* executeHardDelete(tx, tableName, recordId)
      }
    })
  )
}

/**
 * Permanently delete a record with session context (hard delete)
 *
 * Permanently removes the record from the database, regardless of deleted_at field.
 * This operation is irreversible and should only be allowed for admin/owner roles.
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
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      validateTableName(tableName)

      // Fetch record before deletion for activity logging
      const recordBeforeData = yield* fetchRecordBeforeDeletion(tx, tableName, recordId)

      // Execute hard delete
      const success = yield* executeHardDelete(tx, tableName, recordId)

      if (!success) {
        return false
      }

      // Log activity for permanent delete
      if (recordBeforeData) {
        yield* logActivity({
          session,
          tableName,
          action: 'delete',
          recordId,
          changes: { before: recordBeforeData },
        })
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
 * Permissions applied via application layer.
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
    Effect.gen(function* () {
      validateTableName(tableName)
      const tableIdent = sql.identifier(tableName)

      // Check if record exists (including soft-deleted records)
      const checkResult = yield* Effect.tryPromise({
        try: async () => {
          const result = (await tx.execute(
            sql`SELECT id, deleted_at FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
          )) as readonly Record<string, unknown>[]
          return result
        },
        catch: (error) =>
          new SessionContextError(`Failed to check record ${recordId} in ${tableName}`, error),
      })

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
      const restoredRecord = yield* Effect.tryPromise({
        try: async () => {
          const result = (await tx.execute(
            sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id = ${recordId} RETURNING *`
          )) as readonly Record<string, unknown>[]
          return result[0] ?? {}
        },
        catch: (error) =>
          new SessionContextError(`Failed to restore record ${recordId} from ${tableName}`, error),
      })

      // Log activity for record restoration
      yield* logActivity({
        session,
        tableName,
        action: 'restore',
        recordId,
        changes: { after: restoredRecord },
      })

      return restoredRecord
    })
  )
}
