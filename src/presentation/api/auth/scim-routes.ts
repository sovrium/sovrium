/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildEnvLookup, resolveSecretInString } from '@/domain/models/app/env-reference-service'
import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import { createSlidingWindowLimiter } from '@/infrastructure/process/sliding-window-limiter'
import { getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { constantTimeEqual } from '@/presentation/api/runtime/constant-time-equal'
import { getRateLimitWindowMs } from './auth-route-utils'
import { chainScimDiscoveryRoutes } from './scim-discovery'
import { chainScimGroupRoutes } from './scim-groups'
import { SCIM_BASE_PATH } from './scim-resources'
import { chainScimUserRoutes } from './scim-users'
import type { ScimAuthContext } from './scim-store'
import type { App } from '@/domain/models/app'
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { Context, Hono, Next } from 'hono'

/**
 * SCIM 2.0 provisioning under `/api/scim/v2/*`, mounted only when the app
 * declares `auth.scim`.
 *
 * Two gates stand in front of every resource, in this order:
 *
 * 1. A per-address ceiling of {@link SCIM_MAX_REQUESTS} per rate-limit window,
 *    counted BEFORE authentication, so guessing tokens spends the same budget
 *    as using one.
 * 2. The bearer token, compared in constant time. A missing or wrong token
 *    gets the app's ordinary 404 — the very response of a path that does not
 *    exist, without an authentication challenge — so a scanner cannot tell
 *    whether SCIM is enabled.
 *
 * The plugin path Better Auth would mount (`/api/auth/scim/*`) is never
 * mounted: SCIM is Sovrium's own, and only here.
 */

/** Requests one address may send per rate-limit window, wrong tokens included. */
export const SCIM_MAX_REQUESTS = 60

const limiter = createSlidingWindowLimiter()

const throttle = async (c: Context, next: Next): Promise<Response | void> => {
  const decision = limiter.consume(getRequestRateLimitKey(c), {
    windowMs: getRateLimitWindowMs(),
    maxRequests: SCIM_MAX_REQUESTS,
  })
  if (decision.limited) return rateLimitedResponse(c, decision.retryAfter)
  await next()
}

const BEARER = /^Bearer\s+(\S+)\s*$/i

/** The gate on the bearer token; an empty expected token admits nobody. */
const requireToken =
  (expected: string) =>
  async (c: Context, next: Next): Promise<Response | void> => {
    const presented = BEARER.exec(c.req.header('authorization') ?? '')?.[1] ?? ''
    if (expected === '' || !constantTimeEqual(presented, expected)) return c.notFound()
    await next()
  }

/** Mount the SCIM endpoints when the app declares `auth.scim`; otherwise leave them absent. */
export const chainScimRoutes = (hono: Hono, app: App, authInstance?: unknown): Hono => {
  const scim = app.auth?.scim
  if (scim === undefined || authInstance === undefined) return hono
  const token = resolveSecretInString(scim.token, buildEnvLookup(app.env, process.env))
  const auth = authInstance as Readonly<ReturnType<typeof createAuthInstance>>
  const context = (): Promise<ScimAuthContext> => auth.$context
  hono.use(`${SCIM_BASE_PATH}/*`, throttle, requireToken(token))
  chainScimDiscoveryRoutes(hono)
  chainScimUserRoutes(hono, app, context)
  chainScimGroupRoutes(hono, app, context)
  return hono
}
