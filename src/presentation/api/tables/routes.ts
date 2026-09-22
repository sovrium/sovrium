/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SPECIMEN_TABLE_NAME } from '@/domain/models/app/design/specimen-fixture'
import { validateTable, enrichUserRole } from '@/presentation/api/middleware/table'
import { chainUserTablePreferenceRoutes } from '@/presentation/api/tables/user-table-preference-routes'
import { chainUserViewRoutes } from '@/presentation/api/tables/user-view-routes'
import { chainBatchRoutesMethods } from './batch-routes'
import { chainRecordRoutesMethods } from './record-routes'
import { handleListSpecimenTableRecords } from './specimen-handlers'
import { chainTableRoutesMethods } from './table-routes'
import { handleCreateUserAccessRecord, handleListUserAccessRecords } from './user-access-handlers'
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
 * Chain table routes onto a Hono app
 *
 * **Middleware Chain** (applied before all :tableId routes):
 * ```
 * requireAuth() → validateTable() → enrichUserRole() → Handler (if auth configured)
 * validateTable() → provideGuestContext() → Handler (if no auth)
 * ```
 * - `requireAuth`: Ensures session exists (applied in api-routes.ts if auth configured)
 * - `validateTable`: Validates table exists, attaches tableName + tableId
 * - `enrichUserRole`: Fetches user role from DB, attaches userRole (if auth configured)
 * - `provideGuestContext`: Provides guest session and role (if no auth)
 *
 * **IMPORTANT**: Hono requires middleware registration for BOTH patterns:
 * 1. `/api/tables/:tableId` - Exact match (e.g., GET /api/tables/123)
 * 2. `/api/tables/:tableId/*` - Nested routes (e.g., GET /api/tables/123/records)
 *
 * Without both patterns, middleware won't run for all routes.
 *
 * **Context Variables Available After Chain** (via `ContextWithTableAndRole`):
 * - `session`: Session (authenticated user or guest)
 * - `tableName`: string (resolved table name)
 * - `tableId`: string (original parameter)
 * - `userRole`: string (user's role in organization or 'guest')
 *
 * Uses method chaining for proper Hono RPC type inference.
 *
 * @param honoApp - Hono instance to chain routes onto
 * @param app - Application configuration containing table metadata
 * @returns Hono app with table routes chained
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono type inference with middleware requires flexible typing
export function chainTableRoutes<T extends Hono<any, any, any>>(
  honoApp: T,
  app: App,
  // [internal ref]: optional live-App resolver. After a schema `POST /draft/publish`
  // swaps the live App without a restart, a newly-added table must be
  // resolvable by `validateTable` and queryable by the record handlers. The
  // composition root (`api-routes.ts`) supplies a resolver that reads the live
  // App store; absent a resolver (or before any publish) it falls back to the
  // boot `app`, so existing behavior is unchanged.
  resolveApp: () => App = () => app
) {
  // Z-2: Register the multi-tenant `user_access` junction routes BEFORE
  // applying `validateTable` middleware. user_access is an engine-managed
  // junction (DDL created at startup when `auth.scopeTables` is set), not a
  // user-defined table in `app.tables[]`, so the table-name lookup in
  // `validateTable` would otherwise return 404 for these endpoints.
  //
  // Middleware applied via `.use()` only affects routes registered AFTER the
  // `.use()` call. Registering user_access routes first means they bypass
  // validateTable / enrichUserRole / guest context — which is correct: this
  // junction has its own per-row validation (auth.scopeTables / auth.roles).
  // Auth middleware applied higher up in `api-routes.ts` still runs.
  const honoWithUserAccess = honoApp
    .post('/api/tables/user_access/records', (c) => handleCreateUserAccessRecord(c, resolveApp()))
    .get('/api/tables/user_access/records', (c) => handleListUserAccessRecords(c, resolveApp()))

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
  const honoWithSpecimenTable = honoWithUserAccess.get(
    `/api/tables/${SPECIMEN_TABLE_NAME}/records`,
    (c) => handleListSpecimenTableRecords(c)
  )

  // Apply middleware for routes with :tableId parameter
  // Middleware order: validateTable (404 if not found) → enrichUserRole (fetch role if auth configured)
  // Note: requireAuth() is conditionally applied in api-routes.ts based on app.auth
  //
  // Two patterns needed:
  // - '/api/tables/:tableId' for exact match (e.g., GET /api/tables/:tableId)
  // - '/api/tables/:tableId/*' for nested routes (e.g., GET /api/tables/:tableId/records)
  //
  // enrichUserRole is only applied when auth is configured (app.auth exists)
  // For apps without auth, provideGuestContext creates a guest session and role
  const honoWithMiddleware = app.auth
    ? honoWithSpecimenTable
        .use('/api/tables/:tableId', validateTable(resolveApp))
        .use('/api/tables/:tableId', enrichUserRole())
        .use('/api/tables/:tableId/*', validateTable(resolveApp))
        .use('/api/tables/:tableId/*', enrichUserRole())
    : honoWithSpecimenTable
        .use('/api/tables/:tableId', validateTable(resolveApp))
        .use('/api/tables/:tableId', provideGuestContext())
        .use('/api/tables/:tableId/*', validateTable(resolveApp))
        .use('/api/tables/:tableId/*', provideGuestContext())

  // Route registration order matters for Hono's router.
  // More specific routes (batch/restore) must be registered BEFORE
  // parameterized routes (:recordId/restore) to avoid route collisions.
  //
  // PG-03 / [internal ref]: register `/user-views[*]` and `/user-preferences` BEFORE
  // record routes so the more-specific paths win over `:recordId` style
  // route patterns. These routes inherit the `:tableId/*` middleware chain
  // (validateTable + enrichUserRole / guest), so the caller must be
  // authenticated and the table must exist.
  const honoWithRuntimeViews = chainUserTablePreferenceRoutes(
    chainUserViewRoutes(honoWithMiddleware)
  )
  return chainViewRoutesMethods(
    chainRecordRoutesMethods(
      chainBatchRoutesMethods(
        chainTableRoutesMethods(honoWithRuntimeViews, resolveApp),
        resolveApp
      ),
      resolveApp
    ),
    resolveApp
  )
}
