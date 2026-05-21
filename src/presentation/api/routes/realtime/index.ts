/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { handlePresence } from './presence-handlers'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

export function chainRealtimeRoutes<T extends Hono>(honoApp: T, app: App) {
  return honoApp.get('/api/realtime/presence', (c) => handlePresence(c, app))
}
