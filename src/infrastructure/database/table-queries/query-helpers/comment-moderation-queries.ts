/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '@/infrastructure/database/drizzle'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { recordComments as recordCommentsPg } from '@/infrastructure/database/drizzle/schema/record-comments'
import { recordComments as recordCommentsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/record-comments'
import { wrapDatabaseError } from '../shared/error-handling'
import { approvedGuestCommentByEmail } from './comment-query-predicates'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { DatabaseError } from '@/infrastructure/database'


const recordComments = resolveDialectSchema(recordCommentsPg, recordCommentsSqlite)

export function hasApprovedGuestComment(config: {
  readonly session: Readonly<Session>
  readonly tableId: string
  readonly guestEmail: string
}): Effect.Effect<boolean, DatabaseError> {
  const { tableId, guestEmail } = config
  return Effect.tryPromise({
    try: async () => {
      const rows = await db
        .select({ one: sql<number>`1` })
        .from(recordComments)
        .where(approvedGuestCommentByEmail(tableId, guestEmail))
        .limit(1)
      return rows.length > 0
    },
    catch: wrapDatabaseError('Failed to check prior approved guest comment'),
  })
}
