/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { validateTable, enrichUserRole } from '@/presentation/api/middleware/table'
import { chainBatchRoutesMethods } from './batch-routes'
import { chainRecordRoutesMethods } from './record-routes'
import { chainTableRoutesMethods } from './table-routes'
import { chainViewRoutesMethods } from './view-routes'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * Chain table routes onto a Hono app
 *
 * **Middleware Chain** (applied before all :tableId routes):
 * ```
 * requireAuth() → validateTable() → enrichUserRole() → Handler
 * ```
 * - `requireAuth`: Ensures session exists (applied in api-routes.ts)
 * - `validateTable`: Validates table exists, attaches tableName + tableId
 * - `enrichUserRole`: Fetches user role from DB, attaches userRole
 *
 * **IMPORTANT**: Hono requires middleware registration for BOTH patterns:
 * 1. `/api/tables/:tableId` - Exact match (e.g., GET /api/tables/123)
 * 2. `/api/tables/:tableId/*` - Nested routes (e.g., GET /api/tables/123/records)
 *
 * Without both patterns, middleware won't run for all routes.
 *
 * **Context Variables Available After Chain** (via `ContextWithTableAndRole`):
 * - `session`: Session (non-optional, guaranteed by requireAuth)
 * - `tableName`: string (resolved table name)
 * - `tableId`: string (original parameter)
 * - `userRole`: string (user's role in organization)
 *
 * Uses method chaining for proper Hono RPC type inference.
 *
 * @param honoApp - Hono instance to chain routes onto
 * @param app - Application configuration containing table metadata
 * @returns Hono app with table routes chained
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono type inference with middleware requires flexible typing
export function chainTableRoutes<T extends Hono<any, any, any>>(honoApp: T, app: App) {
  // Apply middleware for routes with :tableId parameter
  // Middleware order: validateTable (404 if not found) → enrichUserRole (fetch role)
  // Note: requireAuth() is already applied in api-routes.ts, so session is guaranteed
  //
  // Two patterns needed:
  // - '/api/tables/:tableId' for exact match (e.g., GET /api/tables/:tableId)
  // - '/api/tables/:tableId/*' for nested routes (e.g., GET /api/tables/:tableId/records)
  const honoWithMiddleware = honoApp
    .use('/api/tables/:tableId', validateTable(app))
    .use('/api/tables/:tableId', enrichUserRole())
    .use('/api/tables/:tableId/*', validateTable(app))
    .use('/api/tables/:tableId/*', enrichUserRole())

  // Route registration order matters for Hono's router.
  // More specific routes (batch/restore) must be registered BEFORE
  // parameterized routes (:recordId/restore) to avoid route collisions.
  return chainViewRoutesMethods(
    chainRecordRoutesMethods(
      chainBatchRoutesMethods(chainTableRoutesMethods(honoWithMiddleware, app), app),
      app
    )
  )
}
