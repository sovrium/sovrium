/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { type Context, type Hono } from 'hono'
import { cors } from 'hono/cors'
import { OAuthServerRepository } from '@/application/ports/repositories/auth/oauth-server-repository'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { logError } from '@/infrastructure/logging/logger'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { rateLimitedResponse } from '@/infrastructure/process/rate-limit-response'
import { isTransportRelaxed } from '@/infrastructure/process/security-posture'
import { getRequestClientIp } from '@/presentation/api/middleware/client-ip'
import { chainAdminInvitationRoutes } from './admin-invitation-routes'
import {
  isRateLimitExceeded,
  recordRateLimitRequest,
  isAuthRateLimitExceeded,
  recordAuthRateLimitRequest,
  getAuthRateLimitRetryAfter,
} from './auth-route-utils'
import { chainOrganizationTeamRoutes } from './organization-team-routes'
import type { App } from '@/domain/models/app'
// Both type-only. The OAuth metadata handlers and the auth instance are the
// two things this module needed the Better Auth package for; they now arrive as
// parameters (`authInstance`, `runtime`) from `createHonoApp`, which loads the
// package once, at boot, only when `app.auth` is set.
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'
import type { AuthRuntime } from '@/infrastructure/auth/better-auth/server-runtime'

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
const applyAuthCheckMiddleware = (
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
const applyAdminRoleCheckMiddleware = (
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
      })) as { readonly user?: { readonly role?: string } } | null

      const role = sessionResult?.user?.role
      // Better Auth stores the admin role on the user record. Any role that is
      // not admin-EQUIVALENT for this app (including undefined) is rejected
      // with 404 per S1.
      if (role === undefined || !isAdminEquivalent(role, app)) {
        return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
      }

      await next()
    } catch (error) {
      logError('[Admin Role Middleware] Session check error', error)
      // Errors during role resolution collapse to 404 (S1) — the safer
      // posture is "endpoint does not exist for you" rather than leaking
      // the auth subsystem state.
      return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
    }
  })
}

/**
 * Apply rate limiting middleware for admin endpoints
 * Returns a Hono app with rate limiting middleware applied
 */
const applyRateLimitMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    const ip = getRequestClientIp(c)

    // No `Retry-After`: this endpoint has never sent one, and the 1-second
    // admin window makes the hint near-worthless anyway. Kept as-is so this
    // stays a refactor.
    if (isRateLimitExceeded(ip)) return rateLimitedResponse(c)

    recordRateLimitRequest(ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

    await next()
  })
}

/**
 * Apply rate limiting middleware for authentication endpoints
 *
 * Protects security-critical authentication endpoints from brute force attacks.
 * The per-endpoint budgets live in `getAuthRateLimitConfigs`
 * (`auth-route-utils.ts`); this list only decides which paths the middleware is
 * MOUNTED on. A path missing from either place is uncapped, so the two must be
 * edited together.
 *
 * `/api/auth/oauth2/register` is here because, once an operator sets
 * `SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION=true`, it is an unauthenticated
 * write into `auth.oauth_client` — structurally the same surface as sign-up,
 * and it was the only one of the four carrying no cap at all.
 *
 * Returns a Hono app with rate limiting middleware applied
 */
const applyAuthRateLimitMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  const endpoints = [
    '/api/auth/sign-in/email',
    '/api/auth/sign-up/email',
    '/api/auth/request-password-reset',
    '/api/auth/oauth2/register',
  ]

  const result = endpoints.reduce((app, endpoint) => {
    return app.use(endpoint, async (c, next) => {
      const ip = getRequestClientIp(c)
      const { path } = c.req

      if (isAuthRateLimitExceeded(path, ip)) {
        const retryAfter = getAuthRateLimitRetryAfter(path, ip)
        return rateLimitedResponse(c, retryAfter)
      }

      recordAuthRateLimitRequest(path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

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

const isLoopbackOrigin = (origin: string): boolean =>
  origin.startsWith('http://localhost:') ||
  origin.startsWith('http://localhost') ||
  origin.startsWith('http://127.0.0.1:') ||
  origin.startsWith('http://127.0.0.1') ||
  origin.startsWith('http://[::1]')

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

/**
 * Serve the RFC 9728 protected-resource metadata document at the root path.
 *
 * The document itself is built by the `mcp()` plugin — Sovrium no longer
 * maintains its shape, so fields the plugin adds (the DPoP signing algorithms,
 * the scopes the resource actually accepts) arrive without a code change here.
 *
 * The route still exists because the plugin cannot serve it on its own under
 * Sovrium's mounting. Better Auth is mounted at `/api/auth/*`, and the plugin
 * matches the request's full pathname against the ROOT well-known path, which
 * no request reaching Better Auth ever has. Unlike the authorization-server and
 * OpenID documents, which the provider exports mountable handlers for
 * (`oauthProviderAuthServerMetadata`, `oauthProviderOpenIdConfigMetadata`),
 * there is no exported helper for this one — so a root route that forwards is
 * the only way the document is reachable at all.
 *
 * Both the bare path and the resource-suffixed form are registered: RFC 9728
 * §3.1 derives the metadata URL by inserting the resource's own path, and the
 * plugin answers on both.
 *
 * Mounted only when `app.auth` is configured (same gate as the plugin itself).
 */
const setupOauthProtectedResourceRoute = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app?: App
): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  // Forward the request verbatim. The `mcp()` plugin matches on the FULL
  // pathname, so it only recognises the request when the root path reaches
  // Better Auth unrewritten — rewriting it to sit under `/api/auth` is exactly
  // what makes the plugin ignore it.
  const serveProtectedResourceMetadata = (c: Readonly<Context>): Promise<Response> =>
    authInstance.handler(c.req.raw)

  return honoApp
    .get('/.well-known/oauth-protected-resource', serveProtectedResourceMetadata)
    .get('/.well-known/oauth-protected-resource/mcp', serveProtectedResourceMetadata)
}

/** Synthetic email-domain suffix that identifies an AI agent user record. */
const AGENT_EMAIL_SUFFIX = '@agents.sovrium.local'

/**
 * Intercept `GET /api/auth/admin/list-users` to exclude AI agent users.
 *
 * AI agents are stored in `auth.user` with a synthetic
 * `{name}@agents.sovrium.local` email so they inherit RBAC permissions
 *. They are NOT human users, so the
 * admin user-management list omits them by default
 *. An operator can opt back in with
 * `?includeAgents=true`.
 *
 * The handler delegates the actual listing to Better Auth, then post-filters
 * the `users` array of the JSON response. The auth-check middleware has
 * already enforced a valid admin session for this path, so a non-200 / non-
 * JSON response is forwarded untouched.
 *
 * Registered BEFORE the `/api/auth/*` catch-all so Hono's first-match routing
 * picks it up.
 */
const setupAgentUserListFilter = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app?: App
): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  return honoApp.get('/api/auth/admin/list-users', async (c) => {
    const response = await authInstance.handler(c.req.raw)
    if (response.status !== 200) return response

    const includeAgents = c.req.query('includeAgents') === 'true'
    if (includeAgents) return response

    const body = (await response
      .clone()
      .json()
      .catch(() => undefined)) as { users?: ReadonlyArray<{ email?: unknown }> } | undefined
    if (body === undefined || !Array.isArray(body.users)) return response

    const filtered = body.users.filter(
      (user) => typeof user.email !== 'string' || !user.email.endsWith(AGENT_EMAIL_SUFFIX)
    )
    return c.json({ ...body, users: filtered }, 200)
  })
}

/**
 * Register OAuth 2.1 / OIDC discovery endpoints at root domain level.
 *
 * Better Auth mounts the `oauth-provider` plugin under its basePath (`/api/auth`),
 * so the plugin's internal well-known routes resolve to
 * `/api/auth/.well-known/oauth-authorization-server` — NOT at the RFC-required
 * root path. The plugin exports `oauthProviderAuthServerMetadata` and
 * `oauthProviderOpenIdConfigMetadata` specifically for this mounting pattern.
 *
 * Only registered when `app.auth` is configured (same gate as the plugin itself).
 */
const setupOauthWellKnownRoutes = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app: App | undefined,
  runtime: AuthRuntime
): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  const authServerMetadataHandler = runtime.oauthProviderAuthServerMetadata(authInstance)
  const openIdConfigHandler = runtime.oauthProviderOpenIdConfigMetadata(authInstance)

  return honoApp
    .get('/.well-known/oauth-authorization-server', (c) => authServerMetadataHandler(c.req.raw))
    .get('/.well-known/openid-configuration', (c) => openIdConfigHandler(c.req.raw))
}

