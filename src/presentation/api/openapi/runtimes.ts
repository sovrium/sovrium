/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createRoute, type RouteConfig } from '@hono/zod-openapi'
import type { Context, MiddlewareHandler, Next } from 'hono'

/**
 * Database runtime constraint for an admin endpoint.
 *
 * Sovrium runs in two database modes:
 *
 * - `postgres` — full-feature mode (Drizzle on `bun:sql`), supports
 *   partitioning, `pg_stat_statements`, JSONL streaming archives, etc.
 * - `sqlite`  — All-in-One (AIO) Docker mode for self-hosted single-binary
 *   deployments (per memory `project_aio_docker_architecture`).
 *
 * Some admin endpoints (database/slow-queries, embedding rebuild via pgvector,
 * audit-log archival to bucket) genuinely require Postgres. Per plan §12 Q6:
 * the same OpenAPI surface is exposed in both modes, but Postgres-only
 * endpoints respond **501 Not Implemented** with `{ error: 'requires-postgres' }`
 * when called on SQLite. The OpenAPI document carries the
 * `x-sovrium-runtimes` extension so machine consumers can filter the surface
 * before generating client SDKs for AIO mode.
 *
 * @see plan §12 Q6 (locked: 501 + extension)
 */
export type SovriumRuntime = 'postgres' | 'sqlite'

/**
 * Detect the active database runtime from environment.
 *
 * Postgres is the default when `DATABASE_URL` is unset (development server in
 * a worktree typically connects via `postgres://`). SQLite is selected only
 * when `DATABASE_URL` explicitly starts with `sqlite:` or the path-style
 * `file:` prefix used by AIO Docker.
 *
 * Detection is intentionally conservative: any non-sqlite URL (postgres,
 * postgresql, plain hostname, missing scheme) is treated as `postgres`. This
 * mirrors how `bun:sql` resolves connection strings and avoids accidentally
 * gating an endpoint as "Postgres only" on a stock dev environment.
 */
export function getCurrentRuntime(): SovriumRuntime {
  const url = process.env.DATABASE_URL ?? ''
  if (url.startsWith('sqlite:') || url.startsWith('file:')) {
    return 'sqlite'
  }
  return 'postgres'
}

/**
 * Configuration accepted by `adminRoute` on top of the standard
 * `createRoute` parameters from `@hono/zod-openapi`.
 */
export interface AdminRouteConfig<P extends string = string> extends RouteConfig {
  readonly path: P
  readonly runtimes?: ReadonlyArray<SovriumRuntime>
}

/**
 * The OpenAPI extension key for runtime constraints.
 *
 * Exported as a constant so consumers (CLI exporter, doc generators) can
 * detect the field without hard-coding the string. The `x-` prefix follows
 * OpenAPI 3.1 vendor extension conventions.
 * @public
 */
export const OPENAPI_RUNTIMES_EXTENSION = 'x-sovrium-runtimes' as const

/**
 * Build an OpenAPI route definition with the optional `x-sovrium-runtimes`
 * extension attached.
 *
 * The extension is a plain array of runtime literals (`['postgres']`,
 * `['sqlite']`, or `['postgres', 'sqlite']`). It is **purely descriptive**
 * for OpenAPI consumers — it does NOT gate the runtime route at HTTP time.
 * Runtime gating is handled separately by `requireRuntime(...)` middleware
 * mounted on the actual route handler.
 *
 * **Why two pieces?** OpenAPIHono and the runtime Hono app are separate in
 * Sovrium (see `infrastructure/server/route-setup/openapi-schema.ts`). A
 * single helper that handles both would force callers to import OpenAPI
 * dependencies into the runtime route file, breaking the layering.
 *
 * @example
 * ```typescript
 * import { adminRoute } from '@/presentation/api/openapi/runtimes'
 *
 * const slowQueriesRoute = adminRoute({
 *   method: 'get',
 *   path: '/api/admin/database/slow-queries',
 *   runtimes: ['postgres'],
 *   summary: 'Slow query report (Postgres only)',
 *   tags: ['admin', 'database'],
 *   responses: {
 *     200: { content: {...} },
 *     501: { content: {...}, description: 'Requires Postgres runtime' },
 *   },
 * })
 * ```
 * @public
 */
export function adminRoute<P extends string>(config: AdminRouteConfig<P>) {
  const { runtimes, ...rest } = config
  if (!runtimes || runtimes.length === 0) {
    return createRoute(rest)
  }
  // OpenAPI 3.1 vendor extensions: any property prefixed with `x-` is allowed
  // on any operation object. `createRoute` passes unknown keys through.
  return createRoute({
    ...rest,
    [OPENAPI_RUNTIMES_EXTENSION]: [...runtimes],
  } as RouteConfig)
}

/**
 * Hono middleware that returns 501 Not Implemented when the active runtime
 * is not in the `allowed` list.
 *
 * Mount this on the runtime Hono route (NOT the OpenAPI route) so that
 * admins/operators calling a Postgres-only endpoint on AIO get a clear,
 * machine-readable failure that does not leak the existence of the route
 * (per plan §6.4 anti-enumeration: 501 is acceptable here because the route
 * IS exposed in the OpenAPI document — the operator already knows it exists).
 *
 * The error envelope matches the rest of `/api/admin/*` (`success: false`
 * + machine code `SERVICE_UNAVAILABLE` paired with `error: 'requires-postgres'`)
 * so dashboards can branch on the runtime gate without parsing English.
 *
 * @example
 * ```typescript
 * import { requireRuntime } from '@/presentation/api/openapi/runtimes'
 *
 * app.get(
 *   '/api/admin/database/slow-queries',
 *   requireAdminRole(['admin', 'operator', 'auditor']),
 *   requireRuntime(['postgres']),
 *   handleSlowQueries
 * )
 * ```
 */
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
    // eslint-disable-next-line functional/no-expression-statements -- Required for middleware to continue to next handler
    await next()
    return undefined
  }
}
