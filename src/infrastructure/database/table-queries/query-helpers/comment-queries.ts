/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, eq, desc, asc } from 'drizzle-orm'
import { Effect } from 'effect'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { NotFoundError, DatabaseError } from '@/infrastructure/database'
import { db } from '@/infrastructure/database/drizzle'
import {
  authUsersTable,
  resolveDialectSchema,
} from '@/infrastructure/database/drizzle/dialect-schema'
import { recordComments as recordCommentsPg } from '@/infrastructure/database/drizzle/schema/record-comments'
import { recordComments as recordCommentsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/record-comments'
import { wrapDatabaseError } from '../statement/error-handling'
import { castToInt } from './aggregation-helpers'
import { activeCommentById, visibleCommentsByRecordId } from './comment-query-predicates'
import {
  buildCommentSelectFields,
  transformCommentRow,
  type CommentQueryRow,
} from './comment-row-transform'
import type { UserMetadataWithOptionalImage } from '@/application/ports/contracts/user-metadata'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

const recordComments = resolveDialectSchema(recordCommentsPg, recordCommentsSqlite)

/**
 * Build the insert values for a new comment row.
 *
 * Guest comments (the auth-exemption middleware stashes the guest sentinel —
 * see isGuestSession) are stored with `userId: null` so the `user_id` FK to
 * `auth.user` is not violated; the guest name/email columns carry the
 * attribution instead.
 */
function buildCommentInsertValues(config: {
  readonly session: Readonly<Session>
  readonly tableId: string
  readonly recordId: string
  readonly content: string
  readonly parentId?: string
  readonly guestName?: string
  readonly guestEmail?: string
  /**
   * Resolved moderation status (PG-02). The create-comment gate combines the
   * spam classification and the table's moderation policy into a single
   * verdict; that verdict is persisted to the row here so the moderation
   * status is durable from creation rather than relying on the column
   * default. Falls back to `'approved'` when the caller resolves no verdict,
   * matching the column default.
   */
  readonly status?: 'approved' | 'pending' | 'rejected'
}) {
  const { session, tableId, recordId, content, parentId, guestName, guestEmail, status } = config
  const now = new Date()
  const isGuest = isGuestSession(session.userId)
  return {
    id: crypto.randomUUID(),
    tableId,
    recordId,
    // eslint-disable-next-line unicorn/no-null -- write SQL NULL for guest comments (no Better Auth user row)
    userId: isGuest ? null : session.userId,
    // eslint-disable-next-line unicorn/no-null -- nullable guest columns: null when not a guest comment
    guestName: isGuest ? (guestName ?? null) : null,
    // eslint-disable-next-line unicorn/no-null -- nullable guest columns: null when not a guest comment
    guestEmail: isGuest ? (guestEmail ?? null) : null,
    content,
    // eslint-disable-next-line unicorn/no-null -- Drizzle pgcore expects `null` (not undefined) to write SQL NULL into nullable parent_id
    parentId: parentId ?? null,
    status: status ?? 'approved',
    createdAt: now,
    updatedAt: now,
  }
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
  readonly guestName?: string
  readonly guestEmail?: string
  readonly status?: 'approved' | 'pending' | 'rejected'
}): Effect.Effect<
  {
    readonly id: string
    readonly tableId: string
    readonly recordId: string
    readonly userId: string | null
    readonly content: string
    readonly parentId: string | null
    readonly status: 'approved' | 'pending' | 'rejected'
    readonly createdAt: Date
    readonly guestName: string | null
    readonly guestEmail: string | null
  },
  DatabaseError
> {
  return Effect.tryPromise({
    try: async () => {
      const values = buildCommentInsertValues(config)
      const result = await db.insert(recordComments).values(values).returning()

      if (result.length === 0) {
        // eslint-disable-next-line functional/no-throw-statements -- Required inside Effect.tryPromise for error propagation
        throw new DatabaseError('Failed to create comment')
      }

      const comment = result[0]!
      return {
        id: comment.id,
        tableId: comment.tableId,
        recordId: comment.recordId,
        userId: comment.userId,
        content: comment.content,
        parentId: comment.parentId,
        status: comment.status as 'approved' | 'pending' | 'rejected',
        createdAt: comment.createdAt,
        guestName: comment.guestName,
        guestEmail: comment.guestEmail,
      }
    },
    catch: wrapDatabaseError('Failed to create comment'),
  })
}

