/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- Routes file with many endpoints */

import { Effect } from 'effect'
// eslint-disable-next-line boundaries/element-types -- Route handlers need database infrastructure for session context
import { SessionContextError, type ForbiddenError } from '@/infrastructure/database/session-context'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
  batchCreateRecordsRequestSchema,
  batchUpdateRecordsRequestSchema,
  batchDeleteRecordsRequestSchema,
  batchRestoreRecordsRequestSchema,
  upsertRecordsRequestSchema,
} from '@/presentation/api/schemas/request-schemas'
import {
  listTablesResponseSchema,
  getTableResponseSchema,
  listRecordsResponseSchema,
  getRecordResponseSchema,
  createRecordResponseSchema,
  updateRecordResponseSchema,
  batchCreateRecordsResponseSchema,
  batchUpdateRecordsResponseSchema,
  batchDeleteRecordsResponseSchema,
  upsertRecordsResponseSchema,
  listViewsResponseSchema,
  getViewResponseSchema,
  getViewRecordsResponseSchema,
  getTablePermissionsResponseSchema,
  type ListTablesResponse,
  type GetTableResponse,
  type ListRecordsResponse,
  type GetRecordResponse,
  type RestoreRecordResponse,
  type BatchRestoreRecordsResponse,
} from '@/presentation/api/schemas/tables-schemas'
import { runEffect, validateRequest } from '@/presentation/api/utils'
import { transformRecord, transformRecords } from '@/presentation/api/utils/record-transformer'
import {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  restoreRecord,
  batchRestoreRecords,
} from '@/presentation/api/utils/table-queries'
import type { App } from '@/domain/models/app'
// eslint-disable-next-line boundaries/element-types -- Route handlers need auth types for session management
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

// ============================================================================
// Table ID Resolution
// ============================================================================

/**
 * Get table name from tableId parameter
 *
 * Looks up the table in the app schema by either:
 * - Table ID (numeric or string match)
 * - Table name (exact match)
 *
 * @param app - Application configuration containing tables
 * @param tableId - Table identifier from route parameter
 * @returns Table name if found, undefined otherwise
 */
const getTableNameFromId = (app: App, tableId: string): string | undefined => {
  const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)
  return table?.name
}

/**
 * Handle batch restore errors with appropriate HTTP responses
 */
