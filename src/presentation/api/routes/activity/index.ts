/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getActivityByIdHandler } from './get-activity-by-id-handler'
import type { Hono } from 'hono'

export function chainActivityRoutes<T extends Hono<any, any, any>>(honoApp: T) {
  return honoApp.get('/api/activity/:activityId', getActivityByIdHandler)
}
