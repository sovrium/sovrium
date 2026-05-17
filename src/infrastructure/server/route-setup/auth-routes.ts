/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider'
import { eq } from 'drizzle-orm'
import { type Hono } from 'hono'
import { cors } from 'hono/cors'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'
import { oauthAccessTokens, oauthClients } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'
import { logError } from '@/infrastructure/logging/logger'
import { chainAdminInvitationRoutes } from './admin-invitation-routes'
import {
  isRateLimitExceeded,
  recordRateLimitRequest,
  extractClientIp,
  isAuthRateLimitExceeded,
  recordAuthRateLimitRequest,
  getAuthRateLimitRetryAfter,
} from './auth-route-utils'
import type { App } from '@/domain/models/app'

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
      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
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
      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
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
 * Apply rate limiting middleware for admin endpoints
 * Returns a Hono app with rate limiting middleware applied
 */
const applyRateLimitMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  return honoApp.use('/api/auth/admin/*', async (c, next) => {
    const ip = extractClientIp(c.req.header('x-forwarded-for'))

    if (isRateLimitExceeded(ip)) {
      return c.json(
        {
          success: false,
          message: 'Too many requests. Please try again later.',
          code: 'RATE_LIMITED',
        },
        429
      )
    }

    recordRateLimitRequest(ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

    // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
    await next()
  })
}

/**
 * Apply rate limiting middleware for authentication endpoints
 *
 * Protects security-critical authentication endpoints from brute force attacks:
 * - sign-in: 5 attempts per 60 seconds (prevent credential stuffing)
 * - sign-up: 5 attempts per 60 seconds (prevent account creation abuse)
 * - request-password-reset: 3 attempts per 60 seconds (prevent email enumeration)
 *
 * Returns a Hono app with rate limiting middleware applied
 */
const applyAuthRateLimitMiddleware = (honoApp: Readonly<Hono>): Readonly<Hono> => {
  const endpoints = [
    '/api/auth/sign-in/email',
    '/api/auth/sign-up/email',
    '/api/auth/request-password-reset',
  ]

  const result = endpoints.reduce((app, endpoint) => {
    return app.use(endpoint, async (c, next) => {
      const ip = extractClientIp(c.req.header('x-forwarded-for'))
      const { path } = c.req

      if (isAuthRateLimitExceeded(path, ip)) {
        const retryAfter = getAuthRateLimitRetryAfter(path, ip)
        return c.json(
          {
            success: false,
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMITED',
          },
          429,
          { 'Retry-After': retryAfter.toString() }
        )
      }

      recordAuthRateLimitRequest(path, ip) // eslint-disable-line functional/no-expression-statements -- Rate limiting state update

      // eslint-disable-next-line functional/no-expression-statements -- Hono middleware requires calling next()
      await next()
    })
  }, honoApp)

  return result
}

/**
 * Setup CORS middleware for Better Auth endpoints
 *
 * Configures CORS to allow:
 * - All localhost origins for development/testing
 * - Credentials for cookie-based authentication
 * - Common headers and methods
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
      origin: (origin) => {
        // Allow all localhost origins for development and testing
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return origin
        }
        // In production, this should be configured with specific allowed origins
        return origin
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
 * Register Sovrium's `/.well-known/oauth-protected-resource` endpoint
 * (RFC 9728: OAuth 2.0 Protected Resource Metadata).
 *
 * Better Auth's `oauth-provider` plugin ships the *authorization-server*
 * metadata (`/.well-known/oauth-authorization-server`, RFC 8414) and the
 * OIDC discovery doc (`/.well-known/openid-configuration`), but it does NOT
 * ship the *resource-server* metadata document required by RFC 9728.
 *
 * Resource-server metadata is what an MCP client follows after receiving a
 * `WWW-Authenticate: Bearer ...` 401 from `/mcp` — it tells the client
 * which authorization server(s) issue tokens for this resource and which
 * bearer-token transport methods are accepted.
 *
 * Document shape (RFC 9728 §3):
 * ```json
 * {
 *   "resource": "<base-url>",
 *   "authorization_servers": ["<base-url>"],
 *   "bearer_methods_supported": ["header"],
 *   "resource_documentation": "https://docs.sovrium.com/mcp"
 * }
 * ```
 *
 * Mounted only when `app.auth` is configured (the OAuth-server plugin only
 * runs in that case; advertising resource metadata when the AS is absent
 * would be misleading).
 */
