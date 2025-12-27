/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines -- Routes file with many endpoints */

import { Effect } from 'effect'
import { z } from 'zod'
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
  getTableResponseSchema,
  listRecordsResponseSchema,
  getRecordResponseSchema,
  createRecordResponseSchema,
  batchCreateRecordsResponseSchema,
  batchUpdateRecordsResponseSchema,
  batchDeleteRecordsResponseSchema,
  upsertRecordsResponseSchema,
  listViewsResponseSchema,
  getViewResponseSchema,
  getViewRecordsResponseSchema,
  getTablePermissionsResponseSchema,
  type GetTableResponse,
  type ListRecordsResponse,
  type GetRecordResponse,
  type RestoreRecordResponse,
  type BatchRestoreRecordsResponse,
} from '@/presentation/api/schemas/tables-schemas'
import { runEffect, validateRequest } from '@/presentation/api/utils'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import { filterReadableFields } from '@/presentation/api/utils/field-read-filter'
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
 * Check if a string contains authorization-related keywords
 */
const containsAuthKeywords = (text: string): boolean =>
  text.includes('not found') || text.includes('access denied')

/**
 * Check if error is an authorization error (SessionContextError or access denied)
 *
 * @param error - The error to check
 * @returns true if error is authorization-related (should return 404 instead of 500)
 */
