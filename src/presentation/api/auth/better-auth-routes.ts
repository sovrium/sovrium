/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { type Hono } from 'hono'
import { OAuthServerRepository } from '@/application/ports/repositories/auth/oauth-server-repository'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import { notFound } from '@/presentation/api/runtime/auth-helpers'
import { chainAccountListRoutes } from './account-lists-routes'
import { chainAdminInvitationRoutes } from './admin-invitation-routes'
import {
  setupAgentUserListFilter,
  setupOauthProtectedResourceRoute,
  setupOauthWellKnownRoutes,
} from './auth-intercept-routes'
import {
  applyAdminRoleCheckMiddleware,
  applyAuthCheckMiddleware,
  applyAuthRateLimitMiddleware,
  applyRateLimitMiddleware,
} from './auth-middleware'
import { readErrorCode, rewritesForbiddenToNotFound } from './forbidden-to-not-found'
import { chainOrganizationTeamRoutes } from './organization-team-routes'
import type { InvitationServices } from '@/application/ports/contracts/invitation-services'
import type { App } from '@/domain/models/app'
// Both type-only. The OAuth metadata handlers and the auth instance are the
// two things this module needed the Better Auth package for; they now arrive as
// parameters (`authInstance`, `runtime`) from `createHonoApp`, which loads the
// package once, at boot, only when `app.auth` is set.
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { createEmailHandlers } from '@/infrastructure/auth/better-auth/email-handlers'
import type { AuthRuntime } from '@/infrastructure/auth/better-auth/server-runtime'

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
 * A bag rather than positional parameters: each is a CONSTRUCTED object handed
 * down from `compose-hono-app.ts`, none is derived from the request, and the set
 * grows whenever another engine dependency stops being imported here — building
 * one here would put its transport in the import graph of a request handler.
 *
 * The instance-bound ones are `undefined` together, exactly when `app.auth` is unset:
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
  readonly invitations: InvitationServices | undefined // the invitation store + engine
}

export function setupAuthRoutes(
  honoApp: Readonly<Hono>,
  app: App | undefined,
  deps: AuthRouteDeps
): Readonly<Hono> {
  const { authInstance, runtime, emailHandlers, invitations } = deps
  // If no auth config is provided, don't register any auth routes
  // This causes all /api/auth/* requests to return 404 (not found)
  //
  // `authInstance` and `runtime` are non-null exactly when `app.auth` is set —
  // `createHonoApp` builds all three together — so this one guard covers all
  // three and no route below has to re-check.
  if (!app?.auth || !authInstance || !runtime || !invitations) {
    return honoApp
  }

  // The instance is ALWAYS the one `createHonoApp` built — shared with page
  // routes for session extraction, and constructed with `app.connections` so
  // the user-create hook can auto-seed test tokens.
  //
  // There is deliberately no `?? createAuthInstance(app.auth, app.connections)`
  // fallback for callers that pass none: it would make this module need
  // `createAuthInstance` as a VALUE, and that single import loads the entire
  // Better Auth package at boot. It would also build a SECOND instance with
  // different arguments (no `app`), so the path it served would subtly not be
  // the primary one.

  // Apply authentication check middleware (admin features always enabled when auth is configured)
  // This ensures 401 is returned before any parameter validation, preventing information leakage
  const appWithAuthCheck = applyAuthCheckMiddleware(honoApp, authInstance)

  // Apply admin-role check middleware. Per S1 anti-enumeration, non-admin
  // callers hitting `/api/auth/admin/*` receive 404 here (BEFORE Better Auth's
  // own 403). Runs after the auth-check so we already know the session exists.
  const appWithAdminRoleCheck = applyAdminRoleCheckMiddleware(appWithAuthCheck, authInstance, app)

  // Apply rate limiting middleware to admin routes
  const appWithAdminRateLimit = applyRateLimitMiddleware(appWithAdminRoleCheck)

  // Apply rate limiting middleware to authentication endpoints (sign-in, sign-up,
  // password reset, and every route that sends mail)
  const appWithAuthRateLimit = applyAuthRateLimitMiddleware(appWithAdminRateLimit)

  // Register Sovrium-engine admin invitation routes BEFORE the Better Auth
  // catch-all so the specific paths win the route lookup. These are NOT
  // Better Auth plugin endpoints — they live in the Sovrium engine because
  // Better Auth has no first-class concept of admin-driven invitation that
  // matches Sovrium's "1 app = 1 organization, decoupled user_access" model.
  const appWithInvitationRoutes = chainAdminInvitationRoutes(
    appWithAuthRateLimit,
    authInstance,
    { emailHandlers, invitations },
    app
  )

  // Expose the plugin's RFC 9728 resource-server metadata document at the root
  // path, after the per-reader account lists; it pairs with the authorization-server
  // metadata for the OAuth discovery MCP clients expect, before the catch-all.
  const appWithProtectedResource = setupOauthProtectedResourceRoute(
    chainAccountListRoutes(appWithInvitationRoutes, { authInstance, invitations, app }),
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
  // S1 anti-enumeration: a Better Auth 403 that refuses the CALLER's
  // permission is rewritten to the canonical 404 envelope, so the permission
  // boundary is not discoverable — see `rewritesForbiddenToNotFound` for which
  // 403s qualify and which are kept.
  return appWithTeamRoutes.on(['POST', 'GET'], '/api/auth/*', async (c) => {
    const response = await authInstance.handler(c.req.raw)
    if (
      response.status === 403 &&
      rewritesForbiddenToNotFound(c.req.path, response.status, await readErrorCode(response))
    ) {
      return notFound(c, 'Not Found')
    }
    return response
  })
}
