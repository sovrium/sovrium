/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { eq } from 'drizzle-orm'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database/drizzle'

export interface PresenceUserMetadata {
  readonly name: string
  readonly avatarUrl: string | undefined
}

export const resolvePresenceUser = async (userId: string): Promise<PresenceUserMetadata> => {
  try {
    const rows = await db
      .select({ name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const row = rows[0]
    return {
      name: row?.name && row.name.length > 0 ? row.name : 'User',
      avatarUrl: row?.image ?? undefined,
    }
  } catch {
    return { name: 'User', avatarUrl: undefined }
  }
}
