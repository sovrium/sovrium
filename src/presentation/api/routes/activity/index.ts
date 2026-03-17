/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getActivityByIdHandler } from './get-activity-by-id-handler'
import type { Hono } from 'hono'

/**
 * Chain activity routes onto a Hono app
 *
 * **Authentication Middleware** (applied in api-routes.ts):
 * - All activity endpoints require authentication
 * - Middleware chain: requireAuth() → Handler
 * - Authentication is ALWAYS required, even when app.auth is not configured
 *
 * **Routes**:
 * - GET /api/activity/:activityId - Get activity log details
 *
 * @param honoApp - Hono instance to chain routes onto
 * @returns Hono app with activity routes chained
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono type inference with middleware requires flexible typing
export function chainActivityRoutes<T extends Hono<any, any, any>>(honoApp: T) {
  return honoApp.get('/api/activity/:activityId', getActivityByIdHandler)
}
