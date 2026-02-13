/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, eq, and, isNull } from 'drizzle-orm'
import { Effect } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { SessionContextError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import { recordComments } from '@/infrastructure/database/drizzle/schema/record-comments'
import {
  transformCommentRow,
  executeCommentQuery,
  executeListCommentsQuery,
  buildRecordCheckQuery,
  executeCommentUpdate,
  type CommentQueryRow,
} from './comment-query-helpers'
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
  return Effect.tryPromise({
    try: async () => {
      const now = new Date()
      const values = {
        id: crypto.randomUUID(),
        tableId,
        recordId,
        userId: session.userId,
        content,
        createdAt: now,
        updatedAt: now,
      }

      const result = await db.insert(recordComments).values(values).returning()

      if (result.length === 0) {
        // eslint-disable-next-line functional/no-throw-statements -- Required inside Effect.tryPromise for error propagation
        throw new SessionContextError('Failed to create comment')
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
    },
    catch: (error) =>
      error instanceof SessionContextError
        ? error
        : new SessionContextError('Failed to create comment', error),
  })
}

/**
 * Get comment with user metadata
 */
export function getCommentWithUser(config: {
  readonly session: Readonly<Session>
  readonly commentId: string
}): Effect.Effect<
  | {
      readonly id: string
      readonly tableId: string
      readonly recordId: string
      readonly userId: string
      readonly content: string
      readonly createdAt: Date
      readonly updatedAt: Date
      readonly user:
        | {
            readonly id: string
            readonly name: string
            readonly email: string
            readonly image: string | undefined
          }
        | undefined
    }
  | undefined,
  SessionContextError
> {
  const { commentId } = config
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise<Array<CommentQueryRow>, SessionContextError>({
      try: () => executeCommentQuery(commentId),
      catch: (error) => new SessionContextError('Failed to get comment', error),
    })

    if (result.length === 0 || !result[0]) {
      return undefined
    }

    const row = result[0]
    return transformCommentRow({
      ...row,
      userName: row.userName ?? undefined,
      userEmail: row.userEmail ?? undefined,
      userImage: row.userImage ?? undefined,
    })
  })
}

/**
 * Check if a record exists in the given table (with owner_id isolation)
 */
