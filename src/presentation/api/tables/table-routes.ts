/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Schema } from 'effect'
import {
  createListTablesProgram,
  createGetTableProgram,
  createGetPermissionsProgram,
} from '@/application/use-cases/tables/table-operations'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { decodeOrThrow } from '@/domain/models/api/combinators/decode'
import {
  getTableResponseSchema,
  getTablePermissionsResponseSchema,
} from '@/domain/models/api/tables/tables'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { getSessionContext, getTableContext } from '@/presentation/api/runtime/context-helpers'
import { runEffect } from '@/presentation/api/runtime/run-effect'
import { handleExportTableCsv } from './export-handlers'
import {
  handleGetDelivery,
  handleListDeliveries,
  handleRetryDelivery,
  handleTestWebhook,
} from './webhook-delivery-handlers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

// Handler for GET /api/tables
// Note: This route doesn't have :tableId, so only session is guaranteed by middleware
// (requireAuth ensures session exists, but validateTable/enrichUserRole don't run)
async function handleListTables(c: Context, app: App) {
  // Session is guaranteed by requireAuth() middleware (non-null assertion safe)
  const session = getSessionContext(c)!

  // Fetch userRole manually since enrichUserRole middleware doesn't run on /api/tables
  const userRole = await runDomainPromise(c, getUserRole(session.userId))

  const program = Effect.gen(function* () {
    const result = yield* createListTablesProgram(userRole, app)
    return decodeOrThrow(Schema.Array(Schema.Unknown))(result)
  })

  return runEffect(c, program)
}

// Handler for GET /api/tables/:tableId
async function handleGetTable(c: Context, app: App) {
  // Session, tableId, and userRole are guaranteed by middleware chain
  const { tableId, userRole } = getTableContext(c)

  const program = Effect.gen(function* () {
    const result = yield* createGetTableProgram(tableId, app, userRole)
    const validated = decodeOrThrow(getTableResponseSchema)(result)
    // Return the table object directly (unwrapped) to match test expectations
    return validated.table
  })

  return runEffect(c, program)
}

// Handler for GET /api/tables/:tableId/webhooks
// Lists the outgoing webhook configurations declared on a table. Webhook
// secrets are stripped from the response so auth credentials never leak.
function handleListWebhooks(c: Context, app: App) {
  const { tableId } = getTableContext(c)
  const table = app.tables?.find((t) => t.name === tableId)
  const webhooks = (table?.webhooks ?? []).map((webhook) => ({
    name: webhook.name,
    url: webhook.url,
    events: webhook.events,
    enabled: webhook.enabled !== false,
  }))
  return c.json({ webhooks }, 200)
}

// Handler for GET /api/tables/:tableId/permissions
async function handleGetPermissions(c: Context, app: App) {
  // Session, tableId, and userRole are guaranteed by middleware chain
  const { tableId, userRole } = getTableContext(c)

  const program = Effect.gen(function* () {
    const result = yield* createGetPermissionsProgram(tableId, app, userRole)
    return decodeOrThrow(getTablePermissionsResponseSchema)(result)
  })

  return runEffect(c, program)
}

export function chainTableRoutesMethods<T extends Hono>(honoApp: T, resolveApp: () => App) {
  return honoApp
    .get('/api/tables', (c) => handleListTables(c, resolveApp()))
    .get('/api/tables/:tableId', (c) => handleGetTable(c, resolveApp()))
    .get('/api/tables/:tableId/permissions', (c) => handleGetPermissions(c, resolveApp()))
    .get('/api/tables/:tableId/webhooks', (c) => handleListWebhooks(c, resolveApp()))
    .get('/api/tables/:tableId/webhooks/:webhookName/deliveries', (c) =>
      handleListDeliveries(c, resolveApp())
    )
    .get('/api/tables/:tableId/webhooks/:webhookName/deliveries/:deliveryId', (c) =>
      handleGetDelivery(c, resolveApp())
    )
    .post('/api/tables/:tableId/webhooks/:webhookName/deliveries/:deliveryId/retry', (c) =>
      handleRetryDelivery(c, resolveApp())
    )
    .post('/api/tables/:tableId/webhooks/:webhookName/test', (c) =>
      handleTestWebhook(c, resolveApp())
    )
    .get('/api/tables/:tableId/export', (c) => handleExportTableCsv(c, resolveApp()))
}
