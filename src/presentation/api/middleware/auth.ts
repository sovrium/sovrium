/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isOpenToEveryone, toPermissionValue } from '@/domain/models/shared/permission-evaluation'
import { logError, logWarning } from '@/infrastructure/logging/logger'
import { getRequestTrustedClientIp } from './client-ip'
import type { UserSession } from '@/application/ports/models/user-session'
import type { AdminRoleResolvable } from '@/domain/models/app'
import type { Context, Next } from 'hono'

/**
 * Minimal Better Auth instance interface
 *
 * Typed to the subset of the Better Auth API actually used by the middleware.
 * Better Auth's full type varies by configuration (plugins, providers)
 * and uses optional fields (ipAddress?) that conflict with our Session type
 * (ipAddress: string | null), so getSession returns Promise<unknown>.
 * The middleware handles extraction with runtime checks and explicit casts.
 */
interface BetterAuthLike {
  readonly api: {
    readonly getSession: (options: { readonly headers: Headers }) => Promise<unknown>
  }
}

/**
 * Hono context with session attached
 *
 * Used by auth middleware to store extracted session for route handlers
 */
export type ContextWithSession = Context & {
  readonly var: {
    readonly session?: UserSession
  }
}

/**
 * Validate session binding to original IP and User-Agent
 *
 * When strict mode is enabled, sessions are bound to the IP address and
 * User-Agent that created them. This prevents session hijacking attacks.
 *
 * A session that recorded neither value is accepted: each check below can
 * only reject on a binding the session actually carries, so there is nothing
 * to compare against. Better Auth stores `''` rather than omitting the field
 * when it cannot determine the client IP (no forwarding header in production)
 * or the request carries no User-Agent, so this is a reachable state and not
 * merely a legacy one.
 *
 * @param session - Session object from database
 * @param currentIP - Current request IP address
 * @param currentUserAgent - Current request User-Agent
 * @returns true if session is valid, false if binding validation fails
 */
function validateSessionBinding(
  session: UserSession,
  currentIP: string | undefined,
  currentUserAgent: string | undefined
): boolean {
  // If session has IP binding, validate it matches
  if (session.ipAddress && currentIP && session.ipAddress !== currentIP) {
    return false
  }

  // If session has User-Agent binding, validate it matches
  if (session.userAgent && currentUserAgent && session.userAgent !== currentUserAgent) {
    return false
  }

  return true
}

/**
 * Process session result and attach to context if valid
 *
 * Validates session binding and logs security warnings for failed validations.
 */
function processSessionResult(
  c: Context,
  sessionResult: { readonly session?: UserSession } | null
): void {
  if (!sessionResult?.session) {
    return
  }

  // Trusted-proxy headers only, never the transport peer. `session.ipAddress`
  // was written by Better Auth from its OWN header detection, so the two values
  // are only comparable when both come from a forwarding header. Feeding the
  // peer in here makes every session look relocated on any deployment where
  // Better Auth recorded something else, and `validateSessionBinding` then
  // rejects valid sessions.
  const currentIP = getRequestTrustedClientIp(c)
  const currentUserAgent = c.req.header('user-agent')

  if (validateSessionBinding(sessionResult.session as UserSession, currentIP, currentUserAgent)) {
    c.set('session', sessionResult.session as UserSession)
  } else {
    // Session binding validation failed - log for security monitoring
    logWarning(
      `[AUTH] Session binding validation failed: ${JSON.stringify({
        sessionId: sessionResult.session.id,
        expectedIP: sessionResult.session.ipAddress,
        currentIP,
        expectedUserAgent: sessionResult.session.userAgent,
        currentUserAgent,
      })}`
    )
  }
}

/**
 * Auth middleware for Hono routes
 *
 * Extracts Better Auth session from request and attaches to context.
 * Routes can access session via `c.var.session`.
 *
 * **Session Extraction Strategy**:
 * 1. Check for Authorization header (Bearer token)
 * 2. Query Better Auth session table to validate token
 * 3. Validate session binding (IP/User-Agent) if strict mode enabled
 * 4. Attach session to context if valid
 * 5. Continue to route handler (session may be undefined for public routes)
 *
 * **Session Binding (Strict Mode)**:
 * When enabled, sessions are bound to the IP address and User-Agent that
 * created them. Requests from different IP/User-Agent will be rejected.
 *
 * **Usage**:
 * ```typescript
 * app.use('/api/tables/*', authMiddleware(auth))
 * app.get('/api/tables/:id', async (c) => {
 *   const session = c.var.session
 *   if (!session) return c.json({ error: 'Unauthorized' }, 401)
 *   // Use session for database queries
 * })
 * ```
 *
 * @param auth - Better Auth instance with api.getSession method
 * @returns Hono middleware function
 */
