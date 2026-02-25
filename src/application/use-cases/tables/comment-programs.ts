/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { SessionContextError } from '@/domain/errors'
import type { UserMetadataWithOptionalImage } from '@/application/ports/models/user-metadata'
import type { UserSession } from '@/application/ports/models/user-session'

/**
 * Create comment on a record
 */
interface CreateCommentConfig {
  readonly session: Readonly<UserSession>
  readonly tableId: string
  readonly recordId: string
  readonly tableName: string
  readonly content: string
}

/**
 * Format comment with user data
 */
function formatCommentResponse(comment: {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string
  readonly content: string
  readonly createdAt: Date
  readonly updatedAt?: Date
  readonly user?: UserMetadataWithOptionalImage | undefined
}) {
  return {
    comment: {
      id: comment.id,
      tableId: comment.tableId,
      recordId: comment.recordId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt?.toISOString() ?? comment.createdAt.toISOString(),
      user: comment.user,
    },
  }
}

export function createCommentProgram(config: CreateCommentConfig): Effect.Effect<
  {
    readonly comment: {
      readonly id: string
      readonly tableId: string
      readonly recordId: string
      readonly userId: string
      readonly content: string
      readonly createdAt: string
      readonly updatedAt: string
      readonly user?: UserMetadataWithOptionalImage | undefined
    }
  },
  SessionContextError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, tableId, recordId, tableName, content } = config

    // Check if record exists
    const hasAccess = yield* comments.checkRecordExists({ session, tableName, recordId })
    if (!hasAccess) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    // Create comment
    const comment = yield* comments.create({ session, tableId, recordId, content })

    // Fetch comment with user metadata
    const commentWithUser = yield* comments.getWithUser({ session, commentId: comment.id })

    // Format response
    return formatCommentResponse(commentWithUser ?? comment)
  })
}

/**
 * Delete comment configuration
 */
interface DeleteCommentConfig {
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
}

/**
 * Delete comment program
 *
 * Authorization:
 * - Comment author can delete their own comments
 * - Admins can delete any comment
 * - Returns 404 for non-existent comments, already deleted comments, or unauthorized access
 */
export function deleteCommentProgram(
  config: DeleteCommentConfig
): Effect.Effect<void, SessionContextError, CommentRepository> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, commentId, tableName } = config

    // Get comment for authorization check
    const comment = yield* comments.getForAuth({ session, commentId })

    if (!comment) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    // Get current user to check role
    const currentUser = yield* comments.getUserById({ session, userId: session.userId })

    if (!currentUser) {
      return yield* Effect.fail(new SessionContextError('User not found'))
    }

    // Check authorization: user is comment author OR user is admin
    const isAuthor = comment.userId === session.userId
    const isAdmin = currentUser.role === 'admin'

    // Check record exists (admins can access all records, non-admins only their own)
    const hasRecordAccess = yield* comments.checkRecordExists({
      session,
      tableName,
      recordId: comment.recordId,
      isAdmin,
    })

    if (!hasRecordAccess) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    if (!isAuthor && !isAdmin) {
      // User has record access but is not the comment author and not an admin
      // Return 403 Forbidden to explicitly deny the operation
      return yield* Effect.fail(new SessionContextError('Forbidden'))
    }

    // Delete comment (soft delete)
    yield* comments.remove({ session, commentId })
  })
}

/**
 * Get comment by ID configuration
 */
interface GetCommentConfig {
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
}

/**
 * Get comment by ID program
 */
export function getCommentProgram(config: GetCommentConfig): Effect.Effect<
  {
    readonly comment: {
      readonly id: string
      readonly tableId: string
      readonly recordId: string
      readonly userId: string
      readonly content: string
      readonly createdAt: string
      readonly updatedAt: string
      readonly user?: UserMetadataWithOptionalImage | undefined
    }
  },
  SessionContextError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, commentId, tableName } = config

    // Get comment with user metadata
    const comment = yield* comments.getWithUser({ session, commentId })

    if (!comment) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    // Check record exists (isAdmin: true because table-level read permission already validated by handler)
    const recordExists = yield* comments.checkRecordExists({
      session,
      tableName,
      recordId: comment.recordId,
      isAdmin: true,
    })

    if (!recordExists) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    // Format response
    return formatCommentResponse(comment)
  })
}

/**
 * List comments configuration
 */
