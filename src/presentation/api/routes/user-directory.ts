/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { UserDirectoryRepository } from '@/application/ports/repositories/auth/user-directory-repository'
import { UserDirectoryRepositoryLive } from '@/infrastructure/database/repositories/auth/user-directory-repository-live'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { unauthorized } from '@/presentation/api/utils/auth-helpers'
import { getSessionContext, requestLogAttributes } from '@/presentation/api/utils/context-helpers'
import type { Context, Hono } from 'hono'

/**
 * `GET /api/users/directory` — the candidate source for a `user` field picker.
 *
 * A `user` field emits a foreign key to the Better Auth user table and nothing
 * else: `UserFieldSchema` declares only `type` and `allowMultiple`, so there is
 * no schema-level candidate configuration to consult. Before this endpoint the
 * SSR `UserInput` rendered an EMPTY `<select>` under a JSDoc promising that
 * "the runtime populates `<option>` entries on hydration" — no consumer of that
 * marker existed. This is that runtime.
 *
 * ## What it returns, and what it refuses to return
 *
 * `{ id, name, image }`. **Never `email`.**
 *
 * `name` is user-supplied and non-unique, so two people called "Jean Martin"
 * are indistinguishable from the label alone. `image` is the disambiguator:
 * it is already on the user row, it is nullable, and it fails SOFT — two
 * identical names with no avatars are merely ambiguous. Email fails HARD: it
 * would make every signed-in account's address readable by every other signed-in
 * account, permanently, to solve a display problem. A picker needs a label, not
 * an address.
 *
 * A `user` field is unusable without this list, so the exposure — every signed-in
 * user can enumerate display names — is the price of the feature, and it is
 * exactly why the body must not carry email.
 *
 * ## Where the query lives
 *
 * In `UserDirectoryRepositoryLive`, not here. Which accounts are pickable
 * (agents excluded, banned excluded), why the directory is deliberately NOT
 * organization-scoped, and why the case-insensitive match is spelled
 * `lower(…) LIKE lower(…)` rather than `ILIKE` are all documented with the
 * implementation, because they are statements about the store's rows.
 *
 * This route keeps only what a route owns: the session gate, the `?limit=`
 * bound, and the status code.
 *
 * ## The cap is PERFORMANCE, not a security control
 *
 * `?limit=` is bounded and `?q=` searches server-side purely so a large
 * directory costs one small page instead of the whole table. Neither is a
 * confidentiality measure and neither should ever be cited as one: a caller who
 * may read one page may read every page by asking again. Documenting a page cap
 * as a safeguard is how a false guarantee gets built on top of it. Search is
 * net-neutral for exposure — it trades bulk dumping for targeted probing.
 *
 * ## 401, not 404
 *
 * An unauthenticated caller gets **401**. The anti-enumeration 404 belongs to
 * the `requireAdminTier` paths, where the very existence of an admin surface is
 * what is being hidden. This endpoint is not admin-tier: it is readable by every
 * signed-in account, so a 404 would claim it does not exist while it plainly
 * does for anyone with a session.
 */

/** Default page size. Performance, not a boundary — see the module docblock. */
const DEFAULT_LIMIT = 20

/** Ceiling on `?limit=`. Performance, not a boundary — see the module docblock. */
const MAX_LIMIT = 100

function resolveLimit(raw: string | undefined): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT
  return Math.min(Math.floor(parsed), MAX_LIMIT)
}

/**
 * `GET /api/users/directory?q=&limit=`
 */
const handleDirectory = async (c: Context): Promise<Response> => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)

  const term = c.req.query('q')?.trim()
  const limit = resolveLimit(c.req.query('limit'))

  const program = Effect.gen(function* () {
    const repository = yield* UserDirectoryRepository
    return yield* repository.listPickableUsers({ term, limit })
  }).pipe(Effect.provide(UserDirectoryRepositoryLive))

  const result = await runRequestEffect(c, program.pipe(Effect.result))
  if (result._tag === 'Failure') {
    logError('[users] directory read failed', result.failure, requestLogAttributes(c))
    return c.json({ error: 'Failed to read the user directory' }, 500)
  }

  return c.json({ users: result.success }, 200)
}

/**
 * Chain the user-directory route onto a Hono app.
 *
 * **Authentication**: `authMiddleware` is applied to `/api/users/*` in
 * `api-routes.ts` when `app.auth` is configured, so `getSessionContext` can
 * resolve the caller. The handler returns 401 itself when no session is
 * attached, so the route behaves the same whether or not auth is wired.
 */
export function chainUserDirectoryRoutes<T extends Hono>(honoApp: T): T {
  return honoApp.get('/api/users/directory', handleDirectory) as T
}
