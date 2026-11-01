/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Cross-origin access to the data API for the origins `SOVRIUM_CORS_ORIGINS`
 * lists: the records routes (`/api/tables*`) and the files routes
 * (`/api/buckets/*`). Nothing else under `/api/*` answers another origin.
 *
 * Mounted AHEAD of every session lookup, so a preflight is answered `204`
 * before `authMiddleware` could refuse it `401`. An origin the list does not
 * name gets no CORS header here: the browser enforces the denial on a read,
 * and `cross-site-request-guard.ts` refuses a write. With the variable unset,
 * nothing is mounted at all.
 */

import { cors } from 'hono/cors'
import { resolveCorsOrigins } from '@/infrastructure/process/security-posture'
import type { Hono, MiddlewareHandler } from 'hono'

/** The data API families a listed origin may call. */
const DATA_API_PATHS = ['/api/tables', '/api/tables/*', '/api/buckets/*'] as const

/**
 * Hono's `cors` answers a listed origin. It is only ever called for a listed
 * origin: run for any other, it would still send `Allow-Credentials`.
 */
const listedOriginCors = (origins: readonly string[]): MiddlewareHandler => {
  const answer = cors({
    origin: (origin) => (origins.includes(origin) ? origin : ''),
    allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    // A record write's wait choice, and the delivery ids it answers with.
    allowHeaders: ['Content-Type', 'X-Api-Key', 'X-Sovrium-Await-Deliveries'],
    exposeHeaders: ['X-Sovrium-Delivery-Ids'],
    maxAge: 600,
    credentials: true,
  })
  return async (c, next) => {
    const origin = c.req.header('origin')
    if (origin !== undefined && origins.includes(origin)) return answer(c, next)
    await next()
    c.header('Vary', 'Origin', { append: true })
    return undefined
  }
}

/**
 * Mount the listed-origin answer on every data API family. A no-op when the
 * operator lists no origin. A cookie-bearing write from an origin the list
 * does not name is refused ahead of this, on every route, by
 * `cross-site-request-guard.ts`.
 */
export const applyDataApiCors = <T extends Hono>(honoApp: T): T => {
  const origins = resolveCorsOrigins()
  if (origins.length === 0) return honoApp
  const answer = listedOriginCors(origins)
  return DATA_API_PATHS.reduce<T>((app, path) => app.use(path, answer) as T, honoApp)
}