interface ListCommentsConfig {
  readonly session: Readonly<UserSession>
  readonly recordId: string
  readonly tableName: string
  readonly limit?: number
  readonly offset?: number
  readonly sortOrder?: 'asc' | 'desc'
}

/**
 * Format list of comments
 */
function formatCommentsList(
  comments: readonly {
    readonly id: string
    readonly tableId: string
    readonly recordId: string
    readonly userId: string
    readonly content: string
    readonly createdAt: Date
    readonly updatedAt: Date
    readonly user?: UserMetadataWithOptionalImage | undefined
  }[]
): readonly {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string
  readonly content: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly user?: UserMetadataWithOptionalImage | undefined
}[] {
  return comments.map((comment) => ({
    id: comment.id,
    tableId: comment.tableId,
    recordId: comment.recordId,
    userId: comment.userId,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    user: comment.user,
  }))
}

/**
 * Calculate pagination metadata if limit is provided
 */
function calculatePagination(params: {
  readonly limit: number | undefined
  readonly offset: number | undefined
  readonly total: number
}):
  | {
      readonly total: number
      readonly limit: number
      readonly offset: number
      readonly hasMore: boolean
    }
  | undefined {
  const { limit, offset, total } = params
  if (limit === undefined) {
    return undefined
  }

  const actualOffset = offset ?? 0
  return {
    total,
    limit,
    offset: actualOffset,
    hasMore: actualOffset + limit < total,
  }
}

/**
 * Verify user has access to record
 */
function verifyRecordAccess(params: {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordId: string
}): Effect.Effect<void, SessionContextError, CommentRepository> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const hasAccess = yield* comments.checkRecordExists(params)
    if (!hasAccess) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }
  })
}

/**
 * Update comment configuration
 */
interface UpdateCommentConfig {
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
  readonly content: string
}

/**
 * Update comment program
 *
 * Authorization:
 * - Only the comment author can edit their own comments
 * - Admins cannot edit other users' comments (respect authorship)
 * - Returns 404 for non-existent comments, already deleted comments, or unauthorized access
 * - Returns 403 for different user attempting to edit (even if they have record access)
 */
export function updateCommentProgram(config: UpdateCommentConfig): Effect.Effect<
  {
    readonly comment: {
      readonly id: string
      readonly tableId: string
      readonly recordId: string
      readonly userId: string
      readonly content: string
      readonly createdAt: string
      readonly updatedAt: string
      readonly user?: UserMetadataWithOptionalImage | undefined
    }
  },
  SessionContextError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, commentId, tableName, content } = config

    // Get comment for authorization check
    const comment = yield* comments.getForAuth({ session, commentId })

    if (!comment) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    // Check authorization: user must be comment author
    const isAuthor = comment.userId === session.userId

    // Check record exists
    const hasRecordAccess = yield* comments.checkRecordExists({
      session,
      tableName,
      recordId: comment.recordId,
    })

    if (!hasRecordAccess) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    if (!isAuthor) {
      // User has record access but is not the comment author
      // Return 403 Forbidden to explicitly deny the operation
      return yield* Effect.fail(new SessionContextError('Forbidden'))
    }

    // Update comment
    yield* comments.update({ session, commentId, content })

    // Fetch updated comment with user metadata
    const updatedComment = yield* comments.getWithUser({ session, commentId })

    if (!updatedComment) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    // Format response
    return formatCommentResponse(updatedComment)
  })
}

/**
 * List comments program
 */
export function listCommentsProgram(config: ListCommentsConfig): Effect.Effect<
  {
    readonly comments: readonly {
      readonly id: string
      readonly tableId: string
      readonly recordId: string
      readonly userId: string
      readonly content: string
      readonly createdAt: string
      readonly updatedAt: string
      readonly user?: UserMetadataWithOptionalImage | undefined
    }[]
    readonly pagination?: {
      readonly total: number
      readonly limit: number
      readonly offset: number
      readonly hasMore: boolean
    }
  },
  SessionContextError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, recordId, tableName, limit, offset, sortOrder } = config

    // Check record exists
    yield* verifyRecordAccess({ session, tableName, recordId })

    // List comments
    const commentsList = yield* comments.list({ session, recordId, limit, offset, sortOrder })

    // Get total count and pagination if requested
    const pagination =
      limit !== undefined
        ? calculatePagination({
            limit,
            offset,
            total: yield* comments.getCount({ session, recordId }),
          })
        : undefined

    // Format response
    return {
      comments: formatCommentsList(commentsList),
      ...(pagination && { pagination }),
    }
  })
}
