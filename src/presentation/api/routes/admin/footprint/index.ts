/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Chain admin/footprint routes onto a Hono app.
 *
 * Auth gating (admin + operator tier via `requireAdminTier()`) is wired
 * upstream in `api-routes.ts` (authMiddleware → requireAdminTier on
 * `/api/admin/footprint/overview`).
 */

import { createHandleGetFootprintOverview } from './overview'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

export function chainAdminFootprintRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp.get('/api/admin/footprint/overview', createHandleGetFootprintOverview(app)) as T
}
