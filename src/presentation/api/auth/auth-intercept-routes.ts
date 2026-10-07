/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The routes `setupAuthRoutes` registers ahead of Better Auth's own catch-all:
 * the root-level OAuth discovery documents the RFCs require, and the admin user
 * list with the AI agent users filtered out.
 */
import { type Context, type Hono } from 'hono'
import type { App } from '@/domain/models/app'
// Both type-only: the auth instance and the OAuth metadata handlers arrive as
// parameters (`authInstance`, `runtime`) from `createHonoApp`, which loads the
// Better Auth package once, at boot, only when `app.auth` is set.
import type { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import type { AuthRuntime } from '@/infrastructure/auth/better-auth/server-runtime'

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
export const setupOauthProtectedResourceRoute = (
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
 * admin user-management list omits them by default. An operator can opt back
 * in with `?includeAgents=true`.
 *
 * The handler delegates the actual listing to Better Auth, then post-filters
 * the `users` array of the JSON response. The auth-check middleware has
 * already enforced a valid admin session for this path, so a non-200 / non-
 * JSON response is forwarded untouched.
 *
 * Registered BEFORE the `/api/auth/*` catch-all so Hono's first-match routing
 * picks it up.
 */
export const setupAgentUserListFilter = (
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
export const setupOauthWellKnownRoutes = (
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
