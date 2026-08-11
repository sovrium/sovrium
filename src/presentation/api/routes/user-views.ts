/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  createUserView,
  deleteUserView,
  getSharedView,
  listUserViews,
  updateUserView,
} from '@/application/use-cases/tables/user-views'
import {
  userViewPatchSchema,
  userViewResponseSchema,
  userViewsListResponseSchema,
} from '@/domain/models/api/tables/user-views'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { notFound, unauthorized } from '@/presentation/api/utils/auth-helpers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
import { provideDatabaseLive } from './user-views/effect-runner'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Personal Saved Views API routes (PG-03 / [internal ref],
 * [internal ref]).
 *
 *   - `GET    /api/tables/:tableId/user-views`           — list the caller's saved views
 *   - `POST   /api/tables/:tableId/user-views`           — create a new saved view
 *   - `PATCH  /api/tables/:tableId/user-views/:viewId`   — update a saved view
 *   - `DELETE /api/tables/:tableId/user-views/:viewId`   — delete a saved view
 *
 * Saved views are strictly per-user: every handler scopes its query to the
 * authenticated session's `userId`. There is no client-supplied user id, so
 * cross-account reads/writes are impossible by construction.
 *
 * Phase 8 Cycle 2 — handlers consume Effect.gen programs from
 * `@/application/use-cases/tables/user-views`; the route layer remains
 * async/await and runs each program through `Effect.runPromise(... pipe(
 * provideDatabaseLive, Effect.either))`. Responses are shaped by
 * `userViewResponseSchema` / `userViewsListResponseSchema` for OpenAPI-
 * contract enforcement (S4: never return raw DB rows from an API route).
 */

/** Canonical 400 for malformed JSON or schema-shape mismatches. */
const badRequest = (c: Context, message = 'Invalid view payload') =>
  c.json({ success: false, message, code: 'BAD_REQUEST' }, 400)

/** Canonical 409 for unique-name collisions on `(user, table, name)`. */
const conflict = (c: Context, message = 'A view with that name already exists') =>
  c.json({ success: false, message, code: 'CONFLICT' }, 409)

/** Canonical 500 wrapper used by every DB-error branch. */
const internalError = (c: Context) =>
  c.json({ success: false, message: 'Internal server error', code: 'INTERNAL_ERROR' }, 500)

interface SavedViewPayload {
  readonly name: string
  readonly filters?: unknown
  readonly sorts?: unknown
  readonly fields?: unknown
  readonly groupBy?: unknown
  /** Presentation state — the shape + layout the view was saved in. */
  readonly viewType?: unknown
  readonly rowDensity?: unknown
  readonly columnWidths?: unknown
  readonly baseViewId?: string | number
  readonly isDefault?: boolean
}

/** Validate that a `POST` body has at least a non-empty `name`. */
const parseCreatePayload = (body: unknown): SavedViewPayload | undefined => {
  if (!body || typeof body !== 'object') return undefined
  const b = body as Record<string, unknown>
  if (typeof b['name'] !== 'string' || b['name'].trim() === '') return undefined
  return {
    name: b['name'],
    filters: b['filters'],
    sorts: b['sorts'],
    fields: b['fields'],
    groupBy: b['groupBy'],
    viewType: b['viewType'],
    rowDensity: b['rowDensity'],
    columnWidths: b['columnWidths'],
    baseViewId: b['baseViewId'] as string | number | undefined,
    isDefault: b['isDefault'] === true,
  }
}

/**
 * Parse + strict-validate the PATCH body. Returns the validated record on
 * success or `undefined` on shape failure — callers translate `undefined` into
 * the canonical 400 envelope. Phase 7 Cycle 3.
 */
const parsePatchBody = async (c: Context): Promise<Record<string, unknown> | undefined> => {
  const body = await c.req.json().catch(() => undefined)
  if (!body || typeof body !== 'object') return undefined
  const parsed = userViewPatchSchema.safeParse(body)
  if (!parsed.success) return undefined
  return parsed.data as Record<string, unknown>
}

/** GET /api/tables/:tableId/user-views — list the caller's views for this table. */
const handleList = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  if (!tableName) return notFound(c, 'Table not found')

  const result = await runRequestEffect(
    c,
    listUserViews({ userId: session.userId, tableName }).pipe(provideDatabaseLive, Effect.either)
  )
  if (result._tag === 'Left') return internalError(c)
  return c.json(userViewsListResponseSchema.parse(result.right), 200)
}

/** POST /api/tables/:tableId/user-views — create a new view for the caller. */
const handleCreate = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  if (!tableName) return notFound(c, 'Table not found')

  const body = await c.req.json().catch(() => undefined)
  const payload = parseCreatePayload(body)
  if (!payload) return badRequest(c)

  const result = await runRequestEffect(
    c,
    createUserView({ userId: session.userId, tableName, ...payload }).pipe(
      provideDatabaseLive,
      Effect.either
    )
  )
  if (result._tag === 'Left') {
    if (result.left._tag === 'UserViewConflictError') return conflict(c)
    if (result.left._tag === 'UserViewNotFoundError') return badRequest(c, 'Failed to create view')
    return internalError(c)
  }
  return c.json(userViewResponseSchema.parse(result.right), 201)
}

