/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { eq } from 'drizzle-orm'
import { toGroupReference } from '@/domain/models/app/auth/groups/group-reference'
import { db } from '@/infrastructure/database'
import {
  authTeamMembersTable,
  authTeamsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'

export type UserGroupsService = {
  readonly getUserGroups: (userId: string) => Promise<readonly string[]>
}

export async function getUserGroups(
  userId: string,
  service?: UserGroupsService
): Promise<readonly string[]> {
  if (service) {
    return service.getUserGroups(userId)
  }

  const teams = authTeamsTable()
  const teamMembers = authTeamMembersTable()
  try {
    const rows = await db
      .select({ name: teams.name })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId))

    return rows.map((row) => row.name)
  } catch {
    return []
  }
}

export function buildEffectiveRoles(
  userRole: string,
  groupNames: readonly string[]
): readonly string[] {
  const groupRoles = groupNames.map(toGroupReference)
  return [userRole, ...groupRoles]
}
