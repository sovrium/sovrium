/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Registration of the embedded operator console at the path it is mounted at.
 *
 * Split out of `infrastructure/server/route-setup/admin-mount-setup.ts` in W5c,
 * along the line that file's own siblings already ran along: RESOLVING where
 * the console sits reads an embedded build artifact and is infrastructure,
 * while SERVING it is a route. `mounted-app-routes.ts` — the handlers this
 * chains — moved here in W5b for exactly that reason, and the setup was left
 * behind holding an `infrastructure → presentation` import that
 * `W5C_DEFERRED_SIBLING_READERS` has been carrying since.
 *
 * Nothing here decides WHETHER the console is served. The mount list arrives on
 * {@link HonoAppConfig.adminMounts}, resolved once at boot by the composition
 * root; an app with the console switched off supplies an empty list and this
 * function registers nothing. That is what lets the file live in presentation
 * without reaching for the preset, the `SOVRIUM_ADMIN` kill switch, or the
 * memo that ties the three together.
 */

import {
  resolveScopedMountApp,
  synthesiseMountSurface,
} from '@/application/use-cases/mount/embedded-app-mount'
import { setupMountedAppRoutes } from './mounted-app-routes'
import type { HonoAppConfig } from '@/application/ports/contracts/hono-app-config'
import type { Hono } from 'hono'

/**
 * Register the console at the path it is mounted at, if it is served.
 *
 * @param honoApp - the Hono instance to chain the mounts onto.
 * @param config - the page/render config, carrying the resolved mount list.
 */
export function setupAdminMountRoutes(
  honoApp: Readonly<Hono>,
  config: HonoAppConfig
): Readonly<Hono> {
  return setupMountedAppRoutes(honoApp, config, {
    mounts: config.adminMounts ?? [],
    resolveScopedMountApp,
    synthesiseMountSurface,
  })
}
