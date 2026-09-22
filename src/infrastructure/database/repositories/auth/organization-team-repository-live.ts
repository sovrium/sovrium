/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, count, eq } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  OrganizationTeamDatabaseError,
  OrganizationTeamRepository,
} from '@/application/ports/repositories/auth/organization-team-repository'
import { SOVRIUM_ORGANIZATION_ID } from '@/infrastructure/auth/better-auth/org-team-seeder'
import { db } from '@/infrastructure/database'
import {
  authMembersTable,
  authTeamMembersTable,
  authTeamsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

/** Wrap a DB promise, adapting failures to `OrganizationTeamDatabaseError`. */
const wrap = makeDbWrap((cause) => new OrganizationTeamDatabaseError({ cause }))

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
export const OrganizationTeamRepositoryLive = Layer.succeed(OrganizationTeamRepository, {
  findTeamById: (teamId: string) =>
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

  findOrganizationRole: (userId: string) =>
    wrap(async () => {
      const members = authMembersTable()
      const rows = await db
        .select({ role: members.role })
        .from(members)
        .where(and(eq(members.userId, userId), eq(members.organizationId, SOVRIUM_ORGANIZATION_ID)))
        .limit(1)
      return rows[0]?.role ?? undefined
    }),

  listAllTeamMemberships: wrap(() => {
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

  listTeamMembers: (teamId: string) =>
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

  countTeamMembers: (teamId: string) =>
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

  isTeamMember: (teamId: string, userId: string) =>
    wrap(async () => {
      const teamMembers = authTeamMembersTable()
      const rows = await db
        .select({ id: teamMembers.id })
        .from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
        .limit(1)
      return rows.length > 0
    }),
})
