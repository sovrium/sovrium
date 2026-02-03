/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, eq, and, isNull } from 'drizzle-orm'
import { Effect } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { withSessionContext, SessionContextError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import { recordComments } from '@/infrastructure/database/drizzle/schema/record-comments'
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

      const result = yield* Effect.tryPromise({
        try: () => tx.insert(recordComments).values(values).returning(),
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
 * Transform comment query result to domain model
 */
function transformCommentRow(row: {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string
  readonly content: string
  readonly createdAt: Date
  readonly userName: string | undefined
  readonly userEmail: string | undefined
  readonly userImage: string | undefined
}): {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string
  readonly content: string
  readonly createdAt: Date
  readonly user:
    | {
        readonly id: string
        readonly name: string
        readonly email: string
        readonly image: string | undefined
      }
    | undefined
} {
  return {
    id: row.id,
    tableId: row.tableId,
    recordId: row.recordId,
    userId: row.userId,
    content: row.content,
    createdAt: row.createdAt,
    user:
      row.userName && row.userEmail
        ? { id: row.userId, name: row.userName, email: row.userEmail, image: row.userImage }
        : undefined,
  }
}

/**
 * Comment query result type
 */
type CommentQueryRow = {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string
  readonly content: string
  readonly createdAt: Date
  readonly userName: string | null
  readonly userEmail: string | null
  readonly userImage: string | null
}

/**
 * Execute comment query with user join
 */
function executeCommentQuery(commentId: string) {
  return db
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
    .limit(1)
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
  const { session, commentId } = config
  return withSessionContext(session, () =>
    Effect.gen(function* () {
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
      // Check if table has owner_id column
      const hasOwnerIdResult = yield* Effect.tryPromise({
        try: () =>
          tx.execute(
            sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${tableName} AND column_name = 'owner_id'`
          ),
        catch: (error) => new SessionContextError('Failed to check table columns', error),
      })

      const hasOwnerId = (hasOwnerIdResult as readonly Record<string, unknown>[]).some(
        (row) => row.column_name === 'owner_id'
      )

      // Check if record exists
      const result = yield* Effect.tryPromise({
        try: () =>
          tx.execute(
            hasOwnerId
              ? sql`SELECT owner_id FROM ${sql.identifier(tableName)} WHERE id = ${recordId} AND deleted_at IS NULL`
              : sql`SELECT id FROM ${sql.identifier(tableName)} WHERE id = ${recordId} AND deleted_at IS NULL`
          ),
        catch: (error) => new SessionContextError('Failed to check record ownership', error),
      })

      if (result.length === 0) {
        return false
      }

      // If no owner_id column, allow access
      if (!hasOwnerId) {
        return true
      }

      const record = result[0] as { owner_id?: string }
      // Check ownership
      return String(record.owner_id) === String(session.userId)
    })
  )
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
  const { session, userId } = config
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          tx
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
  )
}

/**
 * Delete (soft delete) a comment
 */
export function deleteComment(config: {
  readonly session: Readonly<Session>
  readonly commentId: string
}): Effect.Effect<void, SessionContextError> {
  const { session, commentId } = config
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      const now = new Date()

      const result = yield* Effect.tryPromise({
        try: () =>
          tx
            .update(recordComments)
            .set({ deletedAt: now, updatedAt: now })
            .where(and(eq(recordComments.id, commentId), isNull(recordComments.deletedAt)))
            .returning(),
        catch: (error) => new SessionContextError('Failed to delete comment', error),
      })

      if (result.length === 0) {
        return yield* Effect.fail(new SessionContextError('Comment not found'))
      }
    })
  )
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
  const { session, commentId } = config
  return withSessionContext(session, (tx) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: () =>
          tx
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
  )
}
