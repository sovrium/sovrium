/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq, and } from 'drizzle-orm'
import {
  users as authUsers,
  members as authMembers,
} from '@/infrastructure/auth/better-auth/schema'

// Constants
const DEFAULT_ROLE = 'member'

/**
 * Retrieves the user's role from the database
 *
 * Uses Drizzle ORM for type-safe, parameterized queries (SQL injection safe).
 *
 * Role resolution priority:
 * 1. If active organization: check members table for org-specific role
 * 2. If no active organization or no membership: check global user role from users table
 * 3. Default: 'member'
 */
export async function getUserRole(
  userId: string,
  activeOrganizationId?: string | null
): Promise<string> {
  const { db } = await import('@/infrastructure/database')

  // If active organization, check members table first
  if (activeOrganizationId) {
    const memberResult = await db
      .select({ role: authMembers.role })
      .from(authMembers)
      .where(
        and(eq(authMembers.organizationId, activeOrganizationId), eq(authMembers.userId, userId))
      )
      .limit(1)

    if (memberResult[0]?.role) {
      return memberResult[0].role
    }
  }

  // Fall back to global user role from users table
  const userResult = await db
    .select({ role: authUsers.role })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .limit(1)

  return userResult[0]?.role || DEFAULT_ROLE
}
