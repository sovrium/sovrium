/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Mount the dev-only live-reload routes (handlers defined in the presentation
 * layer at `@/presentation/api/routes/dev-reload`).
 *
 * Gated on {@link isLiveReloadEligible} (NODE_ENV unset/empty — the genuine
 * local-dev default) so the routes are absent in production (they 404) AND in
 * the in-process E2E test server, which sets `NODE_ENV=development` only to skip
 * the production CSS check. Keeping the `runEffectSse` usage in the presentation
 * layer keeps this infrastructure module free of a presentation-util dependency.
 */

import { isLiveReloadEligible } from '@/infrastructure/utils/env'
import { chainDevReloadRoutes } from '@/presentation/api/routes/dev-reload'
import type { Hono } from 'hono'

/**
 * Mount the dev live-reload routes. No-op unless {@link isLiveReloadEligible}
 * (routes 404 otherwise), so the caller can mount unconditionally.
 *
 * @param honoApp - Hono application instance.
 * @returns The Hono app with dev-reload routes chained (or unchanged).
 */
export function setupDevReloadRoute(honoApp: Readonly<Hono>): Readonly<Hono> {
  if (!isLiveReloadEligible()) return honoApp
  return chainDevReloadRoutes(honoApp as Hono)
}
