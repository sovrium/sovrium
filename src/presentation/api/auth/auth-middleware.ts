/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The middleware Better Auth's routes sit behind: the session and admin-role
 * gates on `/api/auth/admin/*`, the per-path rate limits, and the CORS policy
 * `setupAuthMiddleware` registers ahead of every auth route.
 */
import { type Hono } from 'hono'
import { cors } from 'hono/cors'
import { admitsToAdminApi, type AdminDoorSession } from '@/domain/models/app/auth/passkeys-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { logError } from '@/infrastructure/logging/logger'
import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import { isLoopbackOrigin, isTransportRelaxed } from '@/infrastructure/process/security-posture'
import { getRequestRateLimitKey } from '@/presentation/api/middleware/client-ip'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import {
  isRateLimitExceeded,
  recordRateLimitRequest,
  isAuthRateLimitExceeded,
  recordAuthRateLimitRequest,
  getAuthRateLimitRetryAfter,
  getAuthRateLimitedPaths,
} from './auth-route-utils'
import type { App } from '@/domain/models/app'
// Type-only: the auth instance arrives as a parameter from `createHonoApp`,
// which loads the Better Auth package once, at boot, only when `app.auth` is set.
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'

/**
 * Public admin paths exempt from the auth-check middleware.
 *
 * Some endpoints under `/api/auth/admin/*` are deliberately public — they
 * are entry points the customer hits BEFORE having a session. The
 * canonical example is `/api/auth/admin/accept-invitation`: the recipient
 * of an admin invitation reaches it via an emailed link with no cookies,
 * and rejecting them with 401 would break the entire onboarding flow.
 *
 * Each entry is matched with a strict equality check against `c.req.path`
 * to avoid sub-path bypass.
 */
const PUBLIC_ADMIN_PATHS: ReadonlySet<string> = new Set(['/api/auth/admin/accept-invitation'])

/**
 * Admin paths exempt from the admin-role check (but still require a session).
 *
 * `/api/auth/admin/stop-impersonating` is the canonical example: while
 * impersonating, the active session is the *impersonated user's* session,
 * which by definition does not carry the admin role. The endpoint must
 * remain reachable so the operator can drop impersonation and reclaim
 * their admin context. Better Auth itself validates the impersonation
 * lineage internally; the role-only gate must not pre-empt that.
 *
 * `/api/auth/admin/invite-user` is exempt for the same class of reason: the
 * decision needs information this middleware does not have. A role holding the
 * `auth.roles[].canInvite` grant may invite at or below its own level, and the
 * INVITED level lives in the request body, which a path-matched middleware never
 * reads. Exempting the path does not remove a gate — it moves the whole decision
 * to `requireInviteCaller` (`admin-invitation-guard.ts`), whose first clause is
 * this middleware's own `isAdminEquivalent` predicate, so an app declaring no
 * grant is gated exactly as before, with the same 404.
 *
 * EXEMPT FROM THE ROLE CHECK ONLY. `applyAuthCheckMiddleware` still answers 401
 * to an anonymous caller and `applyRateLimitMiddleware` still applies, because
 * neither consults this set.
 */
const ADMIN_ROLE_CHECK_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  '/api/auth/admin/stop-impersonating',
  '/api/auth/admin/invite-user',
])

/**
 * Apply authentication check middleware for admin endpoints
 *
 * This middleware ensures authentication is checked BEFORE parameter validation,
 * preventing information leakage through error responses (400/404/403 vs 401).
 *
 * Without this middleware, Better Auth's admin endpoints validate parameters first,
 * allowing unauthenticated users to probe for valid user IDs by observing response codes.
 *
 * Returns a Hono app with authentication middleware applied
 */
export const applyAuthCheckMiddleware = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>
): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    if (PUBLIC_ADMIN_PATHS.has(c.req.path)) {
      await next()
      return
    }

    try {
      // Check if request has a valid session cookie
      const session = await authInstance.api.getSession({
        headers: c.req.raw.headers,
      })

      // Return 401 if no valid session (BEFORE any parameter validation)
      if (!session) {
        return c.json(
          { success: false, message: 'Authentication required', code: 'UNAUTHORIZED' },
          401
        )
      }

      // Session exists - proceed to next handler
      await next()
    } catch (error) {
      // If session check fails, return 401 (assume unauthenticated)
      logError('[Auth Middleware] Session check error', error)
      return c.json(
        { success: false, message: 'Authentication required', code: 'UNAUTHORIZED' },
        401
      )
    }
  })
}

/**
 * Apply admin-role check middleware for /api/auth/admin/* endpoints.
 *
 * Better Auth's admin plugin returns 403 (FORBIDDEN) when a non-admin caller
 * hits an admin endpoint. Per Sovrium's S1 anti-enumeration rule the response
 * must be 404 so the existence of the admin endpoint is not discoverable to
 * non-admin callers. This middleware short-circuits with the canonical 404
 * before Better Auth's handler runs.
 *
 * Runs AFTER `applyAuthCheckMiddleware` (which has already rejected anonymous
 * callers with 401), so by this point `session` is guaranteed present. The
 * `PUBLIC_ADMIN_PATHS` exclusion is reapplied — `/admin/accept-invitation` is
 * deliberately reachable by any authenticated caller (the invitee).
 *
 * The admit predicate is `isAdminEquivalent(role, app)` — the app's resolved
 * top role ∪ the built-in `admin`. It is deliberately NOT the strict literal
 * `role === 'admin'`: an app that names its top operator role anything else
 * (partner's `engineer`, level 80) produced an operator who saw the entire
 * `/_admin` console — which gates on the config-aware `isAdminTier` — and was
 * 404ed out of the entire admin plane. It is equally deliberately NOT
 * `isAdminTier`: this plane carries `set-role`, `ban-user`, `create-user` and
 * `impersonate-user`, so admitting `admin-viewer` / `operator` would hand write
 * power to roles whose whole point is read-only. `adminRoleNamesFor`
 * (`admin-role-guards.ts`) is the list form of this same predicate, so the door
 * and the last-admin count now agree.
 */
