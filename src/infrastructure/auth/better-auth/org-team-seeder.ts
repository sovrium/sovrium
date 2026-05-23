/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database'
import {
  authMembersTable,
  authOrganizationsTable,
  authTeamsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { logDebug } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'

export const SOVRIUM_ORGANIZATION_ID = 'sovrium-org'
export const SOVRIUM_ORGANIZATION_SLUG = 'sovrium'

const generateId = (): string => crypto.randomUUID()

export const ensureOrganization = async (appName: string): Promise<string> => {
  const organizations = authOrganizationsTable()
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, SOVRIUM_ORGANIZATION_ID))
    .limit(1)

  if (existing.length > 0) return SOVRIUM_ORGANIZATION_ID

  await db
    .insert(organizations)
    .values({
      id: SOVRIUM_ORGANIZATION_ID,
      name: appName,
      slug: SOVRIUM_ORGANIZATION_SLUG,
      createdAt: new Date(),
    })
    .onConflictDoNothing()

  logDebug(`[org-team-seeder] Organization "${appName}" ensured`)
  return SOVRIUM_ORGANIZATION_ID
}

export const ensureTeamsFromGroups = async (groupNames: readonly string[]): Promise<void> => {
  if (groupNames.length === 0) return

  const teams = authTeamsTable()
  const existing = await db
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.organizationId, SOVRIUM_ORGANIZATION_ID))

  const existingNames = new Set(existing.map((team) => team.name))
  const missing = groupNames.filter((name) => !existingNames.has(name))

  if (missing.length === 0) return

  const now = new Date()
  await db
    .insert(teams)
    .values(
      missing.map((name) => ({
        id: generateId(),
        name,
        organizationId: SOVRIUM_ORGANIZATION_ID,
        createdAt: now,
        updatedAt: now,
      }))
    )
    .onConflictDoNothing()

  logDebug(`[org-team-seeder] Teams ensured: ${missing.join(', ')}`)
}

export const ensureMembership = async (userId: string): Promise<void> => {
  const members = authMembersTable()
  const alreadyMember = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1)

  if (alreadyMember.length > 0) return

  const memberCount = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.organizationId, SOVRIUM_ORGANIZATION_ID))

  const role = memberCount.length === 0 ? 'owner' : 'member'

  await db
    .insert(members)
    .values({
      id: generateId(),
      organizationId: SOVRIUM_ORGANIZATION_ID,
      userId,
      role,
      createdAt: new Date(),
    })
    .onConflictDoNothing()

  logDebug(`[org-team-seeder] Membership ensured for ${userId} as ${role}`)
}

export const runOrgTeamSeeding = async (app: App): Promise<void> => {
  if (!app.auth) return

  try {
    await ensureOrganization(app.name)
    await ensureTeamsFromGroups((app.auth.groups ?? []).map((group) => group.name))
  } catch (error) {
    logDebug(`[org-team-seeder] Seeding skipped (non-fatal): ${String(error)}`)
  }
}
