/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Change the groups an account belongs to — the ONE program behind every door
 * that does it by group name: the console's `PUT /api/admin/users/:userId/groups`
 * (a whole set) and the `auth/addToGroup` / `auth/removeFromGroup` automation
 * operators (one group each).
 *
 * A group is a team inside the instance's one organization, stored through
 * {@link OrganizationTeamRepository}; the team is resolved from the group's
 * NAME and the organization is never asked of the caller. Permission
 * resolution reads team membership per request, so a change is seen on the
 * account's next request.
 *
 * The program is all or nothing: every named group must be declared before
 * anything is written, and the write itself is one transaction in which every
 * group it adds must have room under its `maxMembers` — checked under a lock,
 * so two concurrent adds cannot share the last seat — so a refused change
 * moves nothing. A change
 * that moved something is recorded once on the admin trail as
 * `user.groups.changed`; a change that moved nothing records nothing.
 */

import { Effect } from 'effect'
import {
  OrganizationTeamRepository,
  type OrganizationTeamDatabaseError,
} from '@/application/ports/repositories/auth/organization-team-repository'
import {
  recordGroupsChange,
  type UserActAuthor,
} from '@/application/use-cases/auth/record-user-acts'
import {
  firstUndeclaredGroup,
  groupMemberCap,
  planMembershipDiff,
  type GroupMembershipConfig,
  type GroupMembershipDiff,
  type GroupMembershipPlan,
} from '@/domain/models/app/auth/groups/group-membership-service'
import type { AuditLogRepository } from '@/application/ports/repositories/admin/audit-log-repository'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'

/** What a change of membership came to. */
export type GroupMembershipOutcome =
  | ({ readonly _tag: 'Changed' } & GroupMembershipDiff)
  /** A named group is not declared in `auth.groups`. */
  | { readonly _tag: 'Undeclared'; readonly group: string }
  /** A group to add already holds its `maxMembers`. */
  | { readonly _tag: 'AtCapacity'; readonly group: string; readonly maxMembers: number }
  /** A declared group has no team behind it (its startup seeding did not run). */
  | { readonly _tag: 'Unstored'; readonly group: string }

/** The human sentence for a refused change, naming the group it is about. */
export const describeMembershipRefusal = (
  outcome: Exclude<GroupMembershipOutcome, { readonly _tag: 'Changed' }>
): string => {
  if (outcome._tag === 'Undeclared') {
    return `group '${outcome.group}' is not declared in auth.groups`
  }
  if (outcome._tag === 'AtCapacity') {
    return `group '${outcome.group}' has reached its maximum of ${outcome.maxMembers} members`
  }
  return `group '${outcome.group}' has no stored team yet`
}

/**
 * Apply a membership plan to one account, which the caller has already
 * confirmed exists.
 */
export const changeUserGroups = (input: {
  readonly app: GroupMembershipConfig
  readonly userId: string
  readonly plan: GroupMembershipPlan
  readonly author: UserActAuthor
}): Effect.Effect<
  GroupMembershipOutcome,
  OrganizationTeamDatabaseError,
  OrganizationTeamRepository | AuthRepository | AuditLogRepository
> =>
  Effect.gen(function* () {
    const { app, userId, plan, author } = input
    const undeclared = firstUndeclaredGroup(app, plan)
    if (undeclared !== undefined) return { _tag: 'Undeclared', group: undeclared } as const

    const repository = yield* OrganizationTeamRepository
    const teams = yield* repository.listTeams
    const teamIds = new Map(teams.map((team) => [team.name, team.id] as const))
    const held = (yield* repository.listUserMemberships(userId)).map((row) => row.teamName)
    const diff = planMembershipDiff(held, plan)

    const unstored = diff.added.find((group) => !teamIds.has(group))
    if (unstored !== undefined) return { _tag: 'Unstored', group: unstored } as const
    // Every refusal the config can decide has been decided; the cap is decided
    // by the store, under a lock and inside the same transaction as the write,
    // so a full group rolls the whole change back. A group the account holds
    // is one whose team exists, so `removed` always resolves.
    const written = yield* repository.applyMembershipChange({
      userId,
      removeTeamIds: diff.removed.map((group) => teamIds.get(group) ?? ''),
      add: diff.added.map((group) => ({
        teamId: teamIds.get(group) ?? '',
        maxMembers: groupMemberCap(app, group),
      })),
    })
    if (written._tag === 'AtCapacity') {
      const group = diff.added.find((name) => teamIds.get(name) === written.teamId) ?? ''
      return { _tag: 'AtCapacity', group, maxMembers: groupMemberCap(app, group) ?? 0 } as const
    }

    if (diff.added.length > 0 || diff.removed.length > 0) {
      yield* recordGroupsChange({ author, userId, added: diff.added, removed: diff.removed })
    }
    return { _tag: 'Changed', ...diff } as const
  }).pipe(Effect.withSpan('auth.change-user-groups'))
