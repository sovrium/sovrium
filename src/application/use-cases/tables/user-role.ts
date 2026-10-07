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
 * There is no Promise-based injection seam for unit tests to bypass Effect DI:
 * with the requirement declared, a test provides a `Layer` instead — which is
 * the seam Effect already has, and one that cannot drift from the real call path.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { toGrantingRole } from '@/domain/models/app/auth/roles/granting-role-service'
import type { AuthDatabaseError } from '@/application/ports/repositories/auth/auth-repository'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'

/**
 * Retrieves the role the user is judged on, from the stored `role` column.
 *
 * Role resolution (`toGrantingRole`):
 * 1. Fetch the stored global role via AuthRepository
 * 2. Absent (no row, NULL) or empty → `NO_GRANT_ROLE`, which grants nothing.
 *    It does not fall back to `member`, whose bare-table default opens every
 *    table without a `permissions` block — the widest guess, not the safest.
 * 3. With `app`: a name the app does not declare → `NO_GRANT_ROLE` too
 *
 * @param userId - The user ID to look up
 * @param app - The app whose role vocabulary judges the stored name, when known
 */
export const getUserRole = (
  userId: string,
  app?: AdminRoleResolvable
): Effect.Effect<string, AuthDatabaseError, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const role = yield* repo.getUserRole(userId)
    return toGrantingRole(role, app)
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
 * `role` column, resolves to `NO_GRANT_ROLE` — the same judgement `getUserRole`
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
    return new Map(userIds.map((userId) => [userId, toGrantingRole(resolved.get(userId))]))
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
