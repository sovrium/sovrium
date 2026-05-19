/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
} from '@/domain/models/api/tables/tables'
import { getSessionContext, getTableContext } from '@/presentation/api/utils/context-helpers'
import { runEffect } from '@/presentation/api/utils/run-effect'
import { handleExportTableCsv } from './export-handlers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

async function handleListTables(c: Context, app: App) {
  const session = getSessionContext(c)!

  const userRole = await getUserRole(session.userId)

  const program = Effect.gen(function* () {
    const result = yield* createListTablesProgram(userRole, app)
    return z.array(z.unknown()).parse(result)
  })

  return runEffect(c, program)
}

async function handleGetTable(c: Context, app: App) {
  const { tableId, userRole } = getTableContext(c)

  const program = Effect.gen(function* () {
    const result = yield* createGetTableProgram(tableId, app, userRole)
    const validated = getTableResponseSchema.parse(result)
    return validated.table
  })

  return runEffect(c, program)
}

async function handleGetPermissions(c: Context, app: App) {
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
    .get('/api/tables/:tableId/export', (c) => handleExportTableCsv(c, app))
}
