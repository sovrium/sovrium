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
import { getUserGroups } from '@/application/use-cases/tables/user-groups'
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
import { resolveAccessRolesFor } from './row-level-guard'
import { resolveTableReadCaller } from './table-read-caller'
import {
  denyUnlessWebhookAdmin,
  handleGetDelivery,
  handleListDeliveries,
  handleRetryDelivery,
  handleTestWebhook,
} from './webhook-delivery-handlers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

// Handler for GET /api/tables
// Note: This route doesn't have :tableId, so validateTable/enrichUserRole don't run.
// With `auth`, requireAuth guarantees a session; without it no session is ever
// mounted and every caller is the guest, as on the records routes.
async function handleListTables(c: Context, app: App) {
  const session = app.auth === undefined ? undefined : getSessionContext(c)
  const [userRole, userGroups] =
    session === undefined
      ? ['guest', []]
      : await Promise.all([
          runDomainPromise(c, getUserRole(session.userId)),
          runDomainPromise(c, getUserGroups(session.userId)),
        ])
  // The `user_access` roles the records route adds on a table with row-level
  // rules, so the list names exactly the tables those records admit.
  const accessRoles = await resolveAccessRolesFor(session, app.tables ?? [])

  const program = Effect.gen(function* () {
    const result = yield* createListTablesProgram(
      { role: userRole, groups: userGroups, accessRoles },
      app
    )
    return decodeOrThrow(Schema.Array(Schema.Unknown))(result)
  })

  return runEffect(c, program)
}

// Handler for GET /api/tables/:tableId
async function handleGetTable(c: Context, app: App) {
  // Session, tableId, and userRole are guaranteed by middleware chain
  const { session, tableName, tableId, userRole, userGroups } = getTableContext(c)
  const caller = await resolveTableReadCaller(app, { session, tableName, userRole, userGroups })

  const program = Effect.gen(function* () {
    const result = yield* createGetTableProgram(tableId, app, caller)
    const validated = decodeOrThrow(getTableResponseSchema)(result)
    // Return the table object directly (unwrapped) to match test expectations
    return validated.table
  })

  return runEffect(c, program)
}

// Handler for GET /api/tables/:tableId/webhooks
// Lists the outgoing webhook configurations declared on a table, to admins
// only (every other caller gets the missing-table 404). Webhook secrets are
// stripped from the response so auth credentials never leak.
function handleListWebhooks(c: Context, app: App) {
  const denied = denyUnlessWebhookAdmin(c, app)
  if (denied) return denied
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
  // Session, tableId, and userRole are guaranteed by middleware chain. The
  // caller is resolved as the records route resolves her — assignment roles
  // included on a table with row-level rules — so the map admits whom they do.
  const { session, tableName, tableId, userRole, userGroups } = getTableContext(c)
  const caller = await resolveTableReadCaller(app, { session, tableName, userRole, userGroups })

  const program = Effect.gen(function* () {
    const result = yield* createGetPermissionsProgram(tableId, app, caller)
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
