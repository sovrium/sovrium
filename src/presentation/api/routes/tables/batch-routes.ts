/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { hasCreatePermission } from '@/application/use-cases/tables/permissions/permissions'
import {
  batchCreateProgram,
  batchUpdateProgram,
  batchDeleteProgram,
  batchRestoreProgram,
  upsertProgram,
} from '@/application/use-cases/tables/programs'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  batchCreateRecordsRequestSchema,
  batchUpdateRecordsRequestSchema,
  batchDeleteRecordsRequestSchema,
  batchRestoreRecordsRequestSchema,
  upsertRecordsRequestSchema,
} from '@/presentation/api/schemas/request-schemas'
import {
  batchCreateRecordsResponseSchema,
  batchUpdateRecordsResponseSchema,
  batchDeleteRecordsResponseSchema,
  upsertRecordsResponseSchema,
} from '@/presentation/api/schemas/tables-schemas'
import { runEffect, validateRequest } from '@/presentation/api/utils'
import { validateFieldWritePermissions } from '@/presentation/api/utils/field-permission-validator'
import { getSessionFromContext, validateAndGetTableName, handleBatchRestoreError } from './utils'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/* eslint-disable drizzle/enforce-delete-with-where -- These are Hono route methods, not Drizzle queries */

/**
 * Handle batch restore endpoint
 */
async function handleBatchRestore(c: Context, app: App) {
  const session = getSessionFromContext(c)
  if (!session) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
  }

  // Authorization check BEFORE validation
  const { db } = await import('@/infrastructure/database')
  const AUTH_TABLE_USERS = '_sovrium_auth_users'
  const userResult = (await db.execute(
    `SELECT role FROM "${AUTH_TABLE_USERS}" WHERE id = '${session.userId.replace(/'/g, "''")}' LIMIT 1`
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
  const tableName = validateAndGetTableName(app, tableId)
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
}

/**
 * Handle batch create endpoint
 */
async function handleBatchCreate(c: Context, app: App) {
  const session = getSessionFromContext(c)
  if (!session) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
  }

  const result = await validateRequest(c, batchCreateRecordsRequestSchema)
  if (!result.success) return result.response

  const tableId = c.req.param('tableId')
  const tableName = validateAndGetTableName(app, tableId)
  if (!tableName) {
    return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
  }

  const userRole = await getUserRole(session.userId, session.activeOrganizationId)

  const table = app.tables?.find((t) => t.name === tableName)
  if (!hasCreatePermission(table, userRole)) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'You do not have permission to create records in this table',
      },
      403
    )
  }

  const allForbiddenFields = result.data.records
    .map((record) => validateFieldWritePermissions(app, tableName, userRole, record))
    .filter((fields) => fields.length > 0)

  if (allForbiddenFields.length > 0) {
    const uniqueForbiddenFields = [...new Set(allForbiddenFields.flat())]
    return c.json(
      {
        error: 'Forbidden',
        message: `You do not have permission to modify field(s): ${uniqueForbiddenFields.join(', ')}`,
      },
      403
    )
  }

  return runEffect(
    c,
    batchCreateProgram(session, tableName, result.data.records),
    batchCreateRecordsResponseSchema,
    201
  )
}

/**
 * Handle batch update endpoint
 */
async function handleBatchUpdate(c: Context, app: App) {
  const session = getSessionFromContext(c)
  if (!session) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
  }

  const result = await validateRequest(c, batchUpdateRecordsRequestSchema)
  if (!result.success) return result.response

  const tableId = c.req.param('tableId')
  const tableName = validateAndGetTableName(app, tableId)
  if (!tableName) {
    return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
  }

  return runEffect(
    c,
    batchUpdateProgram(session, tableName, result.data.records),
    batchUpdateRecordsResponseSchema
  )
}

/**
 * Handle batch delete endpoint
 */
async function handleBatchDelete(c: Context, app: App) {
  const session = getSessionFromContext(c)
  if (!session) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
  }

  const result = await validateRequest(c, batchDeleteRecordsRequestSchema)
  if (!result.success) return result.response

  const tableId = c.req.param('tableId')
  const tableName = validateAndGetTableName(app, tableId)
  if (!tableName) {
    return c.json({ error: 'Not Found', message: `Table ${tableId} not found` }, 404)
  }

  return runEffect(
    c,
    batchDeleteProgram(session, tableName, result.data.ids),
    batchDeleteRecordsResponseSchema
  )
}

export function chainBatchRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return (
    honoApp
      // IMPORTANT: More specific route (batch/restore) must come BEFORE generic batch routes
      .post('/api/tables/:tableId/records/batch/restore', (c) => handleBatchRestore(c, app))
      // Generic batch routes AFTER more specific batch/restore route
      .post('/api/tables/:tableId/records/batch', (c) => handleBatchCreate(c, app))
      .patch('/api/tables/:tableId/records/batch', (c) => handleBatchUpdate(c, app))
      .delete('/api/tables/:tableId/records/batch', (c) => handleBatchDelete(c, app))
      .post('/api/tables/:tableId/records/upsert', async (c) => {
        const result = await validateRequest(c, upsertRecordsRequestSchema)
        if (!result.success) return result.response
        return runEffect(c, upsertProgram(result.data.records), upsertRecordsResponseSchema)
      })
  )
}

/* eslint-enable drizzle/enforce-delete-with-where */
