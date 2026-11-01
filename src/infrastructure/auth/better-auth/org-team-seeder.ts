/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Organization + Team seeding for the Better Auth organization plugin.
 *
 * Sovrium follows a strict 1:1 model — every Sovrium app IS exactly one Better
 * Auth organization. The Better Auth team endpoints (`/api/auth/organization/
 * *-team*`) operate on the caller's *active organization*, so two things must
 * be true for those endpoints to work:
 *
 *  1. The single organization row exists.
 *  2. Every authenticated user is a member of it with their session's
 *     `activeOrganizationId` pointing at it.
 *
 * Sovrium "groups" (`app.auth.groups[]`) are the configuration-as-code
 * equivalent of Better Auth "teams" — each declared group is materialised as a
 * team inside the single organization at startup.
 *
 * This module writes directly to the Better Auth Drizzle tables (rather than
 * going through `auth.api`) because seeding runs before any HTTP request
 * context exists, and because the user-create hook needs a synchronous,
 * idempotent membership upsert.
 */

import { and, eq } from 'drizzle-orm'
import {
  authMembersTable,
  authOrganizationsTable,
  authTeamsTable,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { logDebug, logError } from '@/infrastructure/logging/logger'
import type { App } from '@/domain/models/app'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

/**
 * Fixed identifiers for the single per-app organization.
 *
 * Sovrium runs exactly one organization per app, so a deterministic id/slug is
 * sufficient and lets every code path (seeder, hooks) reference the same row
 * without a lookup round-trip.
 */
export const SOVRIUM_ORGANIZATION_ID = 'sovrium-org'
export const SOVRIUM_ORGANIZATION_SLUG = 'sovrium'

/**
 * Generate a random id compatible with Better Auth's text primary keys.
 */
const generateId = (): string => crypto.randomUUID()

/**
 * Ensure the single Sovrium organization row exists.
 *
 * Idempotent: a no-op when the row is already present. Returns the
 * organization id so callers can reference it without a follow-up query.
 */
export const ensureOrganization = async (db: PortableDb, appName: string): Promise<string> => {
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

/**
 * Ensure a team row exists for every declared group name.
 *
 * Idempotent: existing teams (matched by name within the organization) are
 * left untouched; only missing teams are inserted.
 */
export const ensureTeamsFromGroups = async (
  db: PortableDb,
  groupNames: readonly string[]
): Promise<void> => {
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

/**
 * Ensure the given user is a member of the single organization.
 *
 * An administrator joins as `owner` (Better Auth's highest organization role,
 * the one its team routes require); every other account joins as a plain
 * `member`, whatever the order in which accounts were created. Being the first
 * person to sign up confers nothing.
 *
 * This writes `auth_member.role` — ORGANIZATION-plugin membership, a different
 * column in a different plugin from `auth_user.role`. It confers no admin-plugin
 * privilege and no Sovrium admin-dashboard access. Who may CHANGE the
 * organisation is decided per request by `organization-admin-guard.ts`, which
 * reads the caller's account role, not this column.
 *
 * Idempotent: a no-op when a membership row already exists for the user. Two
 * concurrent calls for one user both pass the read; the unique index on
 * `(organization_id, user_id)` lets only one insert land, and the other's
 * conflict is ignored.
 */
export const ensureMembership = async (
  db: PortableDb,
  userId: string,
  isAdministrator: boolean = false
): Promise<void> => {
  const members = authMembersTable()
  const alreadyMember = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1)

  if (alreadyMember.length > 0) return

  const role = isAdministrator ? 'owner' : 'member'

  await db
    .insert(members)
    .values({
      id: generateId(),
      organizationId: SOVRIUM_ORGANIZATION_ID,
      userId,
      role,
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: [members.organizationId, members.userId] })

  logDebug(`[org-team-seeder] Membership ensured for ${userId} as ${role}`)
}

/**
 * Make an administrator the organization's `owner`, joining it first when the
 * account is not yet a member.
 *
 * An account whose role became admin after it joined (a promotion, or a role
 * set outside Better Auth) still holds the `member` row it joined with, and
 * Better Auth's team routes would refuse it. The organisation guard calls this
 * before letting an administrator's change through. Idempotent.
 */
export const ensureOwnerMembership = async (db: PortableDb, userId: string): Promise<void> => {
  const members = authMembersTable()
  const existing = await db
    .select({ id: members.id, role: members.role })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.organizationId, SOVRIUM_ORGANIZATION_ID)))
    .limit(1)

  if (existing.length === 0) {
    await ensureMembership(db, userId, true)
    return
  }
  if (existing[0]?.role === 'owner') return

  await db
    .update(members)
    .set({ role: 'owner' })
    .where(and(eq(members.userId, userId), eq(members.organizationId, SOVRIUM_ORGANIZATION_ID)))
  logDebug(`[org-team-seeder] Membership raised to owner for ${userId}`)
}

/**
 * Startup seeding entry point.
 *
 * Ensures the organization and all group-derived teams exist. A no-op when the
 * app has no auth configured. Best-effort: any failure is swallowed so a
 * transient database hiccup never blocks server startup (the same discipline
 * as the other post-schema seeders).
 */
export const runOrgTeamSeeding = async (db: PortableDb, app: App): Promise<void> => {
  if (!app.auth) return

  try {
    await ensureOrganization(db, app.name)
    await ensureTeamsFromGroups(
      db,
      (app.auth.groups ?? []).map((group) => group.name)
    )
  } catch (error) {
    logError('[org-team-seeder] seeding failed (non-fatal)', error)
  }
}
