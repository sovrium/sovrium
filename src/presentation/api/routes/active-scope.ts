/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { UserAccessRepository } from '@/application/ports/repositories/user-access-repository'
import {
  cookieNameForScope,
  validateActiveAssignment,
} from '@/domain/services/active-assignment-cookie'
import { runUserAccessProgram } from '@/infrastructure/layers/table-layer'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Active-Scope Session API (P-6).
 *
 * Cookie-backed per-`tableSlug` "currently active" recordId for users
 * with multiple `user_access` rows for the same scope-table. Every
 * read AND write is server-validated against `user_access` to defeat
 * cookie tampering — see docs/user-stories/as-developer/authentication/active-scope-session.md.
 *
 * Endpoints (auto-mounted when `auth.scopeTables` is configured):
 *
 *   POST   /api/session/active-scope/:tableSlug  body { recordId }  → 200 + Set-Cookie
 *   GET    /api/session/active-scope/:tableSlug                     → 200 { tableSlug, recordId }
 *   DELETE /api/session/active-scope/:tableSlug                     → 204 + clear cookie
 *
 * Validation rules:
 *   * `:tableSlug` must be in `auth.scopeTables` (404 otherwise — apps
 *     without scopeTables get 404 across the board).
 *   * On POST, `recordId` must appear in the user's `user_access.record_ids`
 *     for the matching `tableSlug` (403 otherwise; no cookie set).
 *   * Cookie name: `sovrium_active_assignment_<tableSlug>` (one cookie
 *     per scope table so users with cross-scope active assignments stay
 *     independent).
 *
 * Cookie attributes: `httpOnly`, `sameSite=lax`, `secure` in production.
 *
 * The picker UI itself is just a normal Sovrium page (see
 * post-login-landing.spec.ts AC-003) — this file only owns the session
 * API.
 */

interface ContextLike {
  readonly json: (body: unknown, status?: number) => Response
}

const respondNotFound = (c: ContextLike) =>
  c.json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' }, 404)

const respondUnauthorized = (c: ContextLike) =>
  c.json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' }, 401)

const respondForbidden = (c: ContextLike, message: string) =>
  c.json({ success: false, message, code: 'FORBIDDEN' }, 403)

const respondBadRequest = (c: ContextLike, message: string) =>
  c.json({ success: false, message, code: 'BAD_REQUEST' }, 400)

const respondServerError = (c: ContextLike) =>
  c.json({ success: false, message: 'Internal server error', code: 'INTERNAL_ERROR' }, 500)

/**
 * Returns the list of scope tables an app has declared (or `undefined`
 * when the feature is disabled). Centralised so the 404 path behaves
 * identically across all three handlers.
 */
const getScopeTablesIfEnabled = (app: App): readonly string[] | undefined => {
  const scopeTables = app.auth?.scopeTables
  if (!scopeTables || scopeTables.length === 0) return undefined
  return scopeTables
}

/**
 * Look up the user's flattened `record_ids` for a given (userId, tableSlug)
 * pair from the `user_access` junction. Returns an empty array on any
 * error (e.g. junction table missing because scopeTables was reconfigured
 * mid-run). Equivalent to the `fetchUserAssignments` resolver in
 * `data-source-repository-live.ts` but routed through the
 * UserAccessRepository port so the route layer stays consistent with the
 * R-1 audit pattern (no raw `bun:sql` in handlers).
 */
const fetchAccessibleRecordIds = async (
  userId: string,
  tableSlug: string
): Promise<readonly string[]> => {
  const result = await runUserAccessProgram(
    Effect.gen(function* () {
      const repo = yield* UserAccessRepository
      return yield* repo.list({ userId })
    })
  )
  if (result._tag === 'Left') return []
  return result.right.filter((row) => row.tableSlug === tableSlug).flatMap((row) => row.recordIds)
}

interface PostBody {
  readonly recordId?: unknown
}

/**
 * POST /api/session/active-scope/:tableSlug
 * Body: `{ recordId }`. Validates `recordId` is in the user's
 * `user_access` rows for the slug; sets the cookie on success.
 */
