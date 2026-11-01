/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { UserDirectoryRepository } from '@/application/ports/repositories/auth/user-directory-repository'
import { OnlinePeople } from '@/application/ports/services/online-people'
import { lastSeenOfProgram } from '@/application/use-cases/auth/user-presence-programs'
import {
  getUserAccessRoles,
  getUserGroups,
  tableEffectiveRoles,
} from '@/application/use-cases/tables/user-groups'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { userDirectoryResponseSchema } from '@/domain/models/api/admin/user-directory'
import { ApiErrorCode } from '@/domain/models/api/error'
import {
  hasCreatePermissionForRoles,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { seesPresence } from '@/domain/models/app/auth/presence-audience-service'
import {
  appListsUserDirectory,
  tablesHoldingPersonField,
} from '@/domain/models/app/tables/fields/field-types/user/user-directory-need-service'
import { logError } from '@/infrastructure/logging/logger'
import { errorBody, notFound, unauthorized } from '@/presentation/api/runtime/auth-helpers'
import { getSessionContext, requestLogAttributes } from '@/presentation/api/runtime/context-helpers'
import { respondWith, runHandlerEffect } from '@/presentation/api/runtime/run-effect'
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
 * A `user` field is unusable without this list, so the exposure — a signed-in
 * user who may pick a person can enumerate display names — is the price of the
 * feature, and it is exactly why the body must not carry email.
 *
 * ## Who it answers
 *
 * Only a caller with a NEED to pick a person: she may create or update records
 * of a table holding a `user`, `created-by` or `updated-by` field, or her role
 * is shown presence, or a page of the app lists the directory (a need every
 * signed-in caller shares). Anyone else signed in is answered the standard
 * `404`, as if the list did not exist for her.
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
 * An unauthenticated caller gets **401**, checked first, so a visitor learns
 * only that the list needs a session. A signed-in caller with no need gets the
 * 404 above.
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

/** Whether the reader's role is in `auth.presence.visibleTo`, so she is shown presence. */
const isShownPresence = (app: App, readerId: string) =>
  Effect.gen(function* () {
    if (app.auth?.presence === undefined) return false
    const role = yield* Effect.result(getUserRole(readerId, app))
    return role._tag === 'Success' && seesPresence(app, { role: role.success, signedIn: true })
  })

/**
 * Whether the reader needs the directory to pick a person, other than through
 * presence: a page of the app lists it, or she may create or update records of
 * a table holding a person field — judged by the records API's own evaluator,
 * over her role, her groups and, under row-level rules, her assignment roles.
 */
const needsDirectory = (app: App, readerId: string) =>
  Effect.gen(function* () {
    if (appListsUserDirectory(app)) return true
    const tables = tablesHoldingPersonField(app)
    if (tables.length === 0) return false
    const underRowRules = tables.some((table) => table.rowLevelPermissions !== undefined)
    // effect-swallow: a caller whose identity cannot be read shows no need; she is answered the 404.
    const identity = yield* Effect.result(
      Effect.all([
        getUserRole(readerId, app),
        getUserGroups(readerId),
        underRowRules ? getUserAccessRoles(readerId) : Effect.succeed([] as readonly string[]),
      ])
    )
    if (identity._tag === 'Failure') return false
    const [role, groups, accessRoles] = identity.success
    return tables.some((table) => {
      const roles = tableEffectiveRoles(table, { role, groups, accessRoles })
      return (
        hasCreatePermissionForRoles(table, roles, app) ||
        hasUpdatePermissionForRoles(table, roles, app)
      )
    })
  })

/**
 * The presence facts of the listed people, for a reader shown presence:
 * whether each is online, and, under `lastSeen`, when she was last seen (null
 * while she is online, or when she never was). Any other reader gets none, so
 * her entries carry neither key.
 */
const presenceFactsFor = (
  app: App,
  input: { readonly shown: boolean; readonly userIds: readonly string[] }
) =>
  Effect.gen(function* () {
    const presence = app.auth?.presence
    if (presence === undefined || !input.shown) return new Map<string, PresenceFacts>()
    const seen =
      presence.lastSeen === true
        ? yield* Effect.result(lastSeenOfProgram(input.userIds))
        : undefined
    if (seen?._tag === 'Failure') logError('[users] last-seen read failed', seen.failure)
    const lastSeen = seen?._tag === 'Success' ? seen.success : new Map<string, Date>()
    const people = yield* OnlinePeople
    return new Map<string, PresenceFacts>(
      input.userIds.map((userId) => {
        const online = people.isOnline(app.name, userId)
        const last = online ? null : (lastSeen.get(userId)?.toISOString() ?? null)
        return [userId, { online, ...(presence.lastSeen === true && { lastSeen: last }) }] as const
      })
    )
  })

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
 * `GET /api/users/directory?q=&limit=&filter=`
 */
const handleDirectory = (c: Context, app: App): Promise<Response> | Response => {
  const session = getSessionContext(c)
  if (!session) return unauthorized(c)
  return runHandlerEffect(c, directoryProgram(c, app, session.userId))
}

/** Who asks decides who is listed; what is listed leaves through the directory's contract. */
const directoryProgram = (c: Context, app: App, readerId: string) =>
  Effect.gen(function* () {
    const shown = yield* isShownPresence(app, readerId)
    if (!shown && !(yield* needsDirectory(app, readerId))) return notFound(c)

    const term = c.req.query('q')?.trim()
    const limit = resolveLimit(c.req.query('limit'))
    // Asked who is (or is not) online, a reader shown presence gets exactly those
    // people; any other reader gets no one, so the answer never tells her who is
    // connected.
    const online = onlineAskedBy(c.req.query('filter'))
    if (online !== undefined && !shown) {
      return yield* respondWith(c, Effect.succeed({ users: [] }), userDirectoryResponseSchema)
    }

    const listed = yield* Effect.result(
      Effect.gen(function* () {
        const repository = yield* UserDirectoryRepository
        const people = yield* OnlinePeople
        // Narrowed to who is (or is not) online in the query itself: one page in
        // the directory's order, however far into it those people sort.
        return yield* repository.listPickableUsers({
          term,
          limit,
          ids:
            online === undefined ? undefined : { within: online, ids: people.onlineOf(app.name) },
        })
      })
    )
    if (listed._tag === 'Failure') {
      logError('[users] directory read failed', listed.failure, requestLogAttributes(c))
      return c.json(
        errorBody({
          error: 'Failed to read the user directory',
          code: ApiErrorCode.INTERNAL_ERROR,
        }),
        500
      )
    }

    const facts = yield* presenceFactsFor(app, {
      shown,
      userIds: listed.success.map((user) => user.id),
    })
    return yield* respondWith(
      c,
      Effect.succeed({
        users: listed.success.map((user) => ({ ...user, ...facts.get(user.id) })),
      }),
      userDirectoryResponseSchema
    )
  })

/**
 * Chain the user-directory route onto a Hono app.
 *
 * **Authentication**: `authMiddleware` is applied to `/api/users/*` in
 * `middleware/api-auth-guards.ts` when `app.auth` is configured, so `getSessionContext` can
 * resolve the caller. The handler returns 401 itself when no session is
 * attached, so the route behaves the same whether or not auth is wired.
 */
export function chainUserDirectoryRoutes(honoApp: Hono, app: App): Hono {
  return honoApp.get('/api/users/directory', (c) => handleDirectory(c, app))
}