export function checkRecordExists(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
}): Effect.Effect<boolean, SessionContextError> {
  const { session, tableName, recordId } = config
  return Effect.gen(function* () {
    // Check if table has deleted_at column
    const columnsResult = yield* Effect.tryPromise({
      try: () =>
        db.execute(
          sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${tableName} AND column_name IN ('deleted_at', 'owner_id')`
        ),
      catch: (error) => new SessionContextError('Failed to check table columns', error),
    })

    const columns = columnsResult as readonly Record<string, unknown>[]
    const hasDeletedAt = columns.some((row) => row.column_name === 'deleted_at')
    const hasOwnerId = columns.some((row) => row.column_name === 'owner_id')

    // Check if record exists (with owner_id check for multi-tenancy isolation)
    const query = buildRecordCheckQuery({
      tableName,
      recordId,
      userId: session.userId,
      hasDeletedAt,
      hasOwnerId,
    })
    const result = yield* Effect.tryPromise({
      try: () => db.execute(query),
      catch: (error) => new SessionContextError('Failed to check record existence', error),
    })

    return result.length > 0
  })
}

/**
 * Get user by ID
 */
export function getUserById(config: {
  readonly session: Readonly<Session>
  readonly userId: string
}): Effect.Effect<
  | {
      readonly id: string
      readonly role: string | undefined
    }
  | undefined,
  SessionContextError
> {
  const { userId } = config
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1),
      catch: (error) => new SessionContextError('Failed to get user', error),
    })

    if (result.length === 0 || !result[0]) {
      return undefined
    }

    return {
      id: result[0].id,
      role: result[0].role ?? undefined,
    }
  })
}

/**
 * Delete (soft delete) a comment
 */
export function deleteComment(config: {
  readonly session: Readonly<Session>
  readonly commentId: string
}): Effect.Effect<void, SessionContextError> {
  const { commentId } = config
  return Effect.tryPromise({
    try: async () => {
      const now = new Date()

      const result = await db
        .update(recordComments)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(recordComments.id, commentId), isNull(recordComments.deletedAt)))
        .returning()

      if (result.length === 0) {
        // eslint-disable-next-line functional/no-throw-statements -- Required inside Effect.tryPromise for error propagation
        throw new SessionContextError('Comment not found')
      }
    },
    catch: (error) =>
      error instanceof SessionContextError
        ? error
        : new SessionContextError('Failed to delete comment', error),
  })
}

/**
 * Get comment by ID for authorization check
 */
export function getCommentForAuth(config: {
  readonly session: Readonly<Session>
  readonly commentId: string
}): Effect.Effect<
  | {
      readonly id: string
      readonly userId: string
      readonly recordId: string
      readonly tableId: string
    }
  | undefined,
  SessionContextError
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
          })
          .from(recordComments)
          .where(and(eq(recordComments.id, commentId), isNull(recordComments.deletedAt)))
          .limit(1),
      catch: (error) => new SessionContextError('Failed to get comment', error),
    })

    if (result.length === 0 || !result[0]) {
      return undefined
    }

    return result[0]
  })
}

/**
 * List all comments for a record
 */
export function listComments(config: {
  readonly session: Readonly<Session>
  readonly recordId: string
  readonly limit?: number
  readonly offset?: number
  readonly sortOrder?: 'asc' | 'desc'
}): Effect.Effect<
  readonly {
    readonly id: string
    readonly tableId: string
    readonly recordId: string
    readonly userId: string
    readonly content: string
    readonly createdAt: Date
    readonly updatedAt: Date
    readonly user:
      | {
          readonly id: string
          readonly name: string
          readonly email: string
          readonly image: string | undefined
        }
      | undefined
  }[],
  SessionContextError
> {
  const { recordId, limit, offset, sortOrder } = config
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise<Array<CommentQueryRow>, SessionContextError>({
      try: () => executeListCommentsQuery(recordId, { limit, offset, sortOrder }),
      catch: (error) => new SessionContextError('Failed to list comments', error),
    })

    return result.map((row) =>
      transformCommentRow({
        ...row,
        userName: row.userName ?? undefined,
        userEmail: row.userEmail ?? undefined,
        userImage: row.userImage ?? undefined,
      })
    )
  })
}

/**
 * Get total count of comments for a record
 */
export function getCommentsCount(config: {
  readonly session: Readonly<Session>
  readonly recordId: string
}): Effect.Effect<number, SessionContextError> {
  const { recordId } = config
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise<Array<{ count: number }>, SessionContextError>({
      try: () =>
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(recordComments)
          .where(and(eq(recordComments.recordId, recordId), isNull(recordComments.deletedAt))),
      catch: (error) => new SessionContextError('Failed to count comments', error),
    })

    return result[0]?.count ?? 0
  })
}

/**
 * Update a comment
 */
export function updateComment(config: {
  readonly session: Readonly<Session>
  readonly commentId: string
  readonly content: string
}): Effect.Effect<
  {
    readonly id: string
    readonly tableId: string
    readonly recordId: string
    readonly userId: string
    readonly content: string
    readonly createdAt: Date
    readonly updatedAt: Date
    readonly user:
      | {
          readonly id: string
          readonly name: string
          readonly email: string
          readonly image: string | undefined
        }
      | undefined
  },
  SessionContextError
> {
  const { commentId, content, session } = config
  return Effect.gen(function* () {
    // Update comment
    yield* Effect.tryPromise({
      try: async () => {
        const result = await executeCommentUpdate(commentId, content)
        if (result.length === 0 || !result[0]) {
          // eslint-disable-next-line functional/no-throw-statements -- Required inside Effect.tryPromise for error propagation
          throw new SessionContextError('Comment not found')
        }
        return result[0]
      },
      catch: (error) =>
        error instanceof SessionContextError
          ? error
          : new SessionContextError('Failed to update comment', error),
    })

    // Fetch comment with user metadata
    const commentWithUser = yield* getCommentWithUser({ session, commentId })

    if (!commentWithUser) {
      return yield* Effect.fail(new SessionContextError('Comment not found after update'))
    }

    return commentWithUser
  })
}