/**
 * Handle RFC 7662 token introspection for public OAuth clients.
 *
 * Better Auth's built-in introspect endpoint hard-codes a check that rejects
 * requests missing `client_secret`, even when the client was registered as
 * public (`tokenEndpointAuthMethod: 'none'`). This handler intercepts
 * introspect requests that carry only `client_id` (no secret), verifies the
 * client is indeed public, and performs the token lookup directly.
 *
 * Requests that include a `client_secret` or a `Basic` auth header are
 * forwarded untouched to Better Auth (confidential client path).
 *
 * Mounted BEFORE the Better Auth catch-all so Hono's first-match routing
 * picks it up before the `POST /api/auth/*` wildcard.
 */
const setupOauthPublicClientIntrospect = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app?: App
): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  return honoApp.post('/api/auth/oauth2/introspect', async (c) => {
    // Clone request before consuming body so the original stream is still
    // available to forward to Better Auth for confidential client requests.
    const clonedRequest = c.req.raw.clone()

    const body = await c.req.parseBody()
    const clientId = body['client_id'] as string | undefined
    const clientSecret = body['client_secret'] as string | undefined
    const token = body['token'] as string | undefined

    // Confidential client: has secret or Basic auth → delegate to Better Auth.
    const authHeader = c.req.header('authorization')
    if (clientSecret !== undefined || authHeader?.startsWith('Basic ')) {
      return authInstance.handler(clonedRequest)
    }

    // Public client path: must have client_id and token at minimum.
    if (!clientId || !token) {
      return c.json(
        { error: 'invalid_client', error_description: 'missing required credentials' },
        401
      )
    }

    // Verify the client exists and is flagged as public.
    const client = await runDomainPromise(
      c,
      Effect.gen(function* () {
        const repository = yield* OAuthServerRepository
        return yield* repository.findClientByClientId(clientId)
      })
    )
    if (!client?.public) {
      return c.json(
        { error: 'invalid_client', error_description: 'missing required credentials' },
        401
      )
    }

    // Look up the access token. Revoked tokens are deleted from this table,
    // so a missing row means inactive.
    const accessToken = await runDomainPromise(
      c,
      Effect.gen(function* () {
        const repository = yield* OAuthServerRepository
        return yield* repository.findAccessToken(token)
      })
    )

    if (!accessToken || accessToken.expiresAt < new Date()) {
      return c.json({ active: false })
    }

    // Reject tokens issued to a different client.
    if (accessToken.clientId !== clientId) {
      return c.json({ active: false })
    }

    return c.json({
      active: true,
      client_id: accessToken.clientId,
      sub: accessToken.userId ?? undefined,
      exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
      iat: Math.floor(accessToken.createdAt.getTime() / 1000),
      scope: accessToken.scopes?.join(' ') ?? undefined,
    })
  })
}

/**
 * Setup Better Auth routes with dynamic configuration
 *
 * Mounts Better Auth handler at /api/auth/* which provides all authentication endpoints.
 *
 * Creates a Better Auth instance dynamically based on the app's auth configuration,
 * allowing features like requireEmailVerification to be controlled per app.
 *
 * IMPORTANT: Better Auth instance is created once per app configuration and reused
 * across all requests to maintain internal state consistency.
 *
 * If no auth configuration is provided, no auth routes are registered and all
 * /api/auth/* requests will return 404 Not Found.
 *
 * Better Auth natively provides:
 * - Authentication: sign-up, sign-in, sign-out, verify-email, send-verification-email
 * - Admin Plugin: list-users, get-user, set-role, ban-user, unban-user, impersonate-user, stop-impersonating
 * - Organization Plugin: create-organization, list-organizations, get-organization, set-active-organization
 * - Two-Factor: enable, disable, verify
 * - Magic Link: send, verify
 *
 * Native Better Auth handles:
 * - Banned user rejection (automatic in admin plugin)
 * - Single-use verification tokens (automatic)
 * - Admin role validation (via adminRoles/adminUserIds config)
 * - Organization membership validation (automatic)
 *
 * @param honoApp - Hono application instance
 * @param app - Application configuration with auth settings
 * @param deps - What the composition root builds and threads in; see {@link AuthRouteDeps}
 * @returns Hono app with auth routes configured (or unchanged if auth is disabled)
 */
/**
 * Everything `setupAuthRoutes` needs that only the composition root can build.
 *
 * A bag rather than three positional parameters, and the reason is worth
 * stating: all three are CONSTRUCTED objects handed down from
 * `compose-hono-app.ts`, none is derived from the request, and the set grows
 * whenever another engine dependency stops being imported here. `emailHandlers`
 * is the newest member — it used to be built inside this file, which put a live
 * nodemailer transport in the import graph of a request handler (W5b).
 *
 * All three are `undefined` together, exactly when `app.auth` is unset:
 * `createHonoApp` builds them as a set, so one guard below covers all of them.
 */
