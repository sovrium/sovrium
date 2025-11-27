/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { errorResponseSchema } from '@/domain/models/api/error-schemas'
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
} from '@/domain/models/api/tables-schemas'
import type { Context, Hono } from 'hono'

/**
 * Helper to run Effect program and handle errors
 */
async function runEffect<T>(
  c: Context,
  program: Effect.Effect<T, Error>,
  schema: { parse: (data: T) => T }
) {
  try {
    const result = await Effect.runPromise(program)
    const validated = schema.parse(result)
    return c.json(validated, 200)
  } catch (error) {
    return c.json(
      errorResponseSchema.parse({
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
        code: 'INTERNAL_ERROR',
      }),
      500
    )
  }
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

function createListRecordsProgram(): Effect.Effect<ListRecordsResponse, never> {
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

function createGetRecordProgram(recordId: string): Effect.Effect<GetRecordResponse, never> {
  return Effect.succeed({
    record: {
      id: recordId,
      fields: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
}

function createRecordProgram(fields: Record<string, unknown>) {
  return Effect.succeed({
    record: {
      id: crypto.randomUUID(),
      fields,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
}

function updateRecordProgram(recordId: string, fields: Record<string, unknown>) {
  return Effect.succeed({
    record: {
      id: recordId,
      fields,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
}

function deleteRecordProgram() {
  return Effect.succeed({ success: true as const })
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

function batchUpdateProgram(recordsData: readonly { id: string; fields?: Record<string, unknown> }[]) {
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
    .get('/api/tables', async (c) => runEffect(c, createListTablesProgram(), listTablesResponseSchema))
    .get('/api/tables/:tableId', async (c) =>
      runEffect(c, createGetTableProgram(c.req.param('tableId')), getTableResponseSchema)
    )
    .get('/api/tables/:tableId/permissions', async (c) =>
      runEffect(c, createGetPermissionsProgram(), getTablePermissionsResponseSchema)
    )
}

function chainRecordRoutesMethods<T extends Hono>(honoApp: T) {
  return honoApp
    .get('/api/tables/:tableId/records', async (c) =>
      runEffect(c, createListRecordsProgram(), listRecordsResponseSchema)
    )
    .post('/api/tables/:tableId/records', async (c) => {
      const body = await c.req.json()
      return runEffect(c, createRecordProgram(body.fields ?? {}), createRecordResponseSchema)
    })
    .get('/api/tables/:tableId/records/:recordId', async (c) =>
      runEffect(c, createGetRecordProgram(c.req.param('recordId')), getRecordResponseSchema)
    )
    .patch('/api/tables/:tableId/records/:recordId', async (c) => {
      const body = await c.req.json()
      return runEffect(
        c,
        updateRecordProgram(c.req.param('recordId'), body.fields ?? {}),
        updateRecordResponseSchema
      )
    })
    .delete('/api/tables/:tableId/records/:recordId', async (c) =>
      runEffect(c, deleteRecordProgram(), deleteRecordResponseSchema)
    )
}

function chainBatchRoutesMethods<T extends Hono>(honoApp: T) {
  return honoApp
    .post('/api/tables/:tableId/records/batch', async (c) => {
      const body = await c.req.json()
      return runEffect(c, batchCreateProgram(body.records ?? []), batchCreateRecordsResponseSchema)
    })
    .patch('/api/tables/:tableId/records/batch', async (c) => {
      const body = await c.req.json()
      return runEffect(c, batchUpdateProgram(body.records ?? []), batchUpdateRecordsResponseSchema)
    })
    .delete('/api/tables/:tableId/records/batch', async (c) => {
      const body = await c.req.json()
      return runEffect(c, batchDeleteProgram(body.ids ?? []), batchDeleteRecordsResponseSchema)
    })
    .post('/api/tables/:tableId/records/upsert', async (c) => {
      const body = await c.req.json()
      return runEffect(c, upsertProgram(body.records ?? []), upsertRecordsResponseSchema)
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
 * @returns Hono app with table routes chained
 */
export function chainTableRoutes<T extends Hono>(honoApp: T) {
  return chainViewRoutesMethods(
    chainBatchRoutesMethods(chainRecordRoutesMethods(chainTableRoutesMethods(honoApp)))
  )
}