export function authMiddleware(auth: BetterAuthLike) {
  return async (c: Context, next: Next) => {
    try {
      const authHeader = c.req.header('authorization')

      if (authHeader?.toLowerCase().startsWith('bearer ')) {
        const apiKey = authHeader.slice(7)
        const result = (await auth.api.getSession({
          headers: new Headers({ authorization: apiKey }),
        })) as { readonly session?: UserSession } | null
        processSessionResult(c, result)
      } else {
        const result = (await auth.api.getSession({
          headers: c.req.raw.headers,
        })) as { readonly session?: UserSession } | null
        processSessionResult(c, result)
      }
    } catch (error) {
      logError('[AUTH] Session extraction failed', error)
    }

    // eslint-disable-next-line functional/no-expression-statements -- Required for middleware to continue to next handler
    await next()
  }
}

/**
 * Middleware handler for requiring authentication
 */
async function requireAuthHandler(c: ContextWithSession, next: Next) {
  const { session } = c.var

  if (!session) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      },
      401
    )
  }

  // eslint-disable-next-line functional/no-expression-statements -- Required for middleware to continue to next handler
  await next()
}

/**
 * Anonymous carve-outs for the otherwise-auth-gated `/api/tables/*` surface.
 *
 * Two opt-in exemptions let unauthenticated traffic reach a table handler; every
 * other path under `/api/tables/*` still gets the normal 401:
 *
 * 1. **PG-02 guest comments** — `GET`/`POST /api/tables/:t/records/:r/comments`
 *    when the table sets `comments.guestComments: true`. The honeypot +
 *    rate-limit + classifier guards inside `comment-handlers.ts` (running BEFORE
 *    record-exists / DB writes) provide the spam floor that makes this safe.
 *
 * 2. **[internal ref] public read** — an anonymous `GET` on a table whose resolved
 *    `permissions.read` is `'all'` (the documented "everyone incl.
 *    unauthenticated"). Scoped TIGHT: reads only (list + single record), opt-in
 *    per table. Non-`all` tables and writes keep the normal 401 (S1
 *    anti-enumeration preserved). The read handler already grants `read: 'all'`
 *    via `hasReadPermission`; the middleware was the only gate out of step.
 *
 * Both branches inject the same minimal synthetic `guest` principal so
 * downstream middleware (`enrichUserRole`, `validateTable`) and the handlers
 * read consistent context — field-level and row-level read permissions then
 * apply to the anonymous caller exactly as to any role.
 *
 * Implemented as a factory rather than a plain handler so the live-App
 * resolver (`resolveApp`) can be injected by the composition root —
 * `app.tables[]` is the source of truth for both per-table flags and must be
 * re-read on every request ([internal ref] live publish).
 */
export function requireAuthOrGuestComment(
  resolveApp: () => { readonly tables?: ReadonlyArray<unknown> } | undefined
) {
  return async (c: ContextWithSession, next: Next): Promise<Response | undefined> => {
    if (c.var.session) {
      // eslint-disable-next-line functional/no-expression-statements -- middleware continuation
      await next()
      return undefined
    }
    const app = resolveApp()
    const isGuestComment = isGuestCommentCreateRequest(c) && hasGuestCommentsEnabled(c, app)
    const isPublicRead = isPublicTableRecordReadRequest(c) && hasPublicReadEnabled(c, app)
    if (isGuestComment || isPublicRead) {
      injectGuestPrincipal(c)
      // eslint-disable-next-line functional/no-expression-statements -- middleware continuation
      await next()
      return undefined
    }
    return c.json(
      {
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      },
      401
    )
  }
}

/**
 * Inject a minimal synthetic `guest` principal onto the context so downstream
 * middleware (`enrichUserRole`, `validateTable`) and handlers can read a
 * consistent session/role without each re-implementing the guest-fallback
 * branch. `enrichUserRole` skips its DB lookups for `userId: 'guest'` and keeps
 * this pre-set role/groups.
 */
function injectGuestPrincipal(c: ContextWithSession): void {
  const guestSession: UserSession = {
    userId: 'guest',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    token: '',
    // eslint-disable-next-line unicorn/no-null -- Session.ipAddress is `string | null`
    ipAddress: null,
    // eslint-disable-next-line unicorn/no-null -- Session.userAgent is `string | null`
    userAgent: null,
  } as UserSession
  c.set('session', guestSession)
  c.set('userRole', 'guest')
  c.set('userGroups', [] as readonly string[])
}