export interface AuthRouteDeps {
  readonly authInstance: Readonly<ReturnType<typeof createAuthInstance>> | undefined
  readonly runtime: AuthRuntime | undefined
  /**
   * Handlers for password-reset / verification / magic-link mail, built at the
   * composition root. Non-optional: an app with auth but no SMTP still gets
   * handlers — they log the intended message instead of contacting a transport.
   */
  readonly emailHandlers: Readonly<ReturnType<typeof createEmailHandlers>>
}

export function setupAuthRoutes(
  honoApp: Readonly<Hono>,
  app: App | undefined,
  deps: AuthRouteDeps
): Readonly<Hono> {
  const { authInstance, runtime, emailHandlers } = deps
  // If no auth config is provided, don't register any auth routes
  // This causes all /api/auth/* requests to return 404 (not found)
  //
  // `authInstance` and `runtime` are non-null exactly when `app.auth` is set —
  // `createHonoApp` builds all three together — so this one guard covers all
  // three and no route below has to re-check.
  if (!app?.auth || !authInstance || !runtime) {
    return honoApp
  }

  // The instance is ALWAYS the one `createHonoApp` built — shared with page
  // routes for session extraction, and constructed with `app.connections` so
  // the user-create hook can auto-seed test tokens.
  //
  // There used to be a `?? createAuthInstance(app.auth, app.connections)`
  // fallback here for callers that passed none. It is gone deliberately: it was
  // the only reason this module needed `createAuthInstance` as a VALUE, and
  // that single import loaded the entire Better Auth package at boot. It also
  // built a SECOND instance with different arguments (no `app`), so the rare
  // path it served was subtly not the primary one.

  // Apply authentication check middleware (admin features always enabled when auth is configured)
  // This ensures 401 is returned before any parameter validation, preventing information leakage
  const appWithAuthCheck = applyAuthCheckMiddleware(honoApp, authInstance)

  // Apply admin-role check middleware. Per S1 anti-enumeration, non-admin
  // callers hitting `/api/auth/admin/*` receive 404 here (BEFORE Better Auth's
  // own 403). Runs after the auth-check so we already know the session exists.
  const appWithAdminRoleCheck = applyAdminRoleCheckMiddleware(appWithAuthCheck, authInstance, app)

  // Apply rate limiting middleware to admin routes
  const appWithAdminRateLimit = applyRateLimitMiddleware(appWithAdminRoleCheck)

  // Apply rate limiting middleware to authentication endpoints (sign-in, sign-up, password reset)
  const appWithAuthRateLimit = applyAuthRateLimitMiddleware(appWithAdminRateLimit)

  // Register Sovrium-engine admin invitation routes BEFORE the Better Auth
  // catch-all so the specific paths win the route lookup. These are NOT
  // Better Auth plugin endpoints — they live in the Sovrium engine because
  // Better Auth has no first-class concept of admin-driven invitation that
  // matches Sovrium's "1 app = 1 organization, decoupled user_access" model.
  const appWithInvitationRoutes = chainAdminInvitationRoutes(
    appWithAuthRateLimit,
    authInstance,
    emailHandlers,
    app
  )

  // Expose the plugin's RFC 9728 resource-server metadata document at the root
  // path. This pairs with the authorization-server metadata to form the full
  // OAuth discovery surface MCP clients expect. Mounted before the Better Auth
  // catch-all so the well-known path resolves first.
  const appWithProtectedResource = setupOauthProtectedResourceRoute(
    appWithInvitationRoutes,
    authInstance,
    app
  )

  // Mount OAuth 2.1 PKCE validation for the authorize endpoint. The oauth-provider
  // plugin's internal Zod schema rejects `code_challenge_method=plain` with a
  // generic VALIDATION_ERROR, but RFC 6749 §4.1.2.1 requires the error response
  // to use `error=invalid_request`. This handler intercepts requests that supply
  // a non-S256 method and returns an RFC-compliant 400 before the plugin runs.
  //
  // Hono routes are evaluated in registration order, so this specific GET
  // handler wins over the `/api/auth/*` catch-all registered below.
  const appWithOauthPkceValidation = appWithProtectedResource.get(
    '/api/auth/oauth2/authorize',
    async (c) => {
      const codeChallengeMethod = c.req.query('code_challenge_method')
      if (codeChallengeMethod !== undefined && codeChallengeMethod !== 'S256') {
        return c.json(
          {
            error: 'invalid_request',
            error_description: 'Only S256 code_challenge_method is supported per OAuth 2.1',
          },
          400
        )
      }
      return authInstance.handler(c.req.raw)
    }
  )

  // Intercept the admin list-users endpoint to exclude AI agent users by
  // default. Registered before the Better Auth catch-all so the specific GET
  // route wins; the handler delegates listing to Better Auth then filters.
  const appWithAgentUserFilter = setupAgentUserListFilter(
    appWithOauthPkceValidation,
    authInstance,
    app
  )

  // Mount OAuth 2.1 / OIDC well-known discovery documents at root domain level.
  // Better Auth mounts under /api/auth so the plugin's internal well-known routes
  // resolve to /api/auth/.well-known/* — not the RFC-required root path. These
  // handlers delegate to the auth instance's getOAuthServerConfig / getOpenIdConfig
  // API methods to produce the correct document at the root path.
  const appWithWellKnown = setupOauthWellKnownRoutes(
    appWithAgentUserFilter,
    authInstance,
    app,
    runtime
  )

  // Mount RFC 7662 introspection fix for public clients. Better Auth's built-in
  // introspect endpoint rejects requests with no client_secret, even for public
  // clients. This handler intercepts the route and handles public clients directly
  // before delegating confidential-client requests to Better Auth.
  const appWithPublicClientIntrospect = setupOauthPublicClientIntrospect(
    appWithWellKnown,
    authInstance,
    app
  )

  // Mount Sovrium's organization-team adapters (envelope normalization +
  // get-team / delete-team) BEFORE the Better Auth catch-all so the specific
  // routes win Hono's first-match lookup.
  const appWithTeamRoutes = chainOrganizationTeamRoutes(
    appWithPublicClientIntrospect,
    authInstance,
    app
  )

  // Mount Better Auth handler for all /api/auth/* routes
  // Better Auth natively handles:
  // - Authentication flows (sign-up, sign-in, sign-out, email verification)
  // - Admin operations (list-users, get-user, set-role, ban-user, impersonation)
  // - Organization management (create, list, get, set-active, invite members)
  // - Two-factor authentication (enable, disable, verify)
  // - Magic link authentication (send, verify)
  // - Banned user rejection (automatic for admin plugin)
  // - Single-use verification tokens (automatic)
  // - Team operations (create-team, add-team-member, etc.) when teams plugin enabled
  //
  // IMPORTANT: Better Auth handles its own routing and expects the FULL request path
  // including the /api/auth prefix. We pass the original request without modification.
  //
  // S1 anti-enumeration: Better Auth's organization/team plugin endpoints
  // return 403 for non-admin/non-owner callers. Rewrite those specific 403
  // responses to the canonical 404 envelope so the admin/owner permission
  // boundary is not discoverable.
  //
  // **Scope deliberately narrow**: this rewrite must NOT apply to `/sign-in`,
  // `/verify-email`, `/csrf`, etc. — those return 403 for state errors
  // (CSRF rejection, unverified-email block) where the 403 is semantically
  // correct and the spec contract preserves it. The `/admin/*` paths are
  // already covered by `applyAdminRoleCheckMiddleware`; this catch-all
  // adds coverage for the `organization/*` and `oauth*` plugin surfaces.
  return appWithTeamRoutes.on(['POST', 'GET'], '/api/auth/*', async (c) => {
    const response = await authInstance.handler(c.req.raw)
    if (response.status === 403 && isS1RewritablePath(c.req.path)) {
      return c.json({ success: false, message: 'Not Found', code: 'NOT_FOUND' }, 404)
    }
    return response
  })
}

/**
 * Determine whether a Better Auth 403 on this path should be rewritten to
 * a 404 per S1 anti-enumeration.
 *
 * Returns true ONLY for admin-only plugin routes that lack a Sovrium-level
 * role guard (organization plugin teams/members, oauth2 admin client mgmt).
 *
 * Excludes:
 * - `/api/auth/admin/*`: `applyAdminRoleCheckMiddleware` already converts
 *   the non-admin case to 404 BEFORE Better Auth runs. If a request reaches
 *   Better Auth (caller is admin) and STILL gets 403, that is a downstream
 *   state error (e.g. impersonating a banned user) — NOT an authz denial —
 *   and the 403 must be preserved.
 * - `/api/auth/sign-in`, `/verify-email`, `/csrf`: 403 here is a state error
 *   (CSRF rejection, unverified email) and must be preserved.
 */
const isS1RewritablePath = (path: string): boolean => {
  return path.startsWith('/api/auth/organization/') || path.startsWith('/api/auth/oauth2/')
}
