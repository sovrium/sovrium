/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The routes `setupAuthRoutes` registers ahead of Better Auth's own catch-all:
 * the root-level OAuth discovery documents the RFCs require, the admin user
 * list with the AI agent users filtered out, and the language cookie a saved
 * language is written to.
 */
import { type Context, type Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { roleLabelFor } from '@/domain/models/app/auth/readable-name-service'
import {
  findDeclaredLanguage,
  findDeclaredLanguageCode,
  LANGUAGE_PREFERENCE_COOKIE,
} from '@/domain/models/app/languages/language-detection'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import type { App } from '@/domain/models/app'
import type { Languages } from '@/domain/models/app/languages/language'
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

/** The languages the built-in role words exist in, for an app that declares none. */
const BUILT_IN_WORD_LANGUAGES: Languages = {
  default: 'en',
  supported: [
    { code: 'en', locale: 'en-US', label: 'English' },
    { code: 'fr', locale: 'fr-FR', label: 'Français' },
  ],
}

/**
 * The language a caller reads in, from the first of their preferences that
 * names one: their saved account language, then the `sovrium_language` cookie
 * the page they read was served by. A preference the app declares wins; one
 * only the built-in role words exist in (an English-only app read by a French
 * console) still reads those words; neither falls back to the app's default.
 */
const callerLanguage = (app: App, preferences: ReadonlyArray<string | undefined>): string => {
  const declared = (languages: Languages | undefined): string | undefined =>
    preferences
      .map((preference) => findDeclaredLanguageCode(languages, preference))
      .find((code) => code !== undefined)
  return (
    declared(app.languages) ?? declared(BUILT_IN_WORD_LANGUAGES) ?? app.languages?.default ?? 'en'
  )
}

/**
 * The caller's role as the app calls it, in the language they read: the role's
 * declared label (its `$t:` key translated), else the built-in words for a role
 * every app carries, else its name made readable.
 */
const sessionRoleLabel = (app: App, role: string, language: string): string =>
  roleLabelFor(app.auth, role, language, (text) =>
    resolveTranslationPattern(text, language, app.languages)
  )

/**
 * The saved language as `$session.language` reads it: the declared locale of
 * the language it names, whichever spelling was saved — a bare `fr` reads as
 * `fr-FR` — so a control offering locales lands on the option of that
 * language. A value naming no language the app (or the built-in words) knows
 * is read back as it was saved. What is stored is unchanged.
 */
const sessionLanguage = (app: App, saved: string): string =>
  findDeclaredLanguage(app.languages, saved) ??
  findDeclaredLanguage(BUILT_IN_WORD_LANGUAGES, saved) ??
  saved

/**
 * Intercept `GET /api/auth/get-session` to lay the caller's `roleLabel` on the
 * envelope: their role as the app calls it, in their own language — what
 * `session: roleLabel` and `$session.roleLabel` read. Composed here because the
 * browser holds neither `auth.roles` nor the app's translations.
 *
 * Better Auth's own answer is kept whole — status, headers (a refreshed session
 * cookie included) and every field — and an answer that is not a signed-in
 * envelope is forwarded untouched. Registered before the `/api/auth/*`
 * catch-all so Hono's first-match routing picks it up.
 */
export const setupSessionRoleLabel = (
  honoApp: Readonly<Hono>,
  authInstance: Readonly<ReturnType<typeof createAuthInstance>>,
  app?: App
): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  return honoApp.get('/api/auth/get-session', async (c) => {
    const response = await authInstance.handler(c.req.raw)
    if (response.status !== 200) return response
    const body = (await response
      .clone()
      .json()
      .catch(() => undefined)) as
      { user?: { role?: unknown; language?: unknown } & Record<string, unknown> } | null | undefined
    const user = body?.user
    if (user === undefined || typeof user.role !== 'string') return response
    const saved = typeof user.language === 'string' ? user.language : undefined
    const language = callerLanguage(app, [saved, getCookie(c, LANGUAGE_PREFERENCE_COOKIE)])
    const headers = new Headers(response.headers)
    headers.delete('content-length')
    return new Response(
      JSON.stringify({
        ...body,
        user: {
          ...user,
          ...(saved === undefined ? {} : { language: sessionLanguage(app, saved) }),
          roleLabel: sessionRoleLabel(app, user.role, language),
        },
      }),
      { status: 200, headers }
    )
  })
}

/**
 * Write a language saved through `POST /api/auth/update-user` to this
 * browser's `sovrium_language` cookie as well as to the account, so a page that
 * reads the cookie before any session — a signed-out page, a surface composed
 * without the caller — reads the language the operator just chose rather than
 * an older one. The order the server resolves a language in is unchanged: a
 * saved account language still outranks the cookie.
 *
 * Middleware rather than a route: the update itself stays Better Auth's,
 * through the catch-all and everything it applies. The cookie is written only
 * when the update succeeded, with the value Better Auth's language guard just
 * accepted; it carries no authority (the server clamps it to the languages it
 * declares), so it is the switcher's cookie, not `HttpOnly`.
 */
export const setupSavedLanguageCookie = (honoApp: Readonly<Hono>, app?: App): Readonly<Hono> => {
  if (!app?.auth) return honoApp

  return honoApp.use('/api/auth/update-user', async (c, next) => {
    const body =
      c.req.method === 'POST'
        ? ((await c.req.raw
            .clone()
            .json()
            .catch(() => undefined)) as { language?: unknown } | null | undefined)
        : undefined
    await next()
    const language = body?.language
    if (c.res.status !== 200 || typeof language !== 'string' || language.trim() === '') return
    setCookie(c, LANGUAGE_PREFERENCE_COOKIE, language.trim(), {
      path: '/',
      maxAge: 31_536_000,
      sameSite: 'Lax',
      secure: new URL(c.req.url).protocol === 'https:',
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
