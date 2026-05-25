/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { createHandleGetEcoOverview } from './overview'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

export function chainAdminEcoRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp.get('/api/admin/eco/overview', createHandleGetEcoOverview(app)) as T
}
