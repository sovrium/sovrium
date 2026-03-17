/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { UserMetadataWithOptionalImage } from '@/application/ports/models/user-metadata'

/**
 * Row shape from a LEFT JOIN on the users table
 *
 * Fields are nullable because LEFT JOIN returns NULL when no user matches.
 */
export interface UserJoinRow {
  readonly userId: string | null | undefined
  readonly userName: string | null | undefined
  readonly userEmail: string | null | undefined
  readonly userImage: string | null | undefined
}

/**
 * Extract user metadata from a LEFT JOIN row
 *
 * Returns undefined when required fields (userId, userName, userEmail) are missing,
 * which happens when the LEFT JOIN finds no matching user.
 */
export function extractUserFromRow(row: UserJoinRow): UserMetadataWithOptionalImage | undefined {
  if (row.userId && row.userName && row.userEmail) {
    return {
      id: row.userId,
      name: row.userName,
      email: row.userEmail,
      image: row.userImage ?? undefined,
    }
  }
  return undefined
}
