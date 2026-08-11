/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Real-time presence-awareness route chain (Wave-6).
 *
 * Registers `GET /api/realtime/presence` — the page-path-scoped presence
 * SSE endpoint. Always registered; the handler returns 401 when no session
 * is attached, so apps without auth behave identically.
 */

import { handlePresence } from './presence-handlers'
import type { App } from '@/domain/models/app'
import type { Hono } from 'hono'

/**
 * Chain the realtime presence route onto a Hono app.
 *
 * The `/api/realtime/presence` path receives `authMiddleware` in
 * `api-routes.ts` (when `app.auth` is configured) so the handler can read the
 * session via `getSessionContext`. The `app` is threaded through so the
 * handler can namespace the in-memory presence channel by `app.name` and
 * keep two distinct apps' presence sets isolated.
 */
export function chainRealtimeRoutes<T extends Hono>(honoApp: T, app: App) {
  return honoApp.get('/api/realtime/presence', (c) => handlePresence(c, app))
}
