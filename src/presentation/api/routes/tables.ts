/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
// eslint-disable-next-line boundaries/element-types -- Route handlers need database infrastructure for session context
import { SessionContextError } from '@/infrastructure/database/session-context'
import {
  createRecordRequestSchema,
  updateRecordRequestSchema,
  batchCreateRecordsRequestSchema,
  batchUpdateRecordsRequestSchema,
  batchDeleteRecordsRequestSchema,
  upsertRecordsRequestSchema,
} from '@/presentation/api/schemas/request-schemas'
import {
  listTablesResponseSchema,
  getTableResponseSchema,
  listRecordsResponseSchema,
  getRecordResponseSchema,
  createRecordResponseSchema,
  updateRecordResponseSchema,
  deleteRecordResponseSchema,
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
} from '@/presentation/api/schemas/tables-schemas'
import { runEffect, validateRequest } from '@/presentation/api/utils'
import {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} from '@/presentation/api/utils/table-queries'
import type { App } from '@/domain/models/app'
// eslint-disable-next-line boundaries/element-types -- Route handlers need auth types for session management
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Hono } from 'hono'

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
      records: records.map((r) => ({
        id: String(r.id),
        fields: r as Record<
          string,
          string | number | boolean | unknown[] | Record<string, unknown> | null
        >,
        createdAt: r.created_at ? String(r.created_at) : new Date().toISOString(),
        updatedAt: r.updated_at ? String(r.updated_at) : new Date().toISOString(),
      })),
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

    return {
      record: {
        id: String(record.id),
        fields: record as Record<
          string,
          string | number | boolean | unknown[] | Record<string, unknown> | null
        >,
        createdAt: record.created_at ? String(record.created_at) : new Date().toISOString(),
        updatedAt: record.updated_at ? String(record.updated_at) : new Date().toISOString(),
      },
    }
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

    return {
      record: {
        id: String(record.id),
        fields: record as Record<
          string,
          string | number | boolean | unknown[] | Record<string, unknown> | null
        >,
        createdAt: record.created_at ? String(record.created_at) : new Date().toISOString(),
        updatedAt: record.updated_at ? String(record.updated_at) : new Date().toISOString(),
      },
    }
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

    return {
      record: {
        id: String(record.id),
        fields: record as Record<
          string,
          string | number | boolean | unknown[] | Record<string, unknown> | null
        >,
        createdAt: record.created_at ? String(record.created_at) : new Date().toISOString(),
        updatedAt: record.updated_at ? String(record.updated_at) : new Date().toISOString(),
      },
    }
  })
}

function deleteRecordProgram(session: Readonly<Session>, tableName: string, recordId: string) {
  return Effect.gen(function* () {
    // Delete record with session context (RLS policies enforce access control)
    yield* deleteRecord(session, tableName, recordId)

    return { success: true as const }
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

      return runEffect(
        c,
        deleteRecordProgram(session, tableName, c.req.param('recordId')),
        deleteRecordResponseSchema
      )
    })
}

function chainBatchRoutesMethods<T extends Hono>(honoApp: T) {
  return honoApp
    .post('/api/tables/:tableId/records/batch', async (c) => {
      const result = await validateRequest(c, batchCreateRecordsRequestSchema)
      if (!result.success) return result.response
      return runEffect(c, batchCreateProgram(result.data.records), batchCreateRecordsResponseSchema)
    })
    .patch('/api/tables/:tableId/records/batch', async (c) => {
      const result = await validateRequest(c, batchUpdateRecordsRequestSchema)
      if (!result.success) return result.response
      return runEffect(c, batchUpdateProgram(result.data.records), batchUpdateRecordsResponseSchema)
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
  return chainViewRoutesMethods(
    chainBatchRoutesMethods(chainRecordRoutesMethods(chainTableRoutesMethods(honoApp), app))
  )
}