function isGuestCommentCreateRequest(c: Context): boolean {
  // PG-02 guest exemption covers BOTH listing (GET) and posting (POST)
  // comments. If a table allows unauthenticated POST to /comments, it
  // would be inconsistent to require auth on GET — guests viewing a
  // public blog post need to see existing comments alongside their own.
  // PATCH/DELETE on `/comments/{id}` stay auth-gated (anchored below).
  if (c.req.method !== 'POST' && c.req.method !== 'GET') return false
  // Hono request path is the path portion (no query string). Match the
  // canonical comments-list/create shape:
  //   `/api/tables/{X}/records/{Y}/comments`.
  // Use a regex anchored to the full path so subroute collisions (e.g.
  // `/comments/{commentId}`) don't accidentally bypass auth.
  return /^\/api\/tables\/[^/]+\/records\/[^/]+\/comments\/?$/.test(c.req.path)
}

function hasGuestCommentsEnabled(
  c: Context,
  app: { readonly tables?: ReadonlyArray<unknown> } | undefined
): boolean {
  if (!app?.tables) return false
  // Extract the {tableId} segment without depending on Hono param binding
  // (this middleware runs upstream of `validateTable`, so `c.req.param('tableId')`
  // is unavailable here).
  const match = c.req.path.match(/^\/api\/tables\/([^/]+)\/records\//)
  if (!match) return false
  const tableKey = match[1] ?? ''
  const table = app.tables.find((t): t is { readonly name?: string; readonly id?: unknown } => {
    if (typeof t !== 'object' || t === null) return false
    const candidate = t as { readonly name?: unknown; readonly id?: unknown }
    return candidate.name === tableKey || String(candidate.id ?? '') === tableKey
  })
  if (!table) return false
  const { comments } = table as { readonly comments?: { readonly guestComments?: boolean } }
  return comments?.guestComments === true
}

/**
 * [internal ref] public-read carve-out — matches the two READ record routes only:
 *   `GET /api/tables/:t/records`         (list)
 *   `GET /api/tables/:t/records/:id`     (single record)
 * The single-record shape anchors to one trailing segment so deeper subroutes
 * (`/comments`, `/comments/:id`, `/history`) do NOT match — they stay 401'd.
 * Writes, `/trash`, `/subscribe`, `/export`, `/views/*` are excluded by shape.
 */
const PUBLIC_READ_LIST_PATH = /^\/api\/tables\/[^/]+\/records\/?$/
const PUBLIC_READ_SINGLE_PATH = /^\/api\/tables\/[^/]+\/records\/[^/]+\/?$/

function isPublicTableRecordReadRequest(c: Context): boolean {
  if (c.req.method !== 'GET') return false
  const { path } = c.req
  return PUBLIC_READ_LIST_PATH.test(path) || PUBLIC_READ_SINGLE_PATH.test(path)
}

/**
 * True when the `/api/tables/:t/records...` request targets a table whose
 * resolved `permissions.read` is the `'all'` literal (public read, opt-in per
 * table). A `read: [roles]` / `'authenticated'` / absent grant returns false so
 * anonymous callers keep the normal 401 (anti-enumeration preserved).
 */
function hasPublicReadEnabled(
  c: Context,
  app: { readonly tables?: ReadonlyArray<unknown> } | undefined
): boolean {
  if (!app?.tables) return false
  // Extract the {tableId} segment without depending on Hono param binding
  // (this middleware runs upstream of `validateTable`).
  const match = c.req.path.match(/^\/api\/tables\/([^/]+)\/records/)
  if (!match) return false
  const tableKey = match[1] ?? ''
  const table = app.tables.find((t): t is { readonly name?: string; readonly id?: unknown } => {
    if (typeof t !== 'object' || t === null) return false
    const candidate = t as { readonly name?: unknown; readonly id?: unknown }
    return candidate.name === tableKey || String(candidate.id ?? '') === tableKey
  })
  if (!table) return false
  const { permissions } = table as { readonly permissions?: { readonly read?: unknown } }
  // Deliberately ONE rung, not the ladder: only the `'all'` literal opens a
  // table to anonymous reads. `'authenticated'` and role arrays must
  // keep the normal 401 so anti-enumeration is preserved.
  return isOpenToEveryone(toPermissionValue(permissions?.read))
}

/**
 * Require authentication middleware
 *
 * Returns 401 if session is not present.
 * Use this for protected routes that require authentication.
 *
 * **Usage**:
 * ```typescript
 * app.use('/api/tables/*', authMiddleware(auth))
 * app.use('/api/tables/*', requireAuth())
 * app.get('/api/tables/:id', async (c) => {
 *   const session = c.var.session! // Safe to use non-null assertion
 *   // Session is guaranteed to exist
 * })
 * ```
 *
 * @returns Hono middleware function
 */
export function requireAuth() {
  return requireAuthHandler
}

/**
 * Resolve the live App for tier resolution. `{}` falls back to built-in roles
 * only. Typed against the domain resolver's own `AdminRoleResolvable` contract
 * (a type-only import — erased at runtime, so the middleware keeps no heavy
 * domain-aggregate *value* dependency) rather than re-declaring an identical
 * structural shape locally; only `auth.roles[]` is read by `resolveDashboardTier`.
 */
type ResolveTierApp = () => AdminRoleResolvable | undefined

/**
 * Build the single admin guard middleware (Native Admin Dashboard / `/api/admin/*`).
 *
 * The returned handler reads the session, resolves the caller's global role,
 * and grants access when that role can reach the admin surface at all
 * (the canonical `isAdminTier(role, app)` predicate). Config is code-only: there is no
 * runtime config-mutation surface, so the historical editor/viewer split is
 * collapsed — every admin-capable role gets the same full access. The canonical
 * anti-enumeration 404 (never 403) is returned for authenticated-but-non-admin
 * callers so the admin route surface is never discoverable (S1). When
 * `notFoundOnMissingSession` is true the guard also 404s unauthenticated callers
 * (read-surface anti-enumeration); otherwise it 401s them.
 *
 * `resolveApp` threads the live App so a custom top role (e.g. partner's
 * `engineer`) resolves to admin access implicitly. When omitted, the resolver
 * runs against an empty app, so built-in `admin` and the legacy `operator` role
 * resolve — preserving the historical behavior of call sites that do not thread
 * the app.
 */
function makeAdminGuard(notFoundOnMissingSession: boolean, resolveApp?: ResolveTierApp) {
  return async (c: ContextWithSession, next: Next) => {
    const { session } = c.var

    if (!session) {
      if (notFoundOnMissingSession) {
        return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
      }
      return c.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        401
      )
    }

    // Lazy imports to avoid database / domain initialization at import time.
    const { getUserRole } = await import('@/application/use-cases/tables/user-role')
    const { isAdminTier } = await import('@/domain/models/app')
    const role = await getUserRole(session.userId)
    const app = resolveApp?.() ?? {}

    if (!isAdminTier(role, app)) {
      // S1 anti-enumeration: authenticated-but-non-admin callers receive 404
      // (never 403) so the admin route surface is not discoverable.
      return c.json({ success: false, message: 'Not found', code: 'NOT_FOUND' }, 404)
    }

    // eslint-disable-next-line functional/no-expression-statements -- Required for middleware to continue to next handler
    await next()
  }
}

