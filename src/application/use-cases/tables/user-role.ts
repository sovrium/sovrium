/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { eq } from 'drizzle-orm'
import { users as authUsers } from '@/infrastructure/auth/better-auth/schema'

// Constants
const DEFAULT_ROLE = 'member'

/**
 * Retrieves the user's global role from the database
 *
 * Uses Drizzle ORM for type-safe, parameterized queries (SQL injection safe).
 *
 * Role resolution:
 * 1. Fetch global user role from users table
 * 2. Default: 'member'
 */
export async function getUserRole(userId: string): Promise<string> {
  const { db } = await import('@/infrastructure/database')

  // Fetch global user role from users table
  const userResult = await db
    .select({ role: authUsers.role })
    .from(authUsers)
    .where(eq(authUsers.id, userId))
    .limit(1)

  return userResult[0]?.role || DEFAULT_ROLE
}
