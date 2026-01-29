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
import { runEffect } from '@/presentation/api/utils/run-effect'
import { getSessionContext, getTableContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

// Handler for GET /api/tables
// Note: This route doesn't have :tableId, so only session is guaranteed by middleware
// (requireAuth ensures session exists, but validateTable/enrichUserRole don't run)
async function handleListTables(c: Context, app: App) {
  // Session is guaranteed by requireAuth() middleware (non-null assertion safe)
  const session = getSessionContext(c)!

  // Fetch userRole manually since enrichUserRole middleware doesn't run on /api/tables
  const userRole = await getUserRole(session.userId)

  const program = Effect.gen(function* () {
    const result = yield* createListTablesProgram(userRole, app)
    return z.array(z.unknown()).parse(result)
  })

  return runEffect(c, program)
}

// Handler for GET /api/tables/:tableId
async function handleGetTable(c: Context, app: App) {
  // Session, tableId, and userRole are guaranteed by middleware chain
  const { tableId, userRole } = getTableContext(c)

  const program = Effect.gen(function* () {
    const result = yield* createGetTableProgram(tableId, app, userRole)
    const validated = getTableResponseSchema.parse(result)
    // Return the table object directly (unwrapped) to match test expectations
    return validated.table
  })

  return runEffect(c, program)
}

// Handler for GET /api/tables/:tableId/permissions
async function handleGetPermissions(c: Context, app: App) {
  // Session, tableId, and userRole are guaranteed by middleware chain
  const { tableId, userRole } = getTableContext(c)

  const program = Effect.gen(function* () {
    const result = yield* createGetPermissionsProgram(tableId, app, userRole)
    return getTablePermissionsResponseSchema.parse(result)
  })

  return runEffect(c, program)
}

export function chainTableRoutesMethods<T extends Hono>(honoApp: T, app: App) {
  return honoApp
    .get('/api/tables', (c) => handleListTables(c, app))
    .get('/api/tables/:tableId', (c) => handleGetTable(c, app))
    .get('/api/tables/:tableId/permissions', (c) => handleGetPermissions(c, app))
}