/** PATCH /api/tables/:tableId/user-views/:viewId — update a view the caller owns. */
const handleUpdate = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  const viewId = c.req.param('viewId')
  if (!tableName || !viewId) return notFound(c, 'View not found')

  const b = await parsePatchBody(c)
  if (!b) return badRequest(c)

  const result = await runRequestEffect(
    c,
    updateUserView({
      userId: session.userId,
      tableName,
      viewId,
      name: typeof b['name'] === 'string' ? b['name'] : undefined,
      isDefault: typeof b['isDefault'] === 'boolean' ? b['isDefault'] : undefined,
      filters: b['filters'],
      sorts: b['sorts'],
      fields: b['fields'],
      groupBy: b['groupBy'] as string | null | undefined,
      // Presentation state. This hand-written projection is a THIRD
      // allow-list on the same wire contract (after `userViewPatchSchema` and
      // the repository's `mergeConfigKeys`); all three have to move together,
      // or a key that validates is silently dropped before it reaches the
      // JSONB blob and the PATCH looks like it worked.
      viewType: b['viewType'],
      rowDensity: b['rowDensity'],
      columnWidths: b['columnWidths'],
      baseViewId: b['baseViewId'] as string | number | null | undefined,
    }).pipe(provideDatabaseLive, Effect.either)
  )
  if (result._tag === 'Left') {
    if (result.left._tag === 'UserViewConflictError') return conflict(c)
    if (result.left._tag === 'UserViewNotFoundError') return notFound(c, 'View not found')
    return internalError(c)
  }
  return c.json(userViewResponseSchema.parse(result.right), 200)
}

/** DELETE /api/tables/:tableId/user-views/:viewId — delete a view the caller owns. */
const handleDelete = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const tableName = c.req.param('tableId')
  const viewId = c.req.param('viewId')
  if (!tableName || !viewId) return notFound(c, 'View not found')

  const result = await runRequestEffect(
    c,
    deleteUserView({ userId: session.userId, tableName, viewId }).pipe(
      provideDatabaseLive,
      Effect.either
    )
  )
  if (result._tag === 'Left') {
    if (result.left._tag === 'UserViewNotFoundError') return notFound(c, 'View not found')
    return internalError(c)
  }
  return c.json({ success: true }, 200)
}

/**
 * Chain user-views CRUD routes onto a Hono app.
 *
 * Routes are mounted under `/api/tables/:tableId/user-views[...]`. The
 * `/api/tables/*` auth chain wired in `api-routes.ts` provides the
 * `authMiddleware` so handlers can resolve the caller via `getSessionContext`.
 */
/* eslint-disable drizzle/enforce-delete-with-where -- the .delete() call below is a Hono route definition, not a Drizzle delete */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono types
export function chainUserViewRoutes<T extends Hono<any, any, any>>(honoApp: T): T {
  return (
    honoApp
      .get('/api/tables/:tableId/user-views', handleList)
      .post('/api/tables/:tableId/user-views', handleCreate)
      .patch('/api/tables/:tableId/user-views/:viewId', handleUpdate)
      // Cycle 6 ([internal ref] regression): the share spec issues
      // `request.put()` against the same path the personal-views CRUD owns.
      // Mirroring user-table-preferences (which also exposes both verbs for
      // the same upsert handler), accept PUT alongside PATCH so existing
      // and forthcoming specs can pick either.
      .put('/api/tables/:tableId/user-views/:viewId', handleUpdate)
      .delete('/api/tables/:tableId/user-views/:viewId', handleDelete) as T
  )
}
/* eslint-enable drizzle/enforce-delete-with-where */

/**
 * Shared-view lookup with table-level read-permission enforcement
 * ([internal ref]..026). Anti-enumeration: missing view AND
 * permission denial both surface as HTTP 404.
 */
const handleShared = async (c: Context, app: App): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  const viewId = c.req.param('viewId')
  if (!viewId) return notFound(c, 'View not found')

  const result = await runRequestEffect(
    c,
    getSharedView({ userId: session.userId, viewId, app }).pipe(provideDatabaseLive, Effect.either)
  )
  if (result._tag === 'Left') {
    if (
      result.left._tag === 'UserViewNotFoundError' ||
      result.left._tag === 'UserViewForbiddenError'
    ) {
      return notFound(c, 'View not found')
    }
    return internalError(c)
  }
  return c.json(userViewResponseSchema.parse(result.right), 200)
}

/**
 * Chain the share-by-id lookup route onto a Hono app at
 * `/api/shared-views/:viewId` — at the same level as `/api/tables/*` (NOT
 * under it), because share lookups are cross-table-by-design. The
 * composition root supplies an `App` resolver so the handler can validate
 * that the view's bound table is still part of the live app (e.g. after
 * `POST /draft/publish`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono types
export function chainSharedViewRoute<T extends Hono<any, any, any>>(
  honoApp: T,
  resolveApp: () => App
): T {
  return honoApp.get('/api/shared-views/:viewId', (c) => handleShared(c, resolveApp())) as T
}
