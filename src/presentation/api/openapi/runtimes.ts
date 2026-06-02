/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createRoute, type RouteConfig } from '@hono/zod-openapi'

export type SovriumRuntime = 'postgres' | 'sqlite'

export interface AdminRouteConfig<P extends string = string> extends RouteConfig {
  readonly path: P
  readonly runtimes?: ReadonlyArray<SovriumRuntime>
}

export const OPENAPI_RUNTIMES_EXTENSION = 'x-sovrium-runtimes' as const

export function adminRoute<P extends string>(config: AdminRouteConfig<P>) {
  const { runtimes, ...rest } = config
  if (!runtimes || runtimes.length === 0) {
    return createRoute(rest)
  }
  return createRoute({
    ...rest,
    [OPENAPI_RUNTIMES_EXTENSION]: [...runtimes],
  } as RouteConfig)
}