/**
 * Require admin middleware (admin-gated routes).
 *
 * Returns 401 if no session, 404 if the caller is authenticated but not an
 * admin-capable role (S1 anti-enumeration — the admin route surface is hidden
 * from non-admins). Must be used after authMiddleware() which extracts the
 * session.
 *
 * `resolveApp` (optional) threads the live App so a custom top role resolves to
 * admin access implicitly. Built-in `admin` resolves regardless, so existing
 * call sites that omit it are unchanged.
 *
 * **Usage**:
 * ```typescript
 * app.use('/api/admin/*', authMiddleware(auth))
 * app.use('/api/admin/*', requireAuth())
 * app.use('/api/admin/*', requireAdmin(resolveLiveApp))
 * ```
 *
 * @returns Hono middleware function
 */
export function requireAdmin(resolveApp?: ResolveTierApp) {
  return makeAdminGuard(false, resolveApp)
}

/**
 * Require admin middleware for read surfaces (same admin check as
 * {@link requireAdmin}, but `notFoundOnMissingSession` is true so both
 * missing-session and non-admin callers receive the anti-enumeration 404).
 *
 * Retained as a distinct export so the read-route call sites keep their
 * anti-enumeration-on-missing-session posture without each having to opt in.
 * Config code-only collapsed the editor/viewer split, so this grants the same
 * full access as `requireAdmin`.
 *
 * @returns Hono middleware function
 */
export function requireAdminTier(resolveApp?: ResolveTierApp) {
  return makeAdminGuard(true, resolveApp)
}