const isAuthorizationError = (error: unknown): boolean => {
  const errorMessage = error instanceof Error ? error.message : ''
  const errorName = error instanceof Error ? error.name : ''
  const errorString = String(error)
  const causeMessage =
    error instanceof Error && 'cause' in error && error.cause instanceof Error
      ? error.cause.message
      : ''

  return (
    containsAuthKeywords(errorMessage) ||
    containsAuthKeywords(causeMessage) ||
    errorName.includes('SessionContextError') ||
    errorString.includes('SessionContextError')
  )
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

function createListTablesProgram(): Effect.Effect<unknown[], never> {
  return Effect.succeed([])
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
  tableName: string,
  app: App,
  userRole: string
): Effect.Effect<ListRecordsResponse, SessionContextError> {
  return Effect.gen(function* () {
    // Query records with session context (RLS policies automatically applied)
    const records = yield* listRecords(session, tableName)

    // Apply field-level read permissions filtering
    // Note: Row-level ownership filtering is handled by RLS policies
    // Field-level filtering is handled at application layer
    const { userId } = session
    const filteredRecords = records.map((record) =>
      filterReadableFields({ app, tableName, userRole, userId, record })
    )

    return {
      records: transformRecords(filteredRecords),
      pagination: {
        page: 1,
        limit: 10,
        total: filteredRecords.length,
        totalPages: Math.ceil(filteredRecords.length / 10),
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }
  })
}

/**
 * Retrieves the user's role from the database
 *
 * Role resolution priority:
 * 1. If active organization: check members table for org-specific role
 * 2. If no active organization or no membership: check global user role from users table
 * 3. Default: 'member'
 */
async function getUserRole(userId: string, activeOrganizationId?: string | null): Promise<string> {
  const { db } = await import('@/infrastructure/database')

  // If active organization, check members table first
  if (activeOrganizationId) {
    const memberResult = (await db.execute(
      `SELECT role FROM "_sovrium_auth_members" WHERE organization_id = '${activeOrganizationId.replace(/'/g, "''")}' AND user_id = '${userId.replace(/'/g, "''")}' LIMIT 1`
    )) as Array<{ role: string | null }>

    if (memberResult[0]?.role) {
      return memberResult[0].role
    }
  }

  // Fall back to global user role from users table
  const userResult = (await db.execute(
    `SELECT role FROM "_sovrium_auth_users" WHERE id = '${userId.replace(/'/g, "''")}' LIMIT 1`
  )) as Array<{ role: string | null }>
  return userResult[0]?.role || 'member'
}

interface GetRecordConfig {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly userRole: string
}

/**
 * Check if record passes organization isolation check
 * Returns true if access is allowed, false if denied
 */
function passesOrganizationCheck(
  record: Readonly<Record<string, unknown>>,
  activeOrganizationId: string | null | undefined
): boolean {
  const recordOrgId = record['organization_id']
  if (recordOrgId === undefined || !activeOrganizationId) return true
  return String(recordOrgId) === String(activeOrganizationId)
}

/**
 * Check if record passes ownership check
 * Returns true if access is allowed, false if denied
 */
function passesOwnershipCheck(
  record: Readonly<Record<string, unknown>>,
  userId: string,
  app: App,
  tableName: string
): boolean {
  const recordUserId = record['user_id'] ?? record['owner_id']
  const table = app.tables?.find((t) => t.name === tableName)
  const hasOwnerField = table?.fields.some((f) => f.name === 'user_id' || f.name === 'owner_id')
  if (!hasOwnerField || recordUserId === undefined) return true
  return String(recordUserId) === String(userId)
}

function createGetRecordProgram(
  config: GetRecordConfig
): Effect.Effect<GetRecordResponse, SessionContextError> {
  return Effect.gen(function* () {
    const { session, tableName, recordId, app, userRole } = config
    const { userId, activeOrganizationId } = session

    const record = yield* getRecord(session, tableName, recordId)
    if (!record) return yield* Effect.fail(new SessionContextError('Record not found'))

    // Enforce organization isolation (return 404 to prevent enumeration)
    if (!passesOrganizationCheck(record, activeOrganizationId)) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    // Enforce ownership check (return 404 to prevent enumeration)
    if (!passesOwnershipCheck(record, userId, app, tableName)) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    const filteredRecord = filterReadableFields({ app, tableName, userRole, userId, record })
    return { record: transformRecord(filteredRecord) }
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
    .get('/api/tables', async (c) => {
      const { session } = (c as ContextWithSession).var
      if (!session) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
      }
      return runEffect(c, createListTablesProgram(), z.array(z.unknown()))
    })
    .get('/api/tables/:tableId', async (c) => {
      const { session } = (c as ContextWithSession).var
      if (!session) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
      }
      return runEffect(c, createGetTableProgram(c.req.param('tableId')), getTableResponseSchema)
    })
    .get('/api/tables/:tableId/permissions', async (c) => {
      const { session } = (c as ContextWithSession).var
      if (!session) {
        return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
      }
      return runEffect(c, createGetPermissionsProgram(), getTablePermissionsResponseSchema)
    })
}

// eslint-disable-next-line max-lines-per-function -- Route chaining requires more lines for session extraction and auth checks
function chainRecordRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return (
    honoApp
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

        // Query user role from database (for field-level read permissions)
        const userRole = await getUserRole(session.userId, session.activeOrganizationId)

        return runEffect(
          c,
          createListRecordsProgram(session, tableName, app, userRole),
          listRecordsResponseSchema
        )
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
          createRecordResponseSchema,
          201
        )
      })
      // eslint-disable-next-line complexity -- Error handling for authorization requires multiple checks
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

        // Query user role from database (for field-level read permissions)
        const userRole = await getUserRole(session.userId, session.activeOrganizationId)

        try {
          const program = createGetRecordProgram({
            session,
            tableName,
            recordId: c.req.param('recordId'),
            app,
            userRole,
          })
          const result = await Effect.runPromise(program)
          const validated = getRecordResponseSchema.parse(result)
          return c.json(validated, 200)
        } catch (error) {
          // Check if error indicates authorization failure or record not found
          // Effect wraps errors, so check both message and error name
          const errorMessage = error instanceof Error ? error.message : String(error)
          const errorName = error instanceof Error ? error.name : ''
          const errorString = String(error)

          // Check if it's a SessionContextError (authorization/not found)
          if (
            errorMessage.includes('Record not found') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('access denied') ||
            errorName.includes('SessionContextError') ||
            errorString.includes('SessionContextError')
          ) {
            // Return 404 for authorization failures to prevent enumeration
            return c.json({ error: 'Record not found' }, 404)
          }

          // For other errors, return 500
          return c.json(
            {
              error: 'Internal server error',
              message: errorMessage,
            },
            500
          )
        }
      })
      // eslint-disable-next-line max-lines-per-function, max-statements, complexity -- TODO: Refactor this handler into smaller functions
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

        // Query user role from database (check org-specific role first)
        const userRole = await getUserRole(session.userId, session.activeOrganizationId)

        // Check table-level update permissions
        const table = app.tables?.find((t) => t.name === tableName)
        const updatePermission = table?.permissions?.update

        if (updatePermission?.type === 'roles') {
          const allowedRoles = updatePermission.roles || []
          if (!allowedRoles.includes(userRole)) {
            return c.json(
              {
                error: 'Forbidden',
                message: 'You do not have permission to update records in this table',
              },
              403
            )
          }
        }

        // Validate field write permissions
        const forbiddenFields = validateFieldWritePermissions(app, tableName, userRole, result.data)
        if (forbiddenFields.length > 0) {
          return c.json(
            {
              error: 'Forbidden',
              message: `You do not have permission to modify field(s): ${forbiddenFields.join(', ')}`,
            },
            403
          )
        }

        // Execute update with RLS enforcement
        try {
          const updateResult = await Effect.runPromise(
            updateRecordProgram(session, tableName, c.req.param('recordId'), result.data)
          )

          // Check if update affected any rows (RLS may have blocked it)
          if (!updateResult.record || Object.keys(updateResult.record).length === 0) {
            return c.json({ error: 'Record not found' }, 404)
          }

          return c.json(updateResult, 200)
        } catch (error) {
          // Return 404 for authorization failures to prevent enumeration
          if (isAuthorizationError(error)) {
            return c.json({ error: 'Record not found' }, 404)
          }

          return c.json(
            {
              error: 'Internal server error',
              message: error instanceof Error ? error.message : 'Unknown error',
            },
            500
          )
        }
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
          // Return 404 for authorization failures to prevent enumeration
          if (isAuthorizationError(error)) {
            return c.json({ error: 'Record not found' }, 404)
          }

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
  )
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