const handleBatchRestoreError = (c: Context, error: unknown) => {
  // Handle ForbiddenError (viewer role attempting write operation)
  // Use name check to handle multiple import paths resolving to different class instances
  if (error instanceof Error && error.name === 'ForbiddenError') {
    return c.json(
      {
        error: 'Forbidden',
        message: error.message,
      },
      403
    )
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error'

  if (errorMessage.includes('not found')) {
    const recordIdMatch = errorMessage.match(/Record (\S+) not found/)
    return c.json(
      {
        error: 'Record not found',
        recordId: recordIdMatch?.[1] ? Number.parseInt(recordIdMatch[1]) : undefined,
      },
      404
    )
  }

  if (errorMessage.includes('is not deleted')) {
    const recordIdMatch = errorMessage.match(/Record (\S+) is not deleted/)
    return c.json(
      {
        error: 'Bad Request',
        message: 'Record is not deleted',
        recordId: recordIdMatch?.[1] ? Number.parseInt(recordIdMatch[1]) : undefined,
      },
      400
    )
  }

  return c.json({ error: 'Internal server error', message: errorMessage }, 500)
}

// ============================================================================
// Table Route Handlers
// ============================================================================

function createListTablesProgram(): Effect.Effect<ListTablesResponse, never> {
  return Effect.succeed({
    tables: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  })
}

function createGetTableProgram(tableId: string): Effect.Effect<GetTableResponse, never> {
  return Effect.succeed({
    table: {
      id: tableId,
      name: 'Sample Table',
      description: 'A sample table',
      fields: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
}

function createGetPermissionsProgram() {
  return Effect.succeed({
    permissions: {
      read: true,
      create: true,
      update: true,
      delete: true,
      manage: false,
    },
  })
}

// ============================================================================
// Record Route Handlers
// ============================================================================

function createListRecordsProgram(
  session: Readonly<Session>,
  tableName: string
): Effect.Effect<ListRecordsResponse, SessionContextError> {
  return Effect.gen(function* () {
    // Query records with session context (RLS policies automatically applied)
    const records = yield* listRecords(session, tableName)

    return {
      records: transformRecords(records),
      pagination: {
        page: 1,
        limit: 10,
        total: records.length,
        totalPages: Math.ceil(records.length / 10),
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }
  })
}

function createGetRecordProgram(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<GetRecordResponse, SessionContextError> {
  return Effect.gen(function* () {
    // Query record with session context (RLS policies automatically applied)
    const record = yield* getRecord(session, tableName, recordId)

    if (!record) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    return { record: transformRecord(record) }
  })
}

function createRecordProgram(
  session: Readonly<Session>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
) {
  return Effect.gen(function* () {
    // Create record with session context (organization_id and owner_id set automatically)
    const record = yield* createRecord(session, tableName, fields)
    return { record: transformRecord(record) }
  })
}

function updateRecordProgram(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  fields: Readonly<Record<string, unknown>>
) {
  return Effect.gen(function* () {
    // Update record with session context (RLS policies enforce access control)
    const record = yield* updateRecord(session, tableName, recordId, fields)
    return { record: transformRecord(record) }
  })
}

function restoreRecordProgram(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<RestoreRecordResponse, SessionContextError> {
  return Effect.gen(function* () {
    // Restore soft-deleted record with session context
    const record = yield* restoreRecord(session, tableName, recordId)

    // Handle special error marker for non-deleted records
    if (record && '_error' in record && record._error === 'not_deleted') {
      return yield* Effect.fail(new SessionContextError('Record is not deleted'))
    }

    if (!record) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    return {
      success: true as const,
      record: transformRecord(record),
    }
  })
}

// ============================================================================
// Batch Operation Handlers
// ============================================================================

function batchCreateProgram(recordsData: readonly { fields?: Record<string, unknown> }[]) {
  const records = recordsData.map((r) => ({
    id: crypto.randomUUID(),
    fields: r.fields ?? {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
  return Effect.succeed({ records, count: records.length })
}

function batchUpdateProgram(
  recordsData: readonly { id: string; fields?: Record<string, unknown> }[]
) {
  const records = recordsData.map((r) => ({
    id: r.id,
    fields: r.fields ?? {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
  return Effect.succeed({ records, count: records.length })
}

function batchDeleteProgram(ids: readonly string[]) {
  return Effect.succeed({
    success: true as const,
    count: ids.length,
    deletedIds: [...ids],
  })
}

function batchRestoreProgram(
  session: Readonly<Session>,
  tableName: string,
  ids: readonly string[]
): Effect.Effect<BatchRestoreRecordsResponse, SessionContextError | ForbiddenError> {
  return Effect.gen(function* () {
    const restored = yield* batchRestoreRecords(session, tableName, ids)
    return {
      success: true as const,
      restored,
    }
  })
}

function upsertProgram(recordsData: readonly { id?: string; fields?: Record<string, unknown> }[]) {
  const records = recordsData.map((r) => ({
    id: r.id ?? crypto.randomUUID(),
    fields: r.fields ?? {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
  return Effect.succeed({
    records,
    created: recordsData.filter((r) => !r.id).length,
    updated: recordsData.filter((r) => r.id).length,
  })
}

// ============================================================================
// View Route Handlers
// ============================================================================

function listViewsProgram() {
  return Effect.succeed({ views: [] })
}

function getViewProgram(tableId: string, viewId: string) {
  return Effect.succeed({
    view: {
      id: viewId,
      name: 'Default View',
      tableId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
}

function getViewRecordsProgram() {
  return Effect.succeed({
    records: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  })
}

// ============================================================================
// Route Chaining Functions (split for max-lines-per-function)
// ============================================================================

/* eslint-disable drizzle/enforce-delete-with-where -- These are Hono route methods, not Drizzle queries */

function chainTableRoutesMethods<T extends Hono>(honoApp: T) {
  return honoApp
    .get('/api/tables', async (c) =>
      runEffect(c, createListTablesProgram(), listTablesResponseSchema)
    )
    .get('/api/tables/:tableId', async (c) =>
      runEffect(c, createGetTableProgram(c.req.param('tableId')), getTableResponseSchema)
    )
    .get('/api/tables/:tableId/permissions', async (c) =>
      runEffect(c, createGetPermissionsProgram(), getTablePermissionsResponseSchema)
    )
}

// eslint-disable-next-line max-lines-per-function -- Route chaining requires more lines for session extraction and auth checks
function chainRecordRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return honoApp
    .get('/api/tables/:tableId/records', async (c) => {
      // Extract session from context (set by auth middleware)
      const { session } = (c as ContextWithSession).var
      if (!session) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
      }

      // Get table name from route parameter
      const tableId = c.req.param('tableId')
      const tableName = getTableNameFromId(app, tableId)
      if (!tableName) {
        return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
      }

      return runEffect(c, createListRecordsProgram(session, tableName), listRecordsResponseSchema)
    })
    .post('/api/tables/:tableId/records', async (c) => {
      const { session } = (c as ContextWithSession).var
      if (!session) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
      }

      const result = await validateRequest(c, createRecordRequestSchema)
      if (!result.success) return result.response

      // Get table name from route parameter
      const tableId = c.req.param('tableId')
      const tableName = getTableNameFromId(app, tableId)
      if (!tableName) {
        return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
      }

      return runEffect(
        c,
        createRecordProgram(session, tableName, result.data.fields),
        createRecordResponseSchema
      )
    })
    .get('/api/tables/:tableId/records/:recordId', async (c) => {
      const { session } = (c as ContextWithSession).var
      if (!session) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
      }

      // Get table name from route parameter
      const tableId = c.req.param('tableId')
      const tableName = getTableNameFromId(app, tableId)
      if (!tableName) {
        return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
      }

      return runEffect(
        c,
        createGetRecordProgram(session, tableName, c.req.param('recordId')),
        getRecordResponseSchema
      )
    })
    .patch('/api/tables/:tableId/records/:recordId', async (c) => {
      const { session } = (c as ContextWithSession).var
      if (!session) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
      }

      const result = await validateRequest(c, updateRecordRequestSchema)
      if (!result.success) return result.response

      // Get table name from route parameter
      const tableId = c.req.param('tableId')
      const tableName = getTableNameFromId(app, tableId)
      if (!tableName) {
        return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
      }

      return runEffect(
        c,
        updateRecordProgram(session, tableName, c.req.param('recordId'), result.data.fields),
        updateRecordResponseSchema
      )
    })
    .delete('/api/tables/:tableId/records/:recordId', async (c) => {
      const { session } = (c as ContextWithSession).var
      if (!session) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
      }

      // Get table name from route parameter
      const tableId = c.req.param('tableId')
      const tableName = getTableNameFromId(app, tableId)
      if (!tableName) {
        return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
      }

      try {
        const deleted = await Effect.runPromise(
          deleteRecord(session, tableName, c.req.param('recordId'))
        )

        if (!deleted) {
          return c.json({ error: 'Record not found' }, 404)
        }

        // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null for empty responses
        return c.body(null, 204) // 204 No Content
      } catch (error) {
        return c.json(
          {
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          500
        )
      }
    })
    .post('/api/tables/:tableId/records/:recordId/restore', async (c) => {
      const { session } = (c as ContextWithSession).var
      if (!session) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
      }

      // Get table name from route parameter
      const tableId = c.req.param('tableId')
      const tableName = getTableNameFromId(app, tableId)
      if (!tableName) {
        return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
      }

      try {
        const result = await Effect.runPromise(
          restoreRecordProgram(session, tableName, c.req.param('recordId'))
        )

        return c.json(result, 200)
      } catch (error) {
        // Handle specific error messages
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        if (errorMessage === 'Record not found') {
          return c.json({ error: 'Record not found' }, 404)
        }

        if (errorMessage === 'Record is not deleted') {
          return c.json({ error: 'Bad Request', message: 'Record is not deleted' }, 400)
        }

        return c.json(
          {
            error: 'Internal server error',
            message: errorMessage,
          },
          500
        )
      }
    })
}

// eslint-disable-next-line max-lines-per-function -- Batch routes with authorization checks require multiple steps
function chainBatchRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return (
    honoApp
      // IMPORTANT: More specific route (batch/restore) must come BEFORE generic batch routes
      .post('/api/tables/:tableId/records/batch/restore', async (c) => {
        const { session } = (c as ContextWithSession).var
        if (!session) {
          return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
        }

        // Authorization check BEFORE validation (viewers cannot restore, regardless of input validity)
        const { db } = await import('@/infrastructure/database')
        const userResult = (await db.execute(
          `SELECT role FROM "_sovrium_auth_users" WHERE id = '${session.userId.replace(/'/g, "''")}' LIMIT 1`
        )) as Array<{ role: string | null }>
        const userRole = userResult[0]?.role

        if (userRole === 'viewer') {
          return c.json(
            {
              error: 'Forbidden',
              message: 'You do not have permission to restore records in this table',
            },
            403
          )
        }

        const result = await validateRequest(c, batchRestoreRecordsRequestSchema)
        if (!result.success) return result.response

        const tableId = c.req.param('tableId')
        const tableName = getTableNameFromId(app, tableId)
        if (!tableName) {
          return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
        }

        try {
          const response = await Effect.runPromise(
            batchRestoreProgram(session, tableName, result.data.ids)
          )
          return c.json(response, 200)
        } catch (error) {
          return handleBatchRestoreError(c, error)
        }
      })
      // Generic batch routes AFTER more specific batch/restore route
      .post('/api/tables/:tableId/records/batch', async (c) => {
        const result = await validateRequest(c, batchCreateRecordsRequestSchema)
        if (!result.success) return result.response
        return runEffect(
          c,
          batchCreateProgram(result.data.records),
          batchCreateRecordsResponseSchema
        )
      })
      .patch('/api/tables/:tableId/records/batch', async (c) => {
        const result = await validateRequest(c, batchUpdateRecordsRequestSchema)
        if (!result.success) return result.response
        return runEffect(
          c,
          batchUpdateProgram(result.data.records),
          batchUpdateRecordsResponseSchema
        )
      })
      .delete('/api/tables/:tableId/records/batch', async (c) => {
        const result = await validateRequest(c, batchDeleteRecordsRequestSchema)
        if (!result.success) return result.response
        return runEffect(c, batchDeleteProgram(result.data.ids), batchDeleteRecordsResponseSchema)
      })
      .post('/api/tables/:tableId/records/upsert', async (c) => {
        const result = await validateRequest(c, upsertRecordsRequestSchema)
        if (!result.success) return result.response
        return runEffect(c, upsertProgram(result.data.records), upsertRecordsResponseSchema)
      })
  )
}

function chainViewRoutesMethods<T extends Hono>(honoApp: T) {
  return honoApp
    .get('/api/tables/:tableId/views', async (c) =>
      runEffect(c, listViewsProgram(), listViewsResponseSchema)
    )
    .get('/api/tables/:tableId/views/:viewId', async (c) =>
      runEffect(
        c,
        getViewProgram(c.req.param('tableId'), c.req.param('viewId')),
        getViewResponseSchema
      )
    )
    .get('/api/tables/:tableId/views/:viewId/records', async (c) =>
      runEffect(c, getViewRecordsProgram(), getViewRecordsResponseSchema)
    )
}

/* eslint-enable drizzle/enforce-delete-with-where */

/**
 * Chain table routes onto a Hono app
 *
 * Uses method chaining for proper Hono RPC type inference.
 *
 * @param honoApp - Hono instance to chain routes onto
 * @param app - Application configuration containing table metadata
 * @returns Hono app with table routes chained
 */
export function chainTableRoutes<T extends Hono>(honoApp: T, app: App) {
  // Route registration order matters for Hono's router.
  // More specific routes (batch/restore) must be registered BEFORE
  // parameterized routes (:recordId/restore) to avoid route collisions.
  return chainViewRoutesMethods(
    chainRecordRoutesMethods(chainBatchRoutesMethods(chainTableRoutesMethods(honoApp), app), app)
  )
}
