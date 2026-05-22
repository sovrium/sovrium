/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { isLiveReloadEligible } from '@/infrastructure/utils/env'
import { chainDevReloadRoutes } from '@/presentation/api/routes/dev-reload'
import type { Hono } from 'hono'

export function setupDevReloadRoute(honoApp: Readonly<Hono>): Readonly<Hono> {
  if (!isLiveReloadEligible()) return honoApp
  return chainDevReloadRoutes(honoApp as Hono)
}
