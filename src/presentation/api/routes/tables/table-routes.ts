/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { z } from 'zod'
import {
  createListTablesProgram,
  createGetTableProgram,
  createGetPermissionsProgram,
} from '@/application/use-cases/tables/programs'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import {
  getTableResponseSchema,
  getTablePermissionsResponseSchema,
} from '@/presentation/api/schemas/tables-schemas'
import type { App } from '@/domain/models/app'
import type { ContextWithSession } from '@/presentation/api/middleware/auth'
import type { ContextWithTableAndRole } from '@/presentation/api/middleware/table'
import type { Context, Hono } from 'hono'

// Handler for GET /api/tables
// Note: This route doesn't have :tableId, so only session is guaranteed by middleware
// (requireAuth ensures session exists, but validateTable/enrichUserRole don't run)
async function handleListTables(c: Context, app: App) {
  // Session is guaranteed by requireAuth() middleware (non-null assertion safe)
  const session = (c as ContextWithSession).var.session!

  // Fetch userRole manually since enrichUserRole middleware doesn't run on /api/tables
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
  // Session, tableId, and userRole are guaranteed by middleware chain
  const { tableId, userRole } = (c as ContextWithTableAndRole).var

  try {
    const program = createGetTableProgram(tableId, app, userRole)
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
  // Session, tableId, and userRole are guaranteed by middleware chain
  const { tableId, userRole } = (c as ContextWithTableAndRole).var

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