const setupOauthProtectedResourceRoute = (honoApp: Readonly<Hono>, app?: App): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  return honoApp.get('/.well-known/oauth-protected-resource', (c) => {
    const baseUrl = process.env['BASE_URL'] ?? `http://localhost:${process.env['PORT'] ?? '3000'}`
    return c.json({
      resource: baseUrl,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header'],
      resource_documentation: 'https://docs.sovrium.com/mcp',
    })
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
  app?: App
): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  const authServerMetadataHandler = oauthProviderAuthServerMetadata(authInstance)
  const openIdConfigHandler = oauthProviderOpenIdConfigMetadata(authInstance)

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
    const clientRows = await db
      .select()
      .from(oauthClients)
      .where(eq(oauthClients.clientId, clientId))
      .limit(1)
    const client = clientRows[0]
    if (!client?.public) {
      return c.json(
        { error: 'invalid_client', error_description: 'missing required credentials' },
        401
      )
    }

    // Look up the access token. Revoked tokens are deleted from this table,
    // so a missing row means inactive.
    const tokenRows = await db
      .select()
      .from(oauthAccessTokens)
      .where(eq(oauthAccessTokens.token, token))
      .limit(1)
    const accessToken = tokenRows[0]

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
 * @returns Hono app with auth routes configured (or unchanged if auth is disabled)
 */
export function setupAuthRoutes(
  honoApp: Readonly<Hono>,
  app?: App,
  existingAuthInstance?: Readonly<ReturnType<typeof createAuthInstance>>
): Readonly<Hono> {
  // If no auth config is provided, don't register any auth routes
  // This causes all /api/auth/* requests to return 404 (not found)
  if (!app?.auth) {
    return honoApp
  }

  // Use pre-created auth instance if provided, otherwise create one.
  // When called from createHonoApp, the instance is shared with page routes for session extraction
  // and is constructed with `app.connections` so the user-create hook can
  // auto-seed test tokens. The fallback path here is rarely hit (callers
  // overwhelmingly pass `existingAuthInstance`), so we forward
  // `app.connections` for consistency with the primary path.
  const authInstance = existingAuthInstance ?? createAuthInstance(app.auth, app.connections)

  // Apply authentication check middleware (admin features always enabled when auth is configured)
  // This ensures 401 is returned before any parameter validation, preventing information leakage
  const appWithAuthCheck = applyAuthCheckMiddleware(honoApp, authInstance)

  // Apply rate limiting middleware to admin routes
  const appWithAdminRateLimit = applyRateLimitMiddleware(appWithAuthCheck)

  // Apply rate limiting middleware to authentication endpoints (sign-in, sign-up, password reset)
  const appWithAuthRateLimit = applyAuthRateLimitMiddleware(appWithAdminRateLimit)

  // Register Sovrium-engine admin invitation routes BEFORE the Better Auth
  // catch-all so the specific paths win the route lookup. These are NOT
  // Better Auth plugin endpoints — they live in the Sovrium engine because
  // Better Auth has no first-class concept of admin-driven invitation that
  // matches Sovrium's "1 app = 1 organization, decoupled user_access" model.
  const emailHandlers = createEmailHandlers(app.auth)
  const appWithInvitationRoutes = chainAdminInvitationRoutes(
    appWithAuthRateLimit,
    authInstance,
    app.auth,
    emailHandlers
  )

  // Mount Sovrium's resource-server metadata document (RFC 9728). This pairs
  // with the oauth-provider plugin's authorization-server metadata to form
  // the full OAuth discovery surface MCP clients expect. Mounted before the
  // Better Auth catch-all so the well-known path resolves first.
  const appWithProtectedResource = setupOauthProtectedResourceRoute(appWithInvitationRoutes, app)

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

  // Mount OAuth 2.1 / OIDC well-known discovery documents at root domain level.
  // Better Auth mounts under /api/auth so the plugin's internal well-known routes
  // resolve to /api/auth/.well-known/* — not the RFC-required root path. These
  // handlers delegate to the auth instance's getOAuthServerConfig / getOpenIdConfig
  // API methods to produce the correct document at the root path.
  const appWithWellKnown = setupOauthWellKnownRoutes(appWithOauthPkceValidation, authInstance, app)

  // Mount RFC 7662 introspection fix for public clients. Better Auth's built-in
  // introspect endpoint rejects requests with no client_secret, even for public
  // clients. This handler intercepts the route and handles public clients directly
  // before delegating confidential-client requests to Better Auth.
  const appWithPublicClientIntrospect = setupOauthPublicClientIntrospect(
    appWithWellKnown,
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
  return appWithPublicClientIntrospect.on(['POST', 'GET'], '/api/auth/*', async (c) => {
    return authInstance.handler(c.req.raw)
  })
}
