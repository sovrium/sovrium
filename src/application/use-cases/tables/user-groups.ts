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
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import { toGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import { effectiveRolesOnTable } from '@/domain/models/app/tables/caller-record-gate-service'
import { logError } from '@/infrastructure/logging/logger'

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
 * Every `user_access` role the user holds — the overlay the records route adds
 * to the table-level gate of a table with row-level rules.
 *
 * FAILING CLOSED ON ERROR IS DELIBERATE: with no `user_access` roles the
 * overlay contributes nothing, so the table-level gate sees only the account
 * role and groups, and a user whose access DEPENDS on an assignment role is
 * denied. Do not make this permissive — that would turn a lookup fault into an
 * authorization bypass. The repository already answers an empty list for the
 * one expected condition (no `user_access` table yet), so reaching the catch
 * means an unexpected fault, logged so a legitimately-granted user is never
 * denied without a trace.
 */
export const getUserAccessRoles = (
  userId: string
): Effect.Effect<readonly string[], never, DataSourceRepository> =>
  Effect.gen(function* () {
    const repo = yield* DataSourceRepository
    return yield* repo.fetchUserAccessRoles(userId).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          logError(
            '[PERMISSIONS] user_access role lookup failed; proceeding without the role overlay',
            cause,
            { userId }
          )
        )
      ),
      // effect-swallow: failing closed — without the overlay only the account role and groups grant, so a lookup fault can only NARROW access.
      Effect.orElseSucceed(() => [] as readonly string[])
    )
  }).pipe(Effect.withSpan('tables.get-user-access-roles'))

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

/** Who asks a table-level gate: an account role, its groups and its assignment roles. */
export type TableGateCaller = Readonly<{
  role: string
  /** Group names the caller belongs to (un-prefixed). */
  groups: readonly string[]
  /** Every `user_access` role the caller holds; counted only under row-level rules. */
  accessRoles?: readonly string[]
}>

/**
 * The ONE set of effective roles every table-level gate asks of a caller: her
 * account role (always first), a `group:<name>` entry per group she belongs to,
 * and — on a table with row-level rules, and only there — every role her
 * assignments (`user_access`) give her.
 *
 * The records route builds exactly this set, so a gate that asks it admits
 * exactly whom the records admit: the permission map, the upsert, the comment
 * routes, the MCP tools, the batch routes, restore, the delete form and the
 * record button. Groups and assignments are whatever was resolved for THIS
 * request — nothing is cached, so a withdrawn membership or assignment counts
 * no more on the next request.
 */
export function tableEffectiveRoles(
  table: Readonly<{ rowLevelPermissions?: unknown }> | undefined,
  caller: TableGateCaller
): readonly string[] {
  return effectiveRolesOnTable(table, caller)
}
