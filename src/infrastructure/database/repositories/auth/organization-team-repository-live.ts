/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, count, eq, gte, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import {
  OrganizationTeamDatabaseError,
  OrganizationTeamRepository,
} from '@/application/ports/repositories/auth/organization-team-repository'
import { SOVRIUM_ORGANIZATION_ID } from '@/infrastructure/auth/better-auth/org-team-seeder'
import { type PortableTx } from '@/infrastructure/database'
import {
  authMembersTable,
  authTeamMembersTable,
  authTeamsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import {
  layerOverDatabase,
  type MembersOverDatabase,
} from '@/infrastructure/database/drizzle/layer'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { withPromiseTransaction } from '@/infrastructure/database/transaction'

/** Wrap a DB promise, adapting failures to `OrganizationTeamDatabaseError`. */
const toError = (cause: unknown) => new OrganizationTeamDatabaseError({ cause })
const wrap = makeDbWrap(toError)

/**
 * The `team_member.membership_key` Better Auth writes for a (team, user) pair:
 * the unpadded base64url SHA-256 of `JSON.stringify([teamId, userId])`.
 *
 * Written identically here so a link this repository makes is the one the
 * native `add-team-member` route finds when it looks the pair up by key — two
 * spellings of the key would let the two doors create the same membership
 * twice.
 */
const membershipKeyOf = async (teamId: string, userId: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify([teamId, userId]))
  )
  return Buffer.from(digest).toString('base64url')
}

/** The link rows for one (team, user) pair, as a predicate. */
const linkOf = (teamId: string, userId: string) => {
  const teamMembers = authTeamMembersTable()
  return and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId))
}

/** Thrown inside the membership transaction to roll it back on a full team. */
class TeamAtCapacity {
  constructor(readonly teamId: string) {}
}

/**
 * Unlink one (team, user) pair on the transaction, the team's `member_count`
 * moving with the row.
 */
const unlinkMember = async (
  tx: Readonly<PortableTx>,
  teamId: string,
  userId: string
): Promise<void> => {
  const teamMembers = authTeamMembersTable()
  const teams = authTeamsTable()
  const removed = await tx
    .delete(teamMembers)
    .where(linkOf(teamId, userId))
    .returning({ id: teamMembers.id })
  if (removed.length === 0) return
  await tx
    .update(teams)
    .set({ memberCount: sql`${teams.memberCount} - ${removed.length}` })
    .where(and(eq(teams.id, teamId), gte(teams.memberCount, removed.length)))
}

/**
 * Link one (team, user) pair on the transaction, as the native route links it:
 * the same membership key, and `member_count` moving with the row.
 *
 * A capped team is checked under a lock on its row. The no-op UPDATE takes
 * that lock on PostgreSQL (SQLite serialises whole transactions already), and
 * the count is a NEW statement after it, so it sees every link a concurrent
 * add committed before the lock was granted — the last seat cannot be taken
 * twice.
 */
const linkMember = async (
  tx: Readonly<PortableTx>,
  entry: { readonly teamId: string; readonly maxMembers?: number | undefined },
  userId: string
): Promise<void> => {
  const teamMembers = authTeamMembersTable()
  const teams = authTeamsTable()
  const { teamId, maxMembers } = entry
  const existing = await tx
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(linkOf(teamId, userId))
    .limit(1)
  if (existing.length > 0) return
  if (maxMembers !== undefined) {
    await tx
      .update(teams)
      .set({ memberCount: sql`${teams.memberCount}` })
      .where(eq(teams.id, teamId))
    const rows = await tx
      .select({ value: count() })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId))
    if (Number(rows[0]?.value ?? 0) >= maxMembers) throw new TeamAtCapacity(teamId)
  }
  const inserted = await tx
    .insert(teamMembers)
    .values({
      id: crypto.randomUUID(),
      teamId,
      userId,
      membershipKey: await membershipKeyOf(teamId, userId),
      createdAt: new Date(),
    })
    // The same pair linked by another door lands on the unique key: that link
    // is the one that happened, and this one changed nothing.
    .onConflictDoNothing()
    .returning({ id: teamMembers.id })
  if (inserted.length === 0) return
  await tx
    .update(teams)
    .set({ memberCount: sql`${teams.memberCount} + 1` })
    .where(eq(teams.id, teamId))
}

/**
 * Drizzle implementation of the organization / team read port.
 *
 * `SOVRIUM_ORGANIZATION_ID` is imported HERE and nowhere above this line — that
 * is the whole shape of the port. The seeder module that defines it also writes
 * the organization row, so it legitimately holds a `db` handle; keeping the
 * constant's only reader inside infrastructure is what stops a route from
 * needing a seeder in its import graph to know which tenant it is serving.
 *
 * Tables resolve per dialect (`authTeamsTable()` and friends), so a query
 * targets `auth.team` on PostgreSQL and the flat `auth_team` on SQLite.
 */