async function handleSetActiveScope(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) return respondUnauthorized(c)

  const scopeTables = getScopeTablesIfEnabled(app)
  if (!scopeTables) return respondNotFound(c)

  const tableSlug = c.req.param('tableSlug')
  if (!tableSlug || !scopeTables.includes(tableSlug)) return respondNotFound(c)

  const body = (await c.req.json().catch(() => ({}))) as PostBody
  const { recordId } = body
  if (typeof recordId !== 'string' || recordId.length === 0) {
    return respondBadRequest(c, 'recordId is required and must be a non-empty string')
  }

  const accessible = await fetchAccessibleRecordIds(session.userId, tableSlug)
  if (validateActiveAssignment(recordId, accessible) === undefined) {
    return respondForbidden(c, 'recordId is not in your accessible scope')
  }

  setCookie(c, cookieNameForScope(tableSlug), recordId, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    secure: process.env['NODE_ENV'] === 'production',
  })

  return c.json({ tableSlug, recordId }, 200)
}

/**
 * GET /api/session/active-scope/:tableSlug
 * Returns the current `{ tableSlug, recordId }` from the cookie. The
 * value is re-validated against `user_access` so a tampered or stale
 * cookie reads as `null` rather than as the tampered value.
 */
async function handleGetActiveScope(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) return respondUnauthorized(c)

  const scopeTables = getScopeTablesIfEnabled(app)
  if (!scopeTables) return respondNotFound(c)

  const tableSlug = c.req.param('tableSlug')
  if (!tableSlug || !scopeTables.includes(tableSlug)) return respondNotFound(c)

  const cookieValue = getCookie(c, cookieNameForScope(tableSlug))
  if (!cookieValue) {
    // eslint-disable-next-line unicorn/no-null -- API contract: null means "no active scope"
    return c.json({ tableSlug, recordId: null }, 200)
  }

  const accessible = await fetchAccessibleRecordIds(session.userId, tableSlug)
  // API contract intentionally diverges from the SSR resolver: on
  // tamper we return null (not the fallback) so clients can distinguish
  // "no active scope" from "your cookie was rejected". The SSR resolver
  // silently falls back; the API surfaces the bad state.
  const validated = validateActiveAssignment(cookieValue, accessible)
  if (validated === undefined) {
    // eslint-disable-next-line unicorn/no-null -- API contract: null means "no valid active scope"
    return c.json({ tableSlug, recordId: null }, 200)
  }

  return c.json({ tableSlug, recordId: validated }, 200)
}

/**
 * DELETE /api/session/active-scope/:tableSlug
 * Clears the cookie. Returns 204.
 */
async function handleClearActiveScope(c: Context, app: App): Promise<Response> {
  const session = getSessionContext(c)
  if (!session) return respondUnauthorized(c)

  const scopeTables = getScopeTablesIfEnabled(app)
  if (!scopeTables) return respondNotFound(c)

  const tableSlug = c.req.param('tableSlug')
  if (!tableSlug || !scopeTables.includes(tableSlug)) return respondNotFound(c)

  // eslint-disable-next-line functional/no-expression-statements -- Side effect required for cookie clear
  deleteCookie(c, cookieNameForScope(tableSlug), {
    path: '/',
  })

  // 204 No Content — explicit null body matches Hono's body() signature
  // (the test asserts `[200, 204].toContain(r.status())`).
  // eslint-disable-next-line unicorn/no-null -- Hono's c.body() requires null (not undefined) for empty bodies
  return c.body(null, 204)
}

/**
 * Wrap a handler so any thrown error becomes a 500 JSON response rather
 * than crashing the request. Mirrors the safety net other Sovrium routes
 * provide.
 */
const safeHandler =
  (handler: (c: Context, app: App) => Promise<Response>, app: App) =>
  async (c: Context): Promise<Response> => {
    try {
      return await handler(c, app)
    } catch {
      return respondServerError(c)
    }
  }

/**
 * Chain the active-scope routes onto a Hono app. Always registered (even
 * when scopeTables is empty) so the handlers can return a clean 404 from
 * a single code path rather than having the router 404 with HTML.
 *
 * Auth middleware MUST already be applied to `/api/session/*` upstream so
 * `getSessionContext` resolves the active session.
 */
/* eslint-disable drizzle/enforce-delete-with-where -- the .delete() below is a Hono route definition, not a Drizzle delete */
export function chainActiveScopeRoutes<T extends Hono>(honoApp: T, app: App): T {
  return honoApp
    .post('/api/session/active-scope/:tableSlug', safeHandler(handleSetActiveScope, app))
    .get('/api/session/active-scope/:tableSlug', safeHandler(handleGetActiveScope, app))
    .delete('/api/session/active-scope/:tableSlug', safeHandler(handleClearActiveScope, app)) as T
}
/* eslint-enable drizzle/enforce-delete-with-where */
