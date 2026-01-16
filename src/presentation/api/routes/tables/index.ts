/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { chainBatchRoutesMethods } from './batch-routes'
import { chainRecordRoutesMethods } from './record-routes'
import { chainTableRoutesMethods } from './table-routes'
import { chainViewRoutesMethods } from './view-routes'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * Chain table routes onto a Hono app
 *
 * Uses method chaining for proper Hono RPC type inference.
 *
 * @param honoApp - Hono instance to chain routes onto
 * @param app - Application configuration containing table metadata
 * @returns Hono app with table routes chained
 */
export function chainTableRoutes<T extends Hono>(honoApp: T, app: App) {
  // Route registration order matters for Hono's router.
  // More specific routes (batch/restore) must be registered BEFORE
  // parameterized routes (:recordId/restore) to avoid route collisions.
  return chainViewRoutesMethods(
    chainRecordRoutesMethods(
      chainBatchRoutesMethods(chainTableRoutesMethods(honoApp, app), app),
      app
    )
  )
}
