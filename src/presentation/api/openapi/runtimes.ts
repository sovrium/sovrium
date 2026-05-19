/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createRoute, type RouteConfig } from '@hono/zod-openapi'
import type { Context, MiddlewareHandler, Next } from 'hono'

export type SovriumRuntime = 'postgres' | 'sqlite'

export function getCurrentRuntime(): SovriumRuntime {
  const url = process.env.DATABASE_URL ?? ''
  if (url.startsWith('sqlite:') || url.startsWith('file:')) {
    return 'sqlite'
  }
  return 'postgres'
}

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

export function requireRuntime(allowed: ReadonlyArray<SovriumRuntime>): MiddlewareHandler {
  const set = new Set<SovriumRuntime>(allowed)
  return async (c: Context, next: Next) => {
    const current = getCurrentRuntime()
    if (!set.has(current)) {
      return c.json(
        {
          success: false,
          error: 'requires-postgres',
          code: 'SERVICE_UNAVAILABLE',
          message: `This endpoint requires the Postgres runtime; current runtime is "${current}".`,
        },
        501
      )
    }
    await next()
    return undefined
  }
}
