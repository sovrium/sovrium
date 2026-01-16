/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { z } from 'zod'
import {
  getTableResponseSchema,
  getTablePermissionsResponseSchema,
} from '@/presentation/api/schemas/tables-schemas'
import {
  createListTablesProgram,
  createGetTableProgram,
  createGetPermissionsProgram,
} from './programs'
import { getUserRole } from './utils'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { Context, Hono } from 'hono'

// Handler for GET /api/tables
async function handleListTables(c: Context, app: App) {
  const { session } = (c as ContextWithSession).var
  if (!session) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
  }

  const userRole = await getUserRole(session.userId, session.activeOrganizationId)

  try {
    const program = createListTablesProgram(userRole, app)
    const result = await Effect.runPromise(program)
    const validated = z.array(z.unknown()).parse(result)
    return c.json(validated, 200)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage === 'FORBIDDEN_LIST_TABLES') {
      return c.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to list tables',
        },
        403
      )
    }
    return c.json(
      {
        error: 'Internal server error',
        message: errorMessage,
      },
      500
    )
  }
}

// Handler for GET /api/tables/:tableId
async function handleGetTable(c: Context, app: App) {
  const { session } = (c as ContextWithSession).var
  if (!session) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
  }
  const userRole = await getUserRole(session.userId, session.activeOrganizationId)
  try {
    const program = createGetTableProgram(c.req.param('tableId'), app, userRole)
    const result = await Effect.runPromise(program)
    const validated = getTableResponseSchema.parse(result)
    // Return the table object directly (unwrapped) to match test expectations
    return c.json(validated.table, 200)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage === 'TABLE_NOT_FOUND') {
      return c.json({ error: 'Table not found' }, 404)
    }
    if (errorMessage === 'FORBIDDEN') {
      return c.json(
        {
          error: 'Forbidden',
          message: 'You do not have permission to access this table',
        },
        403
      )
    }
    return c.json(
      {
        error: 'Internal server error',
        message: errorMessage,
      },
      500
    )
  }
}

// Handler for GET /api/tables/:tableId/permissions
async function handleGetPermissions(c: Context, app: App) {
  const { session } = (c as ContextWithSession).var
  if (!session) {
    return c.json({ error: 'Unauthorized', message: 'Authentication required' }, 401)
  }

  const tableId = c.req.param('tableId')
  const userRole = await getUserRole(session.userId, session.activeOrganizationId)

  try {
    const program = createGetPermissionsProgram(tableId, app, userRole)
    const result = await Effect.runPromise(program)
    const validated = getTablePermissionsResponseSchema.parse(result)
    return c.json(validated, 200)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage === 'TABLE_NOT_FOUND') {
      return c.json({ error: 'Table not found' }, 404)
    }
    return c.json(
      {
        error: 'Internal server error',
        message: errorMessage,
      },
      500
    )
  }
}

export function chainTableRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return honoApp
    .get('/api/tables', (c) => handleListTables(c, app))
    .get('/api/tables/:tableId', (c) => handleGetTable(c, app))
    .get('/api/tables/:tableId/permissions', (c) => handleGetPermissions(c, app))
}
