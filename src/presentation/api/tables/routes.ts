/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SPECIMEN_TABLE_NAME } from '@/domain/models/app/design/specimen-fixture'
import { refuseNonJsonBody } from '@/presentation/api/middleware/json-body'
import {
  validateTable,
  enrichUserRole,
  rejectNonKeyRecordId,
} from '@/presentation/api/middleware/table'
import { chainBatchRoutesMethods } from './batch-routes'
import { chainCalendarFeedReadRoute, chainCalendarFeedTokenRoutes } from './calendar-feed-routes'
import { chainRecordRoutesMethods } from './record-routes'
import { writesRecordLanguage } from './record-write-language'
import { handleListSpecimenTableRecords } from './specimen-handlers'
import { gateUnreadableTable } from './table-read-gate'
import { chainTableRoutesMethods } from './table-routes'
import { handleCreateUserAccessRecord, handleListUserAccessRecords } from './user-access-handlers'
import {
  handleDeleteUserAccessRecord,
  handleGetUserAccessRecord,
  handleUpdateUserAccessRecord,
} from './user-access-record-handlers'
import { chainViewRoutesMethods } from './view-routes'
import type { App } from '@/domain/models/app'
import type { Context, Hono, Next } from 'hono'

/**
 * Guest context middleware handler
 *
 * Creates a minimal guest session for apps without auth configuration.
 */
async function guestContextHandler(c: Context, next: Next) {
  // Create a minimal guest session for apps without auth
  const guestSession = {
    userId: 'guest',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    token: '',
    ipAddress: '',
    userAgent: '',
  }
  c.set('session', guestSession)
  c.set('userRole', 'guest')
  // Guests belong to no groups — keep the context shape consistent with the
  // authenticated path so the permission gates can always read userGroups.
  c.set('userGroups', [] as readonly string[])

  await next()
}

/**
 * Middleware to provide guest session and role for apps without authentication
 *
 * For apps without auth configuration, this middleware creates a minimal
 * guest session and sets the userRole to 'guest', allowing routes to function
 * without actual authentication while maintaining the expected context structure.
 */
function provideGuestContext() {
  return guestContextHandler
}

/**
 * Z-2: Register the multi-tenant `user_access` junction routes BEFORE
 * applying `validateTable` middleware. user_access is an engine-managed
 * junction (DDL created at startup when `auth.scopeTables` is set), not a
 * user-defined table in `app.tables[]`, so the table-name lookup in
 * `validateTable` would otherwise return 404 for these endpoints.
 *
 * Middleware applied via `.use()` only affects routes registered AFTER the
 * `.use()` call. Registering user_access routes first means they bypass
 * validateTable / enrichUserRole / guest context — which is correct: this
 * junction has its own per-row validation (auth.scopeTables / auth.roles).
 * Auth middleware applied higher up in `compose-api-routes.ts` still runs.
 */
function chainUserAccessRoutes(honoApp: Hono, app: App): void {
  honoApp
    .post('/api/tables/user_access/records', (c) => handleCreateUserAccessRecord(c, app))
    .get('/api/tables/user_access/records', (c) => handleListUserAccessRecords(c, app))
    .get('/api/tables/user_access/records/:grantId', (c) => handleGetUserAccessRecord(c, app))
    .patch('/api/tables/user_access/records/:grantId', (c) => handleUpdateUserAccessRecord(c, app))
    .delete('/api/tables/user_access/records/:grantId', (c) => handleDeleteUserAccessRecord(c, app))
}

/**
 * The middleware every `:tableId` route runs behind, in order:
 * `validateTable` (404 if not found) → `enrichUserRole` with auth, or
 * `provideGuestContext` without it; then the record-id, read, body and
 * language gates. `requireAuth()` itself is applied in `api-auth-guards.ts`.
 *
 * Hono needs BOTH patterns — `/api/tables/:tableId` for the exact match and
 * `/api/tables/:tableId/*` for nested routes — or the middleware skips one.
 */