const members: MembersOverDatabase<typeof OrganizationTeamRepository> = {
  findTeamById: (db) => (teamId: string) =>
    wrap(async () => {
      const teams = authTeamsTable()
      const rows = await db
        .select()
        .from(teams)
        // Scoped to THIS organization in the predicate rather than checked
        // afterwards: a cross-organization row never leaves this function, so
        // no caller can hold one and forget to compare.
        .where(and(eq(teams.id, teamId), eq(teams.organizationId, SOVRIUM_ORGANIZATION_ID)))
        .limit(1)
      return rows[0]
    }),

  findOrganizationRole: (db) => (userId: string) =>
    wrap(async () => {
      const members = authMembersTable()
      const rows = await db
        .select({ role: members.role })
        .from(members)
        .where(and(eq(members.userId, userId), eq(members.organizationId, SOVRIUM_ORGANIZATION_ID)))
        .limit(1)
      return rows[0]?.role ?? undefined
    }),

  listAllTeamMemberships: (db) =>
    wrap(() => {
      const teamMembers = authTeamMembersTable()
      const teams = authTeamsTable()
      // ONE join, and the organization predicate rides on it rather than on a
      // second read: the team side is what carries `organization_id`, so joining
      // is both how the name is resolved and how the tenant is scoped.
      return db
        .select({
          teamId: teamMembers.teamId,
          teamName: teams.name,
          userId: teamMembers.userId,
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(eq(teams.organizationId, SOVRIUM_ORGANIZATION_ID))
    }),

  listTeamMembers: (db) => (teamId: string) =>
    wrap(() => {
      const teamMembers = authTeamMembersTable()
      return db
        .select({
          id: teamMembers.id,
          teamId: teamMembers.teamId,
          userId: teamMembers.userId,
          createdAt: teamMembers.createdAt,
        })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId))
    }),

  countTeamMembers: (db) => (teamId: string) =>
    wrap(async () => {
      const teamMembers = authTeamMembersTable()
      const rows = await db
        .select({ value: count() })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId))
      // `Number(undefined ?? 0)` is 0, not NaN — the nullish coalescing runs
      // BEFORE the coercion. Written this way round deliberately: the inverse
      // (`Number(x) ?? 0`) yields NaN for a missing row, which survives every
      // downstream check as a successful value and fails at the response
      // encoder instead of here.
      return Number(rows[0]?.value ?? 0)
    }),

  isTeamMember: (db) => (teamId: string, userId: string) =>
    wrap(async () => {
      const teamMembers = authTeamMembersTable()
      const rows = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .limit(1)
      return rows.length > 0
    }),

  listTeams: (db) =>
    wrap(() => {
      const teams = authTeamsTable()
      return db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(eq(teams.organizationId, SOVRIUM_ORGANIZATION_ID))
    }),

  listUserMemberships: (db) => (userId: string) =>
    wrap(() => {
      const teamMembers = authTeamMembersTable()
      const teams = authTeamsTable()
      return db
        .select({
          teamId: teamMembers.teamId,
          teamName: teams.name,
          userId: teamMembers.userId,
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(
          and(eq(teamMembers.userId, userId), eq(teams.organizationId, SOVRIUM_ORGANIZATION_ID))
        )
    }),

  applyMembershipChange:
    (db) =>
    ({ userId, removeTeamIds, add }) =>
      withPromiseTransaction(
        db,
        async (tx) => {
          await removeTeamIds.reduce<Promise<void>>(async (previous, teamId) => {
            await previous
            await unlinkMember(tx, teamId, userId)
          }, Promise.resolve())
          await add.reduce<Promise<void>>(async (previous, entry) => {
            await previous
            await linkMember(tx, entry, userId)
          }, Promise.resolve())
          return { _tag: 'Applied' } as const
        },
        // The full team rolled the whole change back; that is an answer, not a
        // failure of the store, so it is kept apart from the store's error.
        (error) => (error instanceof TeamAtCapacity ? error : toError(error))
      ).pipe(
        Effect.catchIf(
          (error): error is TeamAtCapacity => error instanceof TeamAtCapacity,
          (full) => Effect.succeed({ _tag: 'AtCapacity', teamId: full.teamId } as const)
        )
      ),
}

export const OrganizationTeamRepositoryLive = layerOverDatabase(OrganizationTeamRepository, members)
