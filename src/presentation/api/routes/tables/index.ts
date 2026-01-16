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
 * Applies middleware chain for routes with :tableId parameter:
 * 1. validateTable() - Validates table exists, attaches tableName to context
 * 2. enrichUserRole() - Fetches user role, attaches userRole to context
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
