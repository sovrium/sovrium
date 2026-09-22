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
import { wrapDatabaseError } from '../statement/error-handling'
import { approvedGuestCommentByEmail } from './comment-query-predicates'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { DatabaseError } from '@/infrastructure/database'

/**
 * Moderation-policy lookups for the comment-create gate (PG-02).
 *
 * Kept beside `comment-queries.ts` rather than inside it — mirroring
 * `comment-read-state-queries.ts` and `comment-author-email-queries.ts` — so the
 * general comment CRUD module stays under the 400-line cap and the moderation
 * inputs live with the policy they feed.
 */

const recordComments = resolveDialectSchema(recordCommentsPg, recordCommentsSqlite)

/**
 * `true` when the given guest email already has an approved comment on this
 * table — the `autoApprove.previouslyApproved` precondition
 *. See {@link approvedGuestCommentByEmail} for
 * why the match is scoped per-table.
 *
 * An existence probe (`SELECT 1 ... LIMIT 1`), deliberately NOT a count: the
 * caller only needs the boolean, and both engines can stop at the first
 * matching row instead of walking every prior approval. The result is handed to
 * the moderation policy as `priorApprovedCommentExists`, which keeps that helper
 * pure and synchronous.
 */
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
