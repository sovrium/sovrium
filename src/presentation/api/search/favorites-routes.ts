/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  AddFavorite,
  ListFavorites,
  RemoveFavorite,
} from '@/application/use-cases/user-entity-lists'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { badRequest, notFound, unauthorized } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { parseEntityMutationBody } from '@/presentation/api/search/entity-list-parsers'
import type { App } from '@/domain/models/app'
import type { Context, Hono } from 'hono'

/**
 * Favorite Records and Pages API routes.
 *
 *   - `GET    /api/favorites` — list the caller's favorites, newest first
 *   - `POST   /api/favorites` — add an entity to the caller's favorites
 *   - `DELETE /api/favorites` — remove an entity from the caller's favorites
 *
 * Favorites are strictly per-user: every handler scopes its use case to the
 * authenticated session's `userId`. There is no client-supplied user id, so
 * cross-account reads/writes are impossible by construction.
 *
 * Data access (soft-delete revive semantics, the dead-record filter) lives in
 * the `user-entity-lists` use case + repository; these handlers keep only HTTP,
 * auth, and body validation, then call the use cases via the effect runner.
 */

/**
 * GET /api/favorites — list the caller's favorites, newest first.
 *
 * Soft-deleted favorites are excluded, and so is any favorite whose record the
 * caller's list of its table no longer admits — removed, missing, not hers to
 * list, or of a table the app does not declare.
 */
const handleList = async (c: Context, app: App) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const caller = { app, userId: session.userId }
  const visible = await runRequestEffect(c, provideDomain(c, ListFavorites(caller)))

  return c.json(visible, 200)
}

/**
 * POST /api/favorites — add an entity to the caller's favorites.
 *
 * Reviving a soft-deleted row keeps a single row per (user, entity) pair and
 * resets `created_at` so the favorite sorts to the top of the list. A record of
 * a table the app does not declare, or whose list admits the caller no row, is
 * refused with the unknown table's 404.
 */
const handleAdd = async (c: Context, app: App) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const body = await c.req.json().catch(() => undefined)
  const input = parseEntityMutationBody(body)
  if (!input) return badRequest(c, 'Invalid favorite payload')

  const caller = { app, userId: session.userId }
  const kept = await runRequestEffect(c, provideDomain(c, AddFavorite(caller, input)))
  // A table she may not list answers as a table that does not exist.
  if (!kept) return notFound(c)
  return c.json({ success: true }, 201)
}

/**
 * DELETE /api/favorites — soft-delete an entity from the caller's favorites.
 */
const handleRemove = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const body = await c.req.json().catch(() => undefined)
  const input = parseEntityMutationBody(body)
  if (!input) return badRequest(c, 'Invalid favorite payload')

  await runRequestEffect(c, provideDomain(c, RemoveFavorite(session.userId, input)))

  return c.json({ success: true }, 200)
}

/**
 * Chain favorite routes onto a Hono app.
 *
 * **Authentication**: `authMiddleware` is applied to `/api/favorites` in
 * `api-routes.ts` when `app.auth` is configured so `getSessionContext` can
 * resolve the caller. Each handler returns 401 itself when no session is
 * attached, so the routes behave consistently whether or not auth is wired.
 */
export function chainFavoriteRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp
    .get('/api/favorites', (c) => handleList(c, resolveApp()))
    .post('/api/favorites', (c) => handleAdd(c, resolveApp()))
    .delete('/api/favorites', handleRemove) as T
}
