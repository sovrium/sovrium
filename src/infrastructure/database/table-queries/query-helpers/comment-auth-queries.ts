/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { DatabaseError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { recordComments as recordCommentsPg } from '@/infrastructure/database/drizzle/schema/record-comments'
import { recordComments as recordCommentsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/record-comments'
import { activeCommentById } from './comment-query-predicates'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

const recordComments = resolveDialectSchema(recordCommentsPg, recordCommentsSqlite)

/** A comment's moderation status, as the column stores it. */
type CommentStatus = 'approved' | 'pending' | 'rejected'

/**
 * Get comment by ID for authorization check: who wrote it, where, and its
 * moderation status — what a delete decides on and announces.
 */
export function getCommentForAuth(config: {
  readonly session: Readonly<Session>
  readonly commentId: string
}): Effect.Effect<
  | {
      readonly id: string
      readonly userId: string | null
      readonly recordId: string
      readonly tableId: string
      readonly status: CommentStatus
    }
  | undefined,
  DatabaseError
> {
  const { commentId } = config
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: recordComments.id,
            userId: recordComments.userId,
            recordId: recordComments.recordId,
            tableId: recordComments.tableId,
            status: recordComments.status,
          })
          .from(recordComments)
          .where(activeCommentById(commentId))
          .limit(1),
      catch: (error) => new DatabaseError('Failed to get comment', error),
    })
    const [row] = result
    return row === undefined ? undefined : { ...row, status: row.status as CommentStatus }
  })
}
