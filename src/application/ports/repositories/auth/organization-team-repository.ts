/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'

/** Database error for reads against the organization / team membership tables. */
export class OrganizationTeamDatabaseError extends Data.TaggedError(
  'OrganizationTeamDatabaseError'
)<{
  readonly cause: unknown
}> {}

/**
 * One Better Auth `team` row, scoped to this instance's single organization.
 *
 * Every field the group-management response carries, and no more. It is a
 * response shape as much as a record: `handleGetTeam` serialises it straight to
 * the client, so adding a column here publishes it.
 */
export interface OrganizationTeamRecord {
  readonly id: string
  readonly name: string
  readonly organizationId: string
  readonly memberCount: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * One `team_member` link row, as the roster response carries it.
 *
 * `createdAt` is NULLABLE, and that is the column rather than an oversight:
 * Better Auth's `team_member` table declares no default for it, so a row the
 * plugin wrote through a path that omits it carries `null`. The roster response
 * has always serialised whatever was there, so widening it here would be a
 * behaviour change dressed as a type fix.
 */
export interface OrganizationTeamMemberRecord {
  readonly id: string
  readonly teamId: string
  readonly userId: string
  readonly createdAt: Date | null
}

/**
 * One membership, flattened across `team_member` × `team`.
 *
 * Carries the team NAME beside the two ids because the only consumer that needs
 * every membership at once — the console's access graph — draws teams by name,
 * and resolving that name per row would reintroduce exactly the per-team read
 * this projection exists to remove.
 *
 * No `createdAt`: nothing renders when a membership began, and a column nobody
 * reads is a column a later reader will assume means something.
 */
export interface OrganizationTeamMembershipRecord {
  readonly teamId: string
  readonly teamName: string
  readonly userId: string
}

/**
 * Read port over Better Auth's organization / team membership tables, scoped to
 * THIS instance's single organization.
 *
 * ### The scoping is the port's main job
 *
 * Sovrium runs "1 app = 1 organization": every team and every membership row
 * belongs to one fixed organization id, and every read has to say so or it
 * reads another tenant's rows. Before this port existed the route file imported
 * that id — `SOVRIUM_ORGANIZATION_ID` — from `org-team-seeder.ts`, a module that
 * holds a live `db` handle and writes rows. So a route needed a seeder in its
 * import graph to know which organization it was in, and the scoping predicate
 * was re-spelled at each of the four call sites that needed it.
 *
 * Here the scoping is a CONTRACT rather than an argument. No method takes an
 * organization id, none can be called with the wrong one, and the constant
 * stays inside infrastructure where its writer lives. A caller that forgets to
 * scope a query is not a bug you can write against this interface.
 *
 * ### Why a read port and not a team service
 *
 * Better Auth's `organization` plugin owns every WRITE — create team, add
 * member, remove member — and Sovrium forwards to it rather than
 * re-implementing it. What these reads back is the thin layer Sovrium adds on
 * top of endpoints upstream scopes more tightly than the product does: an
 * organization owner may list any team's roster, a repeat add is an error
 * rather than a silent no-op, and a group may declare a `maxMembers` cap
 * upstream has no concept of.
 */
export class OrganizationTeamRepository extends Context.Service<
  OrganizationTeamRepository,
  {
    /**
     * The team bearing this id, or `undefined` when no such team exists IN THIS
     * ORGANIZATION.
     *
     * A team belonging to another organization reads as a miss rather than as a
     * forbidden row — the caller answers 404 either way, and collapsing the two
     * here means no caller can accidentally answer 403 and confirm the id
     * exists (standing rule S1, anti-enumeration).
     */
    readonly findTeamById: (
      teamId: string
    ) => Effect.Effect<OrganizationTeamRecord | undefined, OrganizationTeamDatabaseError>

    /**
     * This user's role in the organization, or `undefined` when they are not a
     * member of it.
     *
     * NOTE: this is Better Auth's ORGANIZATION role namespace (`owner`,
     * `admin`, `member`), NOT Sovrium's RBAC role. The two share spellings and
     * mean different things; callers that compare against an admin literal are
     * using the literal, not the semantics.
     */
    readonly findOrganizationRole: (
      userId: string
    ) => Effect.Effect<string | undefined, OrganizationTeamDatabaseError>

    /**
     * EVERY membership in this organization, in ONE join over
     * `team_member` × `team`.
     *
     * The sibling {@link listTeamMembers} answers the same question one team at
     * a time, which is the right shape for a roster page and the wrong one for
     * any caller that needs the whole picture: resolving an instance's access
     * graph that way costs one query per team, and the cost grows with the
     * configuration rather than staying flat. This method exists so that read
     * can state a query bound that does not move when the instance gains a
     * team, a member or an account.
     *
     * Scoped to THIS organization by the join predicate, like every other read
     * on this port — a membership whose team belongs to another organization
     * never leaves this function.
     */
    readonly listAllTeamMemberships: Effect.Effect<
      ReadonlyArray<OrganizationTeamMembershipRecord>,
      OrganizationTeamDatabaseError
    >

    /** Every `team_member` row for this team. */
    readonly listTeamMembers: (
      teamId: string
    ) => Effect.Effect<ReadonlyArray<OrganizationTeamMemberRecord>, OrganizationTeamDatabaseError>

    /**
     * How many members this team currently has, counted from the link rows.
     *
     * Counted rather than read off `team.member_count`: the denormalised tally
     * is Better Auth's to maintain and the capacity gate must refuse an add
     * against what is actually there, not against a counter that could have
     * drifted.
     */
    readonly countTeamMembers: (
      teamId: string
    ) => Effect.Effect<number, OrganizationTeamDatabaseError>

    /** Whether a `team_member` row already links this user to this team. */
    readonly isTeamMember: (
      teamId: string,
      userId: string
    ) => Effect.Effect<boolean, OrganizationTeamDatabaseError>
  }
>()('OrganizationTeamRepository') {}
