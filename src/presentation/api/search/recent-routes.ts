/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  ListRecent,
  MAX_RECENT_ITEMS,
  RecordRecent,
} from '@/application/use-cases/user-entity-lists'
import { provideDomain, runRequestEffect } from '@/infrastructure/logging/request-effect'
import { unauthorized } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext } from '@/presentation/api/runtime/context-helpers'
import { parseEntityMutationBody } from '@/presentation/api/search/entity-list-parsers'
import type { Context, Hono } from 'hono'

/**
 * Recent Items API routes.
 *
 *   - `GET  /api/recent` — list the caller's recently viewed entities, newest
 *     first (most recently viewed). Optional `?limit=` caps the result count.
 *   - `POST /api/recent` — record a view of an entity. Re-visiting an entity
 *     upserts the existing row (refreshing `viewed_at`) so the recent list
 *     never accumulates duplicate rows for the same (user, entity) pair.
 *
 * Recent items are strictly per-user: every handler scopes its use case to the
 * authenticated session's `userId`. There is no client-supplied user id, so
 * cross-account reads/writes are impossible by construction.
 *
 * Data access (the upsert, the dialect-specific prune, the dead-record filter)
 * lives in the `user-entity-lists` use case + repository; these handlers keep
 * only HTTP, auth, the `?limit=` clamp, and body validation.
 */

/** Resolve the `?limit=` query parameter, clamped to `[1, MAX_RECENT_ITEMS]`. */
const resolveLimit = (c: Context): number => {
  const raw = c.req.query('limit')
  const parsed = raw === undefined ? MAX_RECENT_ITEMS : Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed < 1) return MAX_RECENT_ITEMS
  return Math.min(parsed, MAX_RECENT_ITEMS)
}

/**
 * GET /api/recent — list the caller's recent items, most recently viewed first.
 *
 * Any recent item whose backing record has since been deleted is filtered out
 * of the response.
 */
const handleList = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const limit = resolveLimit(c)

  const visible = await runRequestEffect(c, provideDomain(c, ListRecent(session.userId, limit)))

  return c.json(visible, 200)
}

/**
 * POST /api/recent — record a view of an entity for the caller.
 *
 * Re-visiting an entity refreshes the existing row's `viewed_at` so the recent
 * list keeps a single row per (user, entity) pair and the entity sorts to the
 * top of the list. Inserting also prunes rows beyond `MAX_RECENT_ITEMS`.
 */
const handleAdd = async (c: Context) => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const body = await c.req.json().catch(() => undefined)
  const input = parseEntityMutationBody(body)
  if (!input) {
    return c.json({ success: false, message: 'Invalid recent payload', code: 'BAD_REQUEST' }, 400)
  }

  await runRequestEffect(c, provideDomain(c, RecordRecent(session.userId, input)))

  return c.json({ success: true }, 201)
}

/**
 * Chain recent-item routes onto a Hono app.
 *
 * **Authentication**: `authMiddleware` is applied to `/api/recent` in
 * `api-routes.ts` when `app.auth` is configured so `getSessionContext` can
 * resolve the caller. Each handler returns 401 itself when no session is
 * attached, so the routes behave consistently whether or not auth is wired.
 */
export function chainRecentRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.get('/api/recent', handleList).post('/api/recent', handleAdd) as T
}
