/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The admin gate of the portable design-system bundle ([internal ref] A11), in BOTH
 * mirrors — kept beside `admin-route-guards.ts`, which registers it first in
 * each of its two chains, so that file stays under its line ceiling.
 *
 * Every path is an EXACT path, except `/bundle/*`, whose partner it is: Hono
 * needs at least one segment to match `/*`, so the bare manifest read needs its
 * own entry while `/bundle/file` needs the wildcard. Same pairing as
 * `/api/admin/design-system/shares`. The `design-system.*` exports are exact
 * paths with no wildcard, so nothing here is inherited from them.
 *
 * The gate is the one every design-system read wears: `requireAdminTier`
 * answers 404 to an anonymous caller and to a member alike, because a 401 or a
 * 403 would confirm that this instance publishes its design system to whoever
 * gets a session.
 */

import { authMiddleware, requireAdminTier } from '@/presentation/api/middleware/auth'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { SessionHono } from '@/presentation/api/middleware/admin-route-guards'

/** Every path the bundle answers on, as the guards register them. */
export const DESIGN_SYSTEM_BUNDLE_GUARDED_PATHS = [
  '/api/admin/design-system.zip',
  '/api/admin/design-system.css',
  '/api/admin/design-system/bundle',
  '/api/admin/design-system/bundle/*',
] as const

/** The auth-enabled mirror: attach the session, then the tier check, per path. */
export const guardDesignSystemBundle = (
  honoApp: SessionHono,
  auth: Readonly<ReturnType<typeof createAuthInstance>>,
  resolveAppForTier: () => App
): SessionHono =>
  DESIGN_SYSTEM_BUNDLE_GUARDED_PATHS.reduce(
    (chained, path) =>
      chained.use(path, authMiddleware(auth)).use(path, requireAdminTier(resolveAppForTier)),
    honoApp
  )

/** The no-auth mirror: there is no session to attach, so the tier check alone. */
export const guardDesignSystemBundleWithoutAuth = (
  honoApp: SessionHono,
  resolveAppForTier: () => App
): SessionHono =>
  DESIGN_SYSTEM_BUNDLE_GUARDED_PATHS.reduce(
    (chained, path) => chained.use(path, requireAdminTier(resolveAppForTier)),
    honoApp
  )
