/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Global-role reads and writes, as Effects.
 *
 * Each function DECLARES `AuthRepository` rather than binding one (standing
 * rule E1), so the composition root that owns a runtime discharges it. On the
 * request path that is `runDomainPromise(c, …)`, which hands the program the
 * services the server resolved at boot; the role read happens on the request's
 * own fiber, inside its span, instead of on a detached one.
 *
 * The Promise-based `AuthRoleService` injection seam that used to sit here is
 * gone. It existed so a unit test could bypass Effect DI; with the requirement
 * declared, a test provides a `Layer` instead — which is the seam Effect
 * already has, and one that cannot drift from the real call path.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { AuthDatabaseError } from '@/application/ports/repositories/auth/auth-repository'

// Constants
const DEFAULT_ROLE = 'member'

/**
 * Retrieves the user's global role from the database.
 *
 * Role resolution:
 * 1. Fetch global user role from users table via AuthRepository
 * 2. Default: 'member'
 *
 * @param userId - The user ID to look up
 */
export const getUserRole = (
  userId: string
): Effect.Effect<string, AuthDatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const role = yield* repo.getUserRole(userId)
    return role ?? DEFAULT_ROLE
  }).pipe(Effect.withSpan('tables.get-user-role'))

/**
 * Resolves the global role of MANY users in ONE query.
 *
 * The bulk form of {@link getUserRole}. Reach for it whenever the input is a
 * LIST of user ids: calling `getUserRole` in a loop — or, worse, inside a
 * `Promise.all` — issues one pooled read per id, so a roster of ten rows takes
 * the whole ten-connection pool and starves every co-firing request. See
 * `[internal ref]`.
 *
 * Every requested id gets an entry: an id with no user row, or with an unset
 * `role` column, resolves to `DEFAULT_ROLE` — the same fallback `getUserRole`
 * applies — so callers may index the returned map unconditionally.
 *
 * @param userIds - The user IDs to look up. Duplicates are harmless.
 */
export const getUserRoles = (
  userIds: readonly string[]
): Effect.Effect<ReadonlyMap<string, string>, AuthDatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const resolved = yield* repo.getUserRoles(userIds)
    return new Map(userIds.map((userId) => [userId, resolved.get(userId) ?? DEFAULT_ROLE]))
  }).pipe(Effect.withSpan('tables.get-user-roles'))

/**
 * Updates the user's global role in the database
 *
 * @param userId - The user ID to update
 * @param role - The new role to assign
 */
export const updateUserRole = (
  userId: string,
  role: string
): Effect.Effect<void, AuthDatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    yield* repo.updateUserRole(userId, role)
  }).pipe(Effect.withSpan('tables.update-user-role'))

/**
 * Retrieves the user's active session token from the database
 *
 * @param userId - The user ID to look up
 * @returns The raw session token, or undefined if no active session
 */
export const getUserSessionToken = (
  userId: string
): Effect.Effect<string | undefined, AuthDatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.getUserSessionToken(userId)
  }).pipe(Effect.withSpan('tables.get-user-session-token'))
