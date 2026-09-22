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
 * Table reads go through `AuthRepository.getUserGroups`. The lookup DECLARES
 * that repository rather than binding one (standing rule E1); the permission
 * middleware runs it on the request's own services. Mirrors the sibling
 * `user-role.ts`, which reads `AuthRepository.getUserRole` the same way.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { toGroupReference } from '@/domain/models/app/auth/groups/group-reference'

/**
 * Resolve the names of every group the given user belongs to.
 *
 * Yields a bare list of group names (NOT `group:`-prefixed). An empty array is
 * returned when the user belongs to no groups, or when the team tables do not
 * exist (auth not configured) — a best-effort lookup that cannot fail.
 *
 * @param userId - Better Auth `user.id`
 */
export const getUserGroups = (
  userId: string
): Effect.Effect<readonly string[], never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.getUserGroups(userId)
  }).pipe(
    // effect-swallow: team tables absent (auth not configured) is the ordinary case, not an incident — it means "no group memberships", and keeping it total stops a missing table failing the permission gate open OR closed by accident.
    Effect.orElseSucceed(() => [] as readonly string[]),
    Effect.withSpan('tables.get-user-groups')
  )

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
