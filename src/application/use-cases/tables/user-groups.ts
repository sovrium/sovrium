/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Resolve a user's group memberships.
 *
 * Sovrium "groups" (`app.auth.groups[]`) are materialised as Better Auth
 * "teams" inside the single per-app organization. A user belongs to a group
 * when a `team_member` row links their `user.id` to the group's `team.id`.
 *
 * Table permissions can reference a group with the `group:<name>` prefix
 * (e.g. `create: ['admin', 'group:marketing']`). Permission evaluation
 * follows most-permissive-wins: a user is granted access when their role OR
 * any of their groups passes the table-level permission gate.
 *
 * Table reads go through `AuthRepository.getUserGroups`; this module exposes a
 * Promise-returning wrapper because the permission middleware needs a plain
 * async lookup with no HTTP request context. Mirrors the sibling
 * `user-role.ts`, which wraps `AuthRepository.getUserRole` the same way.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { toGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import { AuthRepositoryLive } from '@/infrastructure/database/repositories/auth/auth-repository-live'

/** Service shape for direct injection (used by tests to bypass real DB). */
export type UserGroupsService = {
  readonly getUserGroups: (userId: string) => Promise<readonly string[]>
}

/**
 * Resolve the names of every group the given user belongs to.
 *
 * Returns a bare list of group names (NOT `group:`-prefixed). An empty array
 * is returned when the user belongs to no groups, or when the team tables do
 * not exist (auth not configured) — a best-effort lookup that never throws.
 *
 * @param userId - Better Auth `user.id`
 * @param service - Optional direct service injection (for unit tests).
 */
export async function getUserGroups(
  userId: string,
  service?: UserGroupsService
): Promise<readonly string[]> {
  if (service) {
    return service.getUserGroups(userId)
  }

  const program = Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.getUserGroups(userId)
  }).pipe(
    Effect.provide(AuthRepositoryLive),
    // Team tables absent (auth not configured) — no group memberships. Kept as a
    // total Effect so this helper never throws into the permission gate.
    Effect.orElseSucceed(() => [] as readonly string[])
  )

  return Effect.runPromise(program)
}

/**
 * Build the set of effective roles for a user: their global role plus a
 * `group:<name>` entry for every group they belong to.
 *
 * This list is what table-permission evaluation iterates over so that a
 * permission of `['admin', 'group:marketing']` is satisfied by either the
 * role `admin` or membership in the `marketing` group.
 *
 * @param userRole - Better Auth global role (e.g. `member`, `admin`)
 * @param groupNames - Group names the user belongs to (un-prefixed)
 */
export function buildEffectiveRoles(
  userRole: string,
  groupNames: readonly string[]
): readonly string[] {
  const groupRoles = groupNames.map(toGroupReference)
  return [userRole, ...groupRoles]
}
