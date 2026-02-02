/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, eq, and, isNull } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '@/infrastructure/database/drizzle'
import { recordComments } from '@/infrastructure/database/drizzle/schema/record-comments'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { withSessionContext, SessionContextError } from '@/infrastructure/database'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Create a comment on a record
 */
export function createComment(config: {
  readonly session: Readonly<Session>
  readonly tableId: string
  readonly recordId: string
  readonly content: string
}): Effect.Effect<
  {
    readonly id: string
    readonly tableId: string
    readonly recordId: string
    readonly userId: string
    readonly content: string
    readonly createdAt: Date
  },
  SessionContextError
> {
  const { session, tableId, recordId, content } = config
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      const commentId = crypto.randomUUID()
      const now = new Date()

      // Insert comment
      const result = yield* Effect.tryPromise({
        try: () =>
          tx
            .insert(recordComments)
            .values({
              id: commentId,
              tableId,
              recordId,
              userId: session.userId,
              content,
              createdAt: now,
              updatedAt: now,
            })
            .returning(),
        catch: (error) => new SessionContextError('Failed to create comment', error),
      })

      if (result.length === 0) {
        return yield* Effect.fail(new SessionContextError('Failed to create comment'))
      }

      const comment = result[0]!
      return {
        id: comment.id,
        tableId: comment.tableId,
        recordId: comment.recordId,
        userId: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt,
      }
    })
  )
}

/**
 * Get comment with user metadata
 */
export function getCommentWithUser(config: {
  readonly session: Readonly<Session>
  readonly commentId: string
}): Effect.Effect<
  {
    readonly id: string
    readonly tableId: string
    readonly recordId: string
    readonly userId: string
    readonly content: string
    readonly createdAt: Date
    readonly user: {
      readonly id: string
      readonly name: string
      readonly email: string
      readonly image: string | null
    } | null
  } | null,
  SessionContextError
> {
  const { session, commentId } = config
  return withSessionContext(session, () =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .select({
              id: recordComments.id,
              tableId: recordComments.tableId,
              recordId: recordComments.recordId,
              userId: recordComments.userId,
              content: recordComments.content,
              createdAt: recordComments.createdAt,
              userName: users.name,
              userEmail: users.email,
              userImage: users.image,
            })
            .from(recordComments)
            .leftJoin(users, eq(recordComments.userId, users.id))
            .where(and(eq(recordComments.id, commentId), isNull(recordComments.deletedAt)))
            .limit(1),
        catch: (error) => new SessionContextError('Failed to get comment', error),
      })

      if (result.length === 0) {
        return null
      }

      const row = result[0]!
      return {
        id: row.id,
        tableId: row.tableId,
        recordId: row.recordId,
        userId: row.userId,
        content: row.content,
        createdAt: row.createdAt,
        user: row.userName
          ? {
              id: row.userId,
              name: row.userName,
              email: row.userEmail,
              image: row.userImage,
            }
          : null,
      }
    })
  )
}

/**
 * Check if a record exists in the given table and is owned by the user
 */
export function checkRecordOwnership(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
}): Effect.Effect<boolean, SessionContextError> {
  const { session, tableName, recordId } = config
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      // Check if record exists
      const result = yield* Effect.tryPromise({
        try: () =>
          tx.execute(
            sql`SELECT owner_id FROM ${sql.identifier(tableName)} WHERE id = ${recordId} AND deleted_at IS NULL`
          ),
        catch: (error) => new SessionContextError('Failed to check record ownership', error),
      })

      if (result.length === 0) {
        return false
      }

      const record = result[0] as { owner_id?: string }
      // If no owner_id column, allow access
      if (record.owner_id === undefined) {
        return true
      }

      // Check ownership
      return String(record.owner_id) === String(session.userId)
    })
  )
}