export const applyAdminRoleCheckMiddleware = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app: App
): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    if (PUBLIC_ADMIN_PATHS.has(c.req.path) || ADMIN_ROLE_CHECK_EXEMPT_PATHS.has(c.req.path)) {
      await next()
      return
    }

    try {
      const sessionResult = (await authInstance.api.getSession({
        headers: c.req.raw.headers,
      })) as AdminDoorSession | null

      // Better Auth stores the admin role on the user record. Any role that is
      // not admin-EQUIVALENT for this app (including undefined) is rejected
      // with 404 per S1, as is an admin's non-passkey session under requireForAdmin.
      if (!admitsToAdminApi(sessionResult, app, (role) => isAdminEquivalent(role, app))) {
        return notFound(c, 'Not Found')
      }

      await next()
    } catch (error) {
      logError('[Admin Role Middleware] Session check error', error)
      // Errors during role resolution collapse to 404 (S1) — the safer
      // posture is "endpoint does not exist for you" rather than leaking
      // the auth subsystem state.
      return notFound(c, 'Not Found')
    }
  })
}

/**
 * Apply rate limiting middleware for admin endpoints
 * Returns a Hono app with rate limiting middleware applied
 */
export const applyRateLimitMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    const ip = getRequestRateLimitKey(c)

    // The admin window is one second, so one second is the honest hint.
    if (isRateLimitExceeded(ip)) return rateLimitedResponse(c, 1)

    recordRateLimitRequest(ip)

    await next()
  })
}

/**
 * Apply rate limiting middleware for authentication endpoints
 *
 * Protects security-critical authentication endpoints from brute force attacks
 * and every route that sends mail from being used to bomb an address. The
 * budgets live in `getAuthRateLimitConfigs` (`auth-route-utils.ts`), and the
 * middleware is mounted on exactly that table's keys
 * (`getAuthRateLimitedPaths`): adding a row is the whole change, and no path
 * can be budgeted but unguarded.
 *
 * Returns a Hono app with rate limiting middleware applied
 */
export const applyAuthRateLimitMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  const result = getAuthRateLimitedPaths().reduce((app, endpoint) => {
    // Keyed by the table key, not `c.req.path`: a key may be a route pattern
    // (`/api/admin/invitations/:id/resend`) that no concrete path equals.
    return app.use(endpoint, async (c, next) => {
      const ip = getRequestRateLimitKey(c)

      if (isAuthRateLimitExceeded(endpoint, ip)) {
        const retryAfter = getAuthRateLimitRetryAfter(endpoint, ip)
        return rateLimitedResponse(c, retryAfter)
      }

      recordAuthRateLimitRequest(endpoint, ip)

      await next()
    })
  }, honoApp)

  return result
}

/**
 * Resolve the app's canonical origin (scheme + host + port) from `BASE_URL`,
 * mirroring `createAuthInstance` (auth.ts:580). Returns `undefined` when
 * `BASE_URL` is unset or unparseable so callers can fall back to the
 * loopback-reflection path.
 */
const resolveCanonicalOrigin = (): string | undefined => {
  const baseUrl = process.env['BASE_URL']
  if (baseUrl === undefined || baseUrl === '') return undefined
  try {
    return new URL(baseUrl).origin
  } catch {
    return undefined
  }
}

/**
 * Setup CORS middleware for Better Auth endpoints (Finding #6 remediation).
 *
 * The previous implementation reflected ANY `Origin` back in
 * `Access-Control-Allow-Origin` (the `return origin` fallthrough) which, with
 * `credentials: true`, let any site read authenticated `/api/auth/*` responses.
 * This now ALLOWLISTS origins:
 *   • the app's own canonical origin (derived from `BASE_URL`) is allowed;
 *   • loopback origins are reflected only when the transport posture is RELAXED
 *     (loopback bind / master opt-out), preserving local cross-port DX;
 *   • any other (foreign) origin gets NO `Access-Control-Allow-Origin` echo —
 *     the Hono `origin` callback returns `null` so the header is omitted.
 *
 * If no auth configuration is provided in the app, middleware is not applied.
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration with auth settings
 * @returns Hono app with CORS middleware configured (or unchanged if auth is disabled)
 */
export function setupAuthMiddleware(honoApp: Readonly<Hono>, app?: App): Readonly<Hono> {
  // If no auth config is provided, don't apply CORS middleware
  if (!app?.auth) {
    return honoApp
  }

  return honoApp.use(
    '/api/auth/*',
    cors({
      // Hono invokes this per request with the inbound Origin. Returning the
      // origin echoes it into ACAO; returning the empty string denies (the
      // request origin is NOT echoed back, so a foreign site cannot read the
      // credentialed response).
      origin: (origin) => {
        const canonical = resolveCanonicalOrigin()
        // 1. The app's own declared origin is always allowed.
        if (canonical !== undefined && origin === canonical) return origin
        // 2. Localhost is reflected ONLY on a relaxed transport posture
        //    (loopback bind or master opt-out) — local cross-port dev DX.
        if (isTransportRelaxed() && isLoopbackOrigin(origin)) return origin
        // 3. Any other origin is foreign — deny (do not echo the origin).
        return ''
      },
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['POST', 'GET', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true, // Required for cookie-based authentication
    })
  )
}
