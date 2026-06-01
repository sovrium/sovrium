/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, eq, and, isNull, desc, asc } from 'drizzle-orm'
import { Effect } from 'effect'
import { SessionContextError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { recordComments as recordCommentsPg } from '@/infrastructure/database/drizzle/schema/record-comments'
import { recordComments as recordCommentsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/record-comments'
import { wrapDatabaseError } from '../shared/error-handling'
import { castToInt } from './aggregation-helpers'
import {
  buildCommentSelectFields,
  transformCommentRow,
  type CommentQueryRow,
} from './comment-row-transform'
import type { UserMetadataWithOptionalImage } from '@/application/ports/models/user-metadata'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

const recordComments = resolveDialectSchema(recordCommentsPg, recordCommentsSqlite)

function activeCommentById(commentId: string) {
  return and(eq(recordComments.id, commentId), isNull(recordComments.deletedAt))
}

function activeCommentsByRecordId(recordId: string) {
  return and(eq(recordComments.recordId, recordId), isNull(recordComments.deletedAt))
}

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
        parentId: parentId ?? null,
        createdAt: now,
        updatedAt: now,
      }

      const result = await db.insert(recordComments).values(values).returning()

      if (result.length === 0) {
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

function executeCommentQuery(commentId: string) {
  const users = authUsersTable()
  return db
    .select(buildCommentSelectFields())
    .from(recordComments)
    .leftJoin(users, eq(recordComments.userId, users.id))
    .where(activeCommentById(commentId))
    .limit(1)
}

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
        throw new SessionContextError('Comment not found')
      }
    },
    catch: wrapDatabaseError('Failed to delete comment'),
  })
}

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

function buildCommentsQuery(recordId: string) {
  const users = authUsersTable()
  return db
    .select(buildCommentSelectFields())
    .from(recordComments)
    .leftJoin(users, eq(recordComments.userId, users.id))
    .where(activeCommentsByRecordId(recordId))
}

function executeListCommentsQuery(
  recordId: string,
  options?: {
    readonly limit?: number
    readonly offset?: number
    readonly sortOrder?: 'asc' | 'desc'
  }
) {
  const query = buildCommentsQuery(recordId)

  const sortedQuery =
    options?.sortOrder === 'asc'
      ? query.orderBy(asc(recordComments.createdAt), asc(recordComments.id))
      : query.orderBy(desc(recordComments.createdAt), desc(recordComments.id))

  if (options?.limit !== undefined) {
    const paginatedQuery = sortedQuery.limit(options.limit)
    return options.offset !== undefined ? paginatedQuery.offset(options.offset) : paginatedQuery
  }

  return sortedQuery
}

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

export function getCommentsCount(config: {
  readonly session: Readonly<Session>
  readonly recordId: string
}): Effect.Effect<number, SessionContextError> {
  const { recordId } = config
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise<Array<{ count: number }>, SessionContextError>({
      try: () =>
        db
          .select({ count: castToInt(sql`COUNT(*)`) })
          .from(recordComments)
          .where(activeCommentsByRecordId(recordId)),
      catch: (error) => new SessionContextError('Failed to count comments', error),
    })

    return result[0]?.count ?? 0
  })
}

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

export function updateCommentStatus(config: {
  readonly session: Readonly<Session>
  readonly commentId: string
  readonly status: 'approved' | 'rejected' | 'pending'
}): Effect.Effect<
  | {
      readonly id: string
      readonly tableId: string
      readonly recordId: string
      readonly userId: string | null
      readonly content: string
      readonly status: 'approved' | 'rejected' | 'pending'
      readonly createdAt: Date
      readonly updatedAt: Date
    }
  | undefined,
  SessionContextError
> {
  const { session, commentId, status } = config
  return Effect.tryPromise({
    try: async () => {
      const now = new Date()

      const result = await db
        .update(recordComments)
        .set({
          status,
          moderatedAt: now,
          moderatedBy: session.userId,
          updatedAt: now,
        })
        .where(activeCommentById(commentId))
        .returning()

      if (result.length === 0) return undefined

      const comment = result[0]!
      return {
        id: comment.id,
        tableId: comment.tableId,
        recordId: comment.recordId,
        userId: comment.userId,
        content: comment.content,
        status: comment.status as 'approved' | 'rejected' | 'pending',
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      }
    },
    catch: wrapDatabaseError('Failed to update comment status'),
  })
}
