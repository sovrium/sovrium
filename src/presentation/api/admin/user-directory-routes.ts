/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { UserDirectoryRepository } from '@/application/ports/repositories/auth/user-directory-repository'
import { lastSeenOfProgram } from '@/application/use-cases/auth/user-presence-programs'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { ApiErrorCode } from '@/domain/models/api/combinators/error'
import { seesPresence } from '@/domain/models/app/auth/presence-audience-service'
import { UserDirectoryRepositoryLive } from '@/infrastructure/database/repositories/auth/user-directory-repository-live'
import { logError } from '@/infrastructure/logging/logger'
import { runRequestEffect } from '@/infrastructure/logging/request-effect'
import { isPersonOnline } from '@/infrastructure/realtime/app-connections'
import { errorBody, unauthorized } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext, requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import { runOnRequest } from '@/presentation/api/runtime/run-effect'
import type { App } from '@/domain/models/app'
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

/** One person's presence facts as a reader shown presence reads them. */
type PresenceFacts = { readonly online: boolean; readonly lastSeen?: string | null }

/**
 * The presence facts of the listed people, for a reader whose role is in
 * `auth.presence.visibleTo`: whether each is online, and, under `lastSeen`,
 * when she was last seen (null while she is online, or when she never was).
 * Any other reader gets none, so her entries carry neither key.
 */
const presenceFactsFor = async (
  c: Context,
  app: App,
  input: { readonly readerId: string; readonly userIds: readonly string[] }
): Promise<ReadonlyMap<string, PresenceFacts>> => {
  const presence = app.auth?.presence
  if (presence === undefined) return new Map()
  const role = await runOnRequest(c, getUserRole(input.readerId, app))
  if (role._tag === 'Failure' || !seesPresence(app, { role: role.success, signedIn: true })) {
    return new Map()
  }
  const seen =
    presence.lastSeen === true ? await runOnRequest(c, lastSeenOfProgram(input.userIds)) : undefined
  if (seen?._tag === 'Failure') logError('[users] last-seen read failed', seen.failure)
  const lastSeen = seen?._tag === 'Success' ? seen.success : new Map<string, Date>()
  return new Map(
    input.userIds.map((userId) => {
      const online = isPersonOnline(app.name, userId)
      const last = online ? null : (lastSeen.get(userId)?.toISOString() ?? null)
      return [userId, { online, ...(presence.lastSeen === true && { lastSeen: last }) }] as const
    })
  )
}

/**
 * The presence the `?filter=` expression asks for — `true` for people
 * connected, `false` for the others — read off its `{ field: online, operator:
 * eq }` condition, the one a filter bar's Online / Offline choice publishes.
 * `undefined` when it names none; other conditions are not this route's.
 */
function onlineAskedBy(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined
  try {
    const parsed = JSON.parse(raw) as { readonly and?: unknown }
    const leaves = Array.isArray(parsed.and) ? parsed.and : [parsed]
    const leaf = leaves.find(
      (candidate: unknown): candidate is { readonly value: unknown } =>
        typeof candidate === 'object' &&
        candidate !== null &&
        (candidate as Record<string, unknown>)['field'] === 'online' &&
        (candidate as Record<string, unknown>)['operator'] === 'eq'
    )
    return leaf === undefined ? undefined : String(leaf.value) === 'true'
  } catch {
    // A filter that is not JSON narrows nothing here.
    return undefined
  }
}

/**
 * The people a reader asked for. Asked who is (or is not) online, a reader
 * shown presence gets exactly those people; any other reader gets no one, so
 * the answer never tells her who is connected.
 */
function keepAsked<T extends { readonly id: string }>(
  users: readonly T[],
  facts: ReadonlyMap<string, PresenceFacts>,
  online: boolean | undefined
): readonly T[] {
  if (online === undefined) return users
  return users.filter((user) => facts.get(user.id)?.online === online)
}

/**
 * `GET /api/users/directory?q=&limit=&filter=`
 */
const handleDirectory = async (c: Context, app: App): Promise<Response> => {
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
    return c.json(
      errorBody({
        error: 'Failed to read the user directory',
        code: ApiErrorCode.INTERNAL_ERROR,
      }),
      500
    )
  }

  const facts = await presenceFactsFor(c, app, {
    readerId: session.userId,
    userIds: result.success.map((user) => user.id),
  })
  const listed = keepAsked(result.success, facts, onlineAskedBy(c.req.query('filter')))
  return c.json({ users: listed.map((user) => ({ ...user, ...facts.get(user.id) })) }, 200)
}

/**
 * Chain the user-directory route onto a Hono app.
 *
 * **Authentication**: `authMiddleware` is applied to `/api/users/*` in
 * `api-routes.ts` when `app.auth` is configured, so `getSessionContext` can
 * resolve the caller. The handler returns 401 itself when no session is
 * attached, so the route behaves the same whether or not auth is wired.
 */
export function chainUserDirectoryRoutes<T extends Hono>(honoApp: T, resolveApp: () => App): T {
  return honoApp.get('/api/users/directory', (c) => handleDirectory(c, resolveApp())) as T
}
