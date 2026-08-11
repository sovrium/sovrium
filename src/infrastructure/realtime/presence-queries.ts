/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Presence user-metadata lookup.
 *
 * A presence entry carries the user's display name and
 * optional avatar URL. The presence SSE handler resolves these from the
 * Better Auth `user` table by id before broadcasting the `join` event.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/infrastructure/database/drizzle'
import { authUsersTable } from '@/infrastructure/database/drizzle/dialect-schema'

/** Display metadata for a presence entry. */
export interface PresenceUserMetadata {
  readonly name: string
  readonly avatarUrl: string | undefined
}

/**
 * Resolve a user's display name and avatar URL for a presence entry.
 *
 * Returns a fallback name (`'User'`) when the row is missing or has no name —
 * presence rendering must never blank-out a connected colleague.
 */
export const resolvePresenceUser = async (userId: string): Promise<PresenceUserMetadata> => {
  try {
    const users = authUsersTable()
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
    // A presence entry with a fallback name is far better than failing the
    // whole SSE connection because the user lookup tripped.
    return { name: 'User', avatarUrl: undefined }
  }
}
