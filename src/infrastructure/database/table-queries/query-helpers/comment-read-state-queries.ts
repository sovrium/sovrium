/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, and, eq, ne, or, gt, isNull } from 'drizzle-orm'
import { Effect } from 'effect'
import { DatabaseError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { commentReadState as commentReadStatePg } from '@/infrastructure/database/drizzle/schema/comment-read-state'
import { recordComments as recordCommentsPg } from '@/infrastructure/database/drizzle/schema/record-comments'
import { commentReadState as commentReadStateSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/comment-read-state'
import { recordComments as recordCommentsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/record-comments'
import { wrapDatabaseError } from '../shared/error-handling'
import { castToInt } from './aggregation-helpers'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

const commentReadState = resolveDialectSchema(commentReadStatePg, commentReadStateSqlite)
const recordComments = resolveDialectSchema(recordCommentsPg, recordCommentsSqlite)

/**
 * Mark every comment on a record read for the current user.
 *
 * Upserts the per-user high-watermark row for `(user_id, table_id, record_id)`
 * to NOW(). Uses Drizzle's `onConflictDoUpdate` against the unique index the
 * engine DDL created — the write is idempotent, so repeated mark-read calls
 * simply advance the watermark. The timestamp is bound as a JS `Date` and
 * written through Drizzle's typed `timestamp` / `timestamp_ms` column (NOT a
 * raw `sql` bind), which sidesteps the bun:sqlite Date→NULL coercion gotcha.
 */
export function markRecordCommentsRead(config: {
  readonly session: Readonly<Session>
  readonly tableId: string
  readonly recordId: string
}): Effect.Effect<void, DatabaseError> {
  const { session, tableId, recordId } = config
  const now = new Date()
  return Effect.tryPromise({
    try: () =>
      db
        .insert(commentReadState)
        .values({
          id: crypto.randomUUID(),
          userId: session.userId,
          tableId,
          recordId,
          lastReadAt: now,
        })
        .onConflictDoUpdate({
          target: [commentReadState.userId, commentReadState.tableId, commentReadState.recordId],
          set: { lastReadAt: now },
        })
        .then(() => undefined),
    catch: wrapDatabaseError('Failed to mark comments read'),
  })
}

/**
 * Count the comments on a record that are unread for the current user.
 *
 * A comment is unread when:
 *   - it is a visible (approved, non-deleted) comment on the record, AND
 *   - it was not authored by the viewer (own comments never count as unread —
 *     guest comments with a NULL author DO count), AND
 *   - the viewer has no read-state watermark for this record, OR the comment
 *     was created strictly after that watermark.
 *
 * The LEFT JOIN keys on the same `(user_id, table_id, record_id)` unique tuple
 * the mark-read upsert writes, so each comment matches at most one watermark
 * row — `COUNT(*)` is exact. The `created_at > last_read_at` comparison is
 * column-to-column and unit-consistent across dialects (both stored as
 * TIMESTAMPTZ on pg / epoch-ms on SQLite).
 *
 * The `record_comments.table_id` clause in the WHERE is what confines the
 * count to THIS table's record. `tableId` used to appear only in the
 * watermark JOIN, so the counted set spanned every same-numbered record in
 * the app (record ids are per-table sequences) and an unrelated table's
 * comments inflated the badge. See `activeCommentsByRecordId`.
 */
export function getUnreadCommentCount(config: {
  readonly session: Readonly<Session>
  readonly tableId: string
  readonly recordId: string
}): Effect.Effect<number, DatabaseError> {
  const { session, tableId, recordId } = config
  const { userId } = session
  return Effect.tryPromise<Array<{ count: number }>, DatabaseError>({
    try: () =>
      db
        .select({ count: castToInt(sql`COUNT(*)`) })
        .from(recordComments)
        .leftJoin(
          commentReadState,
          and(
            eq(commentReadState.userId, userId),
            eq(commentReadState.tableId, tableId),
            eq(commentReadState.recordId, recordComments.recordId)
          )
        )
        .where(
          and(
            eq(recordComments.tableId, tableId),
            eq(recordComments.recordId, recordId),
            isNull(recordComments.deletedAt),
            eq(recordComments.status, 'approved'),
            or(isNull(recordComments.userId), ne(recordComments.userId, userId)),
            or(
              isNull(commentReadState.lastReadAt),
              gt(recordComments.createdAt, commentReadState.lastReadAt)
            )
          )
        ),
    catch: (error) => new DatabaseError('Failed to count unread comments', error),
  }).pipe(Effect.map((result) => result[0]?.count ?? 0))
}
