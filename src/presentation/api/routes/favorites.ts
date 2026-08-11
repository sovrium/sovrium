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
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { provideUserEntityListsLive } from '@/presentation/api/routes/favorites/effect-runner'
import { parseEntityMutationBody } from '@/presentation/api/routes/user-entity-lists'
import { unauthorized } from '@/presentation/api/utils/auth-helpers'
import { getSessionContext } from '@/presentation/api/utils/context-helpers'
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

/** Canonical 400 for a malformed favorite mutation body. */
const badRequest = (c: Context) =>
  c.json({ success: false, message: 'Invalid favorite payload', code: 'BAD_REQUEST' }, 400)

/**
 * GET /api/favorites — list the caller's favorites, newest first.
 *
 * Soft-deleted favorites are excluded, and any favorite whose backing record
 * has since been deleted is filtered out of the response.
 */
const handleList = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const visible = await runRequestEffect(
    c,
    ListFavorites(session.userId).pipe(provideUserEntityListsLive)
  )

  return c.json(visible, 200)
}

/**
 * POST /api/favorites — add an entity to the caller's favorites.
 *
 * Reviving a soft-deleted row keeps a single row per (user, entity) pair and
 * resets `created_at` so the favorite sorts to the top of the list.
 */
const handleAdd = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const body = await c.req.json().catch(() => undefined)
  const input = parseEntityMutationBody(body)
  if (!input) return badRequest(c)

  // eslint-disable-next-line functional/no-expression-statements -- IO boundary: the add-favorite use case returns void
  await runRequestEffect(c, AddFavorite(session.userId, input).pipe(provideUserEntityListsLive))
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
  if (!input) return badRequest(c)

  // eslint-disable-next-line functional/no-expression-statements -- IO boundary: the remove-favorite use case returns void
  await runRequestEffect(c, RemoveFavorite(session.userId, input).pipe(provideUserEntityListsLive))

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
/* eslint-disable drizzle/enforce-delete-with-where -- the .delete() call below is a Hono route definition, not a Drizzle delete */
export function chainFavoriteRoutes<T extends Hono>(honoApp: T): T {
  return honoApp
    .get('/api/favorites', handleList)
    .post('/api/favorites', handleAdd)
    .delete('/api/favorites', handleRemove) as T
}
/* eslint-enable drizzle/enforce-delete-with-where */
