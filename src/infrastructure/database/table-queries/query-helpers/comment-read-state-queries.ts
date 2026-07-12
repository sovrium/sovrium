/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, and, eq, ne, or, gt, isNull } from 'drizzle-orm'
import { Effect } from 'effect'
import { SessionContextError } from '@/infrastructure/database'
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

export function markRecordCommentsRead(config: {
  readonly session: Readonly<Session>
  readonly tableId: string
  readonly recordId: string
}): Effect.Effect<void, SessionContextError> {
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

export function getUnreadCommentCount(config: {
  readonly session: Readonly<Session>
  readonly tableId: string
  readonly recordId: string
}): Effect.Effect<number, SessionContextError> {
  const { session, tableId, recordId } = config
  const { userId } = session
  return Effect.tryPromise<Array<{ count: number }>, SessionContextError>({
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
    catch: (error) => new SessionContextError('Failed to count unread comments', error),
  }).pipe(Effect.map((result) => result[0]?.count ?? 0))
}
