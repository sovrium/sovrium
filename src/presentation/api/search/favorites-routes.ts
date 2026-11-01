/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from '@/application/use-cases/tables/user-entity-lists'
import { successResponseSchema } from '@/domain/models/api/common'
import { favoriteListResponseSchema } from '@/domain/models/api/search/entity-lists'
import { badRequest, notFound, unauthorized } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import {
  answerFailures,
  respondWith,
  runHandlerEffect,
  shapedJson,
} from '@/presentation/api/runtime/run-effect'
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
const handleList = (c: Context, app: App) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const session = getSessionContext(c)
        if (!session) return unauthorized(c)

        const caller = { app, userId: session.userId }
        const visible = yield* listFavorites(caller)

        return shapedJson(c, visible, favoriteListResponseSchema)
      })
    )
  )

/**
 * POST /api/favorites — add an entity to the caller's favorites.
 *
 * Reviving a soft-deleted row keeps a single row per (user, entity) pair and
 * resets `created_at` so the favorite sorts to the top of the list. A record of
 * a table the app does not declare, or whose list admits the caller no row, is
 * refused with the unknown table's 404.
 */
const handleAdd = (c: Context, app: App) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const session = getSessionContext(c)
        if (!session) return unauthorized(c)

        // effect-promise: total -- a body that is not JSON is caught here and read as none.
        const body = yield* Effect.promise(() => c.req.json().catch(() => undefined))
        const input = parseEntityMutationBody(body)
        if (!input) return badRequest(c, 'Invalid favorite payload')

        const caller = { app, userId: session.userId }
        const kept = yield* addFavorite(caller, input)
        // A table she may not list answers as a table that does not exist.
        if (!kept) return notFound(c)
        return yield* respondWith(c, Effect.succeed({ success: true }), successResponseSchema, 201)
      })
    )
  )

/**
 * DELETE /api/favorites — soft-delete an entity from the caller's favorites.
 */
const handleRemove = (c: Context) =>
  runHandlerEffect(
    c,
    answerFailures(
      c,
      Effect.gen(function* () {
        const session = getSessionContext(c)
        if (!session) return unauthorized(c)

        // effect-promise: total -- a body that is not JSON is caught here and read as none.
        const body = yield* Effect.promise(() => c.req.json().catch(() => undefined))
        const input = parseEntityMutationBody(body)
        if (!input) return badRequest(c, 'Invalid favorite payload')

        yield* removeFavorite(session.userId, input)

        return yield* respondWith(c, Effect.succeed({ success: true }), successResponseSchema)
      })
    )
  )

/**
 * Chain favorite routes onto a Hono app.
 *
 * **Authentication**: `authMiddleware` is applied to `/api/favorites` in
 * `middleware/api-auth-guards.ts` when `app.auth` is configured so `getSessionContext` can
 * resolve the caller. Each handler returns 401 itself when no session is
 * attached, so the routes behave consistently whether or not auth is wired.
 */
export function chainFavoriteRoutes(honoApp: Hono, app: App): Hono {
  return honoApp
    .get('/api/favorites', (c) => handleList(c, app))
    .post('/api/favorites', (c) => handleAdd(c, app))
    .delete('/api/favorites', handleRemove)
}
