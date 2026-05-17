/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, eq, and, isNull, desc, asc } from 'drizzle-orm'
import { Effect } from 'effect'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { SessionContextError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import { recordComments } from '@/infrastructure/database/drizzle/schema/record-comments'
import { wrapDatabaseError } from '../shared/error-handling'
import { extractUserFromRow } from '../shared/user-join-helpers'
import type { UserMetadataWithOptionalImage } from '@/application/ports/models/user-metadata'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/** Active (non-deleted) comment by ID */
function activeCommentById(commentId: string) {
  return and(eq(recordComments.id, commentId), isNull(recordComments.deletedAt))
}

/** Active (non-deleted) comments by record ID */
function activeCommentsByRecordId(recordId: string) {
  return and(eq(recordComments.recordId, recordId), isNull(recordComments.deletedAt))
}

/**
 * Create a comment on a record
 */
export function createComment(config: {
  readonly session: Readonly<Session>
  readonly tableId: string
  readonly recordId: string
  readonly content: string
  readonly parentId?: string
}): Effect.Effect<
  {
    readonly id: string
    readonly tableId: string
    readonly recordId: string
    readonly userId: string | null
    readonly content: string
    readonly parentId: string | null
    readonly createdAt: Date
  },
  SessionContextError
> {
  const { session, tableId, recordId, content, parentId } = config
  return Effect.tryPromise({
    try: async () => {
      const now = new Date()
      const values = {
        id: crypto.randomUUID(),
        tableId,
        recordId,
        userId: session.userId,
        content,
        // eslint-disable-next-line unicorn/no-null -- Drizzle pgcore expects `null` (not undefined) to write SQL NULL into nullable parent_id
        parentId: parentId ?? null,
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
        parentId: comment.parentId,
        createdAt: comment.createdAt,
      }
    },
    catch: wrapDatabaseError('Failed to create comment'),
  })
}

/**
 * Distinct user IDs of every comment author on a given record (excluding
 * soft-deleted comments and guest authors). Used by the comment-posted
 * trigger to derive `threadParticipants` — the resulting list is then
 * filtered to drop the newly-created comment's own author so the trigger
 * only notifies the OTHER thread participants.
 */
export function listCommentAuthorsForRecord(config: {
  readonly session: Readonly<Session>
  readonly recordId: string
}): Effect.Effect<readonly string[], SessionContextError> {
  const { recordId } = config
  return Effect.tryPromise({
    try: async () => {
      const rows = await db
        .selectDistinct({ userId: recordComments.userId })
        .from(recordComments)
        .where(activeCommentsByRecordId(recordId))
      return rows
        .map((row) => row.userId)
        .filter((userId): userId is string => typeof userId === 'string' && userId.length > 0)
    },
    catch: wrapDatabaseError('Failed to list comment authors'),
  })
}

/**
 * Transform comment query result to domain model
 */
function transformCommentRow(row: {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly parentId: string | null
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly userName: string | undefined
  readonly userEmail: string | undefined
  readonly userImage: string | undefined
}): {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly parentId: string | null
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly user: UserMetadataWithOptionalImage | undefined
} {
  return {
    id: row.id,
    tableId: row.tableId,
    recordId: row.recordId,
    userId: row.userId,
    parentId: row.parentId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: extractUserFromRow(row),
  }
}

/**
 * Comment query result type
 */
type CommentQueryRow = {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly parentId: string | null
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly userName: string | null
  readonly userEmail: string | null
  readonly userImage: string | null
}

/**
 * Comment select fields with user join
 */
const commentSelectFields = {
  id: recordComments.id,
  tableId: recordComments.tableId,
  recordId: recordComments.recordId,
  userId: recordComments.userId,
  parentId: recordComments.parentId,
  content: recordComments.content,
  createdAt: recordComments.createdAt,
  updatedAt: recordComments.updatedAt,
  userName: users.name,
  userEmail: users.email,
  userImage: users.image,
}

/**
 * Execute comment query with user join
 */
function executeCommentQuery(commentId: string) {
  return db
    .select(commentSelectFields)
    .from(recordComments)
    .leftJoin(users, eq(recordComments.userId, users.id))
    .where(activeCommentById(commentId))
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
      readonly userId: string | null
      readonly parentId: string | null
      readonly content: string
      readonly createdAt: Date
      readonly updatedAt: Date
      readonly user: UserMetadataWithOptionalImage | undefined
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
        .where(activeCommentById(commentId))
        .returning()

      if (result.length === 0) {
        // eslint-disable-next-line functional/no-throw-statements -- Required inside Effect.tryPromise for error propagation
        throw new SessionContextError('Comment not found')
      }
    },
    catch: wrapDatabaseError('Failed to delete comment'),
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
      readonly userId: string | null
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
          .where(activeCommentById(commentId))
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
 * Build base comments query with user join
 */
function buildCommentsQuery(recordId: string) {
  return db
    .select(commentSelectFields)
    .from(recordComments)
    .leftJoin(users, eq(recordComments.userId, users.id))
    .where(activeCommentsByRecordId(recordId))
}

/**
 * Execute list comments query with sorting and pagination
 */
function executeListCommentsQuery(
  recordId: string,
  options?: {
    readonly limit?: number
    readonly offset?: number
    readonly sortOrder?: 'asc' | 'desc'
  }
) {
  const query = buildCommentsQuery(recordId)

  // Apply sorting (default: DESC for newest first)
  const sortedQuery =
    options?.sortOrder === 'asc'
      ? query.orderBy(asc(recordComments.createdAt), asc(recordComments.id))
      : query.orderBy(desc(recordComments.createdAt), desc(recordComments.id))

  // Apply pagination
  if (options?.limit !== undefined) {
    const paginatedQuery = sortedQuery.limit(options.limit)
    return options.offset !== undefined ? paginatedQuery.offset(options.offset) : paginatedQuery
  }

  return sortedQuery
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
    readonly userId: string | null
    readonly parentId: string | null
    readonly content: string
    readonly createdAt: Date
    readonly updatedAt: Date
    readonly user: UserMetadataWithOptionalImage | undefined
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
          .where(activeCommentsByRecordId(recordId)),
      catch: (error) => new SessionContextError('Failed to count comments', error),
    })

    return result[0]?.count ?? 0
  })
}

/**
 * Update a comment's content
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
    readonly userId: string | null
    readonly content: string
    readonly createdAt: Date
    readonly updatedAt: Date
  },
  SessionContextError
> {
  const { commentId, content } = config
  return Effect.tryPromise({
    try: async () => {
      const now = new Date()

      const result = await db
        .update(recordComments)
        .set({ content, updatedAt: now })
        .where(activeCommentById(commentId))
        .returning()

      if (result.length === 0) {
        // eslint-disable-next-line functional/no-throw-statements -- Required inside Effect.tryPromise for error propagation
        throw new SessionContextError('Comment not found')
      }

      const comment = result[0]!
      return {
        id: comment.id,
        tableId: comment.tableId,
        recordId: comment.recordId,
        userId: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      }
    },
    catch: (error) =>
      error instanceof SessionContextError
        ? error
        : new SessionContextError('Failed to update comment', error),
  })
}
