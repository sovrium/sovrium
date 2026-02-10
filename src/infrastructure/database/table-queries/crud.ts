/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- CRUD operations file contains 9 distinct operations (list, listTrash, aggregate, get, create, update, delete, permanentlyDelete, restore) with shared helpers. Splitting would break cohesion. */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db, SessionContextError, UniqueConstraintViolationError } from '@/infrastructure/database'
import { logActivity } from './activity-log-helpers'
import {
  buildAggregationSelects,
  parseAggregationResult,
  buildOrderByClause,
  buildWhereClause,
  checkDeletedAtColumn as checkDeletedAtColumnHelper,
} from './aggregation-helpers'
import { buildInsertClauses, isUniqueConstraintViolation } from './create-record-helpers'
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

/**
 * List all records from a table
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
  const { tableName, filter, includeDeleted, sort, app } = config
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)

        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))

        // Build query clauses
        const whereClause = buildWhereClause(hasDeletedAt, includeDeleted, filter)
        const orderByClause = buildOrderByClause(sort, app, tableName)

        const result = await tx.execute(
          sql`SELECT * FROM ${sql.identifier(tableName)}${whereClause}${orderByClause}`
        )

        return result as unknown as readonly Record<string, unknown>[]
      }),
    catch: (error) =>
      error instanceof SessionContextError
        ? error
        : new SessionContextError(`Failed to list records from ${tableName}`, error),
  })
}

/**
 * Compute aggregations on records from a table
 *
 * @param config - Configuration object
 * @param config.session - Better Auth session
 * @param config.tableName - Name of the table to query
 * @param config.filter - Optional filter to apply to the query
 * @param config.includeDeleted - Whether to include soft-deleted records (default: false)
 * @param config.aggregate - Aggregation configuration
 * @returns Effect resolving to aggregation results
 */
// eslint-disable-next-line max-lines-per-function -- Aggregation logic requires multiple SQL clauses
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
  const { tableName, filter, includeDeleted, aggregate } = config
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)
        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))
        const whereClause = buildWhereClause(hasDeletedAt, includeDeleted, filter)
        const aggregationSelects = buildAggregationSelects(aggregate)
        if (aggregationSelects.length === 0) return {}

        const selectClause = sql.raw(aggregationSelects.join(', '))
        const result = await tx.execute(
          sql`SELECT ${selectClause} FROM ${sql.identifier(tableName)}${whereClause}`
        )

        const rows = result as unknown as readonly Record<string, unknown>[]
        if (rows.length === 0) return {}

        return parseAggregationResult(rows[0]!, aggregate)
      }),
    catch: (error) =>
      error instanceof SessionContextError
        ? error
        : new SessionContextError(`Failed to compute aggregations from ${tableName}`, error),
  })
}

/**
 * List soft-deleted records from a table
 *
 * Returns all accessible soft-deleted records (Permissions applied via application layer).
 *
 * @param config - Configuration object
 * @param config.session - Better Auth session
 * @param config.tableName - Name of the table to query
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
  const { tableName, filter, sort } = config
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)

        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))

        if (!hasDeletedAt) {
          return [] as readonly Record<string, unknown>[]
        }

        const baseQuery = sql`SELECT * FROM ${sql.identifier(tableName)} WHERE deleted_at IS NOT NULL`
        const queryWithFilters = buildTrashFilters(baseQuery, filter?.and)
        const query = addTrashSorting(queryWithFilters, sort)

        const result = await tx.execute(query)
        return result as unknown as readonly Record<string, unknown>[]
      }),
    catch: (error) =>
      error instanceof SessionContextError
        ? error
        : new SessionContextError(`Failed to list trash from ${tableName}`, error),
  })
}

/**
 * Get a single record by ID
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
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)

        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))

        // Build WHERE clause with soft-delete filter if applicable
        const whereClause =
          hasDeletedAt && !includeDeleted
            ? sql` WHERE id = ${recordId} AND deleted_at IS NULL`
            : sql` WHERE id = ${recordId}`

        // Use parameterized query for recordId (automatic via template literal)
        const result = await tx.execute(
          sql`SELECT * FROM ${sql.identifier(tableName)}${whereClause} LIMIT 1`
        )

        const rows = result as unknown as readonly Record<string, unknown>[]

        // eslint-disable-next-line unicorn/no-null -- Null is intentional for database records that don't exist
        return rows[0] ?? null
      }),
    catch: (error) =>
      error instanceof SessionContextError
        ? error
        : new SessionContextError(`Failed to get record ${recordId} from ${tableName}`, error),
  })
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

          // Build INSERT query
          const { columnsClause, valuesClause } = buildInsertClauses(fields)

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

          const entries = await Effect.runPromise(validateFieldsNotEmpty(fields))
          const before = await Effect.runPromise(
            fetchRecordBeforeUpdateCRUD(tx, tableName, recordId)
          )
          const setClause = buildUpdateSetClauseCRUD(entries)
          const updated = await Effect.runPromise(
            executeRecordUpdateCRUD(tx, tableName, recordId, setClause)
          )
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
          const hasSoftDelete = await Effect.runPromise(checkDeletedAtColumn(tx, tableName))

          // Fetch record before deletion for activity logging
          const recordBeforeData = await Effect.runPromise(
            fetchRecordBeforeDeletion(tx, tableName, recordId)
          )

          if (hasSoftDelete) {
            // Execute soft delete
            const success = await Effect.runPromise(executeSoftDelete(tx, tableName, recordId))

            if (!success) {
              return { success: false, recordBeforeData: undefined }
            }

            // Cascade to related records if configured
            if (app) {
              // eslint-disable-next-line functional/no-expression-statements -- Required for cascade operation
              await cascadeSoftDelete(tx, tableName, recordId, app)
            }

            return { success: true, recordBeforeData }
          } else {
            // Execute hard delete
            const success = await Effect.runPromise(executeHardDelete(tx, tableName, recordId))
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
          const recordBeforeData = await Effect.runPromise(
            fetchRecordBeforeDeletion(tx, tableName, recordId)
          )

          // Execute hard delete
          const success = await Effect.runPromise(executeHardDelete(tx, tableName, recordId))

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

          // Restore record by clearing deleted_at
          const result = (await tx.execute(
            sql`UPDATE ${tableIdent} SET deleted_at = NULL WHERE id = ${recordId} RETURNING *`
          )) as unknown as readonly Record<string, unknown>[]
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