function guardTableRoutes(honoApp: Hono, app: App): void {
  const attachRole = () => (app.auth ? enrichUserRole(app) : provideGuestContext())
  honoApp
    .use('/api/tables/:tableId', validateTable(app))
    .use('/api/tables/:tableId', attachRole())
    .use('/api/tables/:tableId/*', validateTable(app))
    .use('/api/tables/:tableId/*', attachRole())
    // An id no key of the table could hold names no record: 404 before any query.
    .use('/api/tables/:tableId/records/:recordId', rejectNonKeyRecordId(app))
    .use('/api/tables/:tableId/records/:recordId/*', rejectNonKeyRecordId(app))
    // A table the caller may not read answers as one that does not exist,
    // before any route or request validator looks at the request.
    .use('/api/tables/:tableId/*', gateUnreadableTable(app))
    // A body that is not labelled JSON is refused 415 before any handler reads
    // it — the CORS-simple shape a cross-site page can forge. Form routes opt
    // in with `acceptsFormBody`. After the read gate, so an unreadable table
    // still answers as one that does not exist.
    .use('/api/tables/:tableId/*', refuseNonJsonBody())
    // Each translatable value is filed under its language before a write route
    // reads it, and read back in the active language (`record-write-language.ts`).
    .use('/api/tables/:tableId/records', writesRecordLanguage(app))
    .use('/api/tables/:tableId/records/*', writesRecordLanguage(app))
}

/**
 * Register the table routes on a Hono app, in the order that is the contract:
 * the routes that must bypass the table middleware first, then the middleware
 * (`guardTableRoutes`), then every route behind it.
 *
 * **Context Variables Available After the middleware** (via `ContextWithTableAndRole`):
 * - `session`: Session (authenticated user or guest)
 * - `tableName`: string (resolved table name)
 * - `tableId`: string (original parameter)
 * - `userRole`: string (user's role in organization or 'guest')
 *
 * The record, table and view slugs keep their own method chains: the islands'
 * typed RPC client reads its types off them (`api/client.ts`).
 *
 * @param honoApp - Hono instance to register the routes on
 * @param app - Application configuration containing table metadata
 */
export function chainTableRoutes(honoApp: Hono, app: App): void {
  // Z-2: the `user_access` junction routes go BEFORE `validateTable` (see
  // `chainUserAccessRoutes`).
  chainUserAccessRoutes(honoApp, app)

  // The design-system catalogue's fixture, under a RESERVED table name, and
  // registered here for exactly the reason above: it is a platform constant
  // rather than a row in `app.tables[]`, so `validateTable` would 404 it.
  //
  // Registered as a GET and nothing else, which is what makes it read-only. A
  // write to this name falls through to the record routes below and gets the
  // ordinary undeclared-table 404 — no refusal branch to keep in sync, and
  // nothing an operator can edit into the catalogue every instance documents.
  // See `specimen-handlers.ts` for why the sibling `?rows=` endpoint is not
  // made redundant by this binding.
  honoApp.get(`/api/tables/${SPECIMEN_TABLE_NAME}/records`, (c) =>
    handleListSpecimenTableRecords(c)
  )

  // A calendar app polls its feed address with no cookie: the token in the
  // path is its credential, checked by the route, so it is registered ahead
  // of the table middleware (see `calendar-feed-routes.ts`).
  chainCalendarFeedReadRoute(honoApp, app)

  guardTableRoutes(honoApp, app)

  // Route registration order matters for Hono's router: more specific routes
  // (batch/restore) are registered BEFORE parameterized ones (:recordId/restore).
  chainCalendarFeedTokenRoutes(honoApp, app)
  chainTableRoutesMethods(honoApp, app)
  chainBatchRoutesMethods(honoApp, app)
  chainRecordRoutesMethods(honoApp, app)
  chainViewRoutesMethods(honoApp, app)
}