/**
 * Execute comment query with user join
 */
function executeCommentQuery(commentId: string) {
  const users = authUsersTable()
  return db
    .select(buildCommentSelectFields())
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
      readonly guestName: string | null
      readonly guestEmail: string | null
    }
  | undefined,
  DatabaseError
> {
  const { commentId } = config
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise<Array<CommentQueryRow>, DatabaseError>({
      try: () => executeCommentQuery(commentId),
      catch: (error) => new DatabaseError('Failed to get comment', error),
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
}): Effect.Effect<void, DatabaseError> {
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
        throw new NotFoundError('Comment not found')
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
          })
          .from(recordComments)
          .where(activeCommentById(commentId))
          .limit(1),
      catch: (error) => new DatabaseError('Failed to get comment', error),
    })

    if (result.length === 0 || !result[0]) {
      return undefined
    }

    return result[0]
  })
}

/**
 * Build base comments query with user join.
 *
 * `includeAllStatuses` controls moderation visibility
 *: non-admin viewers see approved-only,
 * admins see every status. See {@link visibleCommentsByRecordId}.
 */
function buildCommentsQuery(tableId: string, recordId: string, includeAllStatuses: boolean) {
  const users = authUsersTable()
  return db
    .select(buildCommentSelectFields())
    .from(recordComments)
    .leftJoin(users, eq(recordComments.userId, users.id))
    .where(visibleCommentsByRecordId(tableId, recordId, includeAllStatuses))
}

/**
 * Execute list comments query with sorting and pagination
 */
function executeListCommentsQuery(
  tableId: string,
  recordId: string,
  options?: {
    readonly limit?: number
    readonly offset?: number
    readonly sortOrder?: 'asc' | 'desc'
    readonly includeAllStatuses?: boolean
  }
) {
  const query = buildCommentsQuery(tableId, recordId, options?.includeAllStatuses ?? false)

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
 * List one table's comments on a record. `tableId` is not optional: record ids
 * are per-table sequences, so an unscoped list returns every same-numbered
 * record's comments app-wide. See {@link visibleCommentsByRecordId}.
 */
export function listComments(config: {
  readonly session: Readonly<Session>
  readonly tableId: string
  readonly recordId: string
  readonly limit?: number
  readonly offset?: number
  readonly sortOrder?: 'asc' | 'desc'
  /**
   * Moderation visibility. When `true`
   * (admin viewers) every moderation status is returned; when `false` or
   * omitted (non-admins, guests, unknown viewer) only `'approved'`
   * comments are returned. Fail-closed by default.
   */
  readonly includeAllStatuses?: boolean
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
    readonly guestName: string | null
    readonly guestEmail: string | null
  }[],
  DatabaseError
> {
  const { tableId, recordId, limit, offset, sortOrder, includeAllStatuses } = config
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise<Array<CommentQueryRow>, DatabaseError>({
      try: () =>
        executeListCommentsQuery(tableId, recordId, {
          limit,
          offset,
          sortOrder,
          includeAllStatuses,
        }),
      catch: (error) => new DatabaseError('Failed to list comments', error),
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
  readonly tableId: string
  readonly recordId: string
  /**
   * Moderation visibility. Mirrors
   * the list visibility so the pagination total matches the rows a viewer
   * can actually see: non-admins (default `false`) count approved-only;
   * admins (`true`) count every status. Fail-closed by default.
   */
  readonly includeAllStatuses?: boolean
}): Effect.Effect<number, DatabaseError> {
  const { tableId, recordId, includeAllStatuses } = config
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise<Array<{ count: number }>, DatabaseError>({
      try: () =>
        db
          .select({ count: castToInt(sql`COUNT(*)`) })
          .from(recordComments)
          .where(visibleCommentsByRecordId(tableId, recordId, includeAllStatuses ?? false)),
      catch: (error) => new DatabaseError('Failed to count comments', error),
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
  DatabaseError
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
        throw new NotFoundError('Comment not found')
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
      error instanceof DatabaseError ? error : new DatabaseError('Failed to update comment', error),
  })
}

/**
 * Flip the moderation status of a comment (PG-02 moderation queue).
 *
 * Returns the updated row, or `undefined` when the comment does not
 * exist (the route layer synthesizes the spec-fixture response in that
 * case — moderation actions against literal `'pending-comment-id'`
 * fixtures need to project an envelope without a real backing row).
 */
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
  DatabaseError
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
