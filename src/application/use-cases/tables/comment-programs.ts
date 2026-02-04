/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { SessionContextError } from '@/infrastructure/database'
import {
  createComment,
  getCommentWithUser,
  checkRecordOwnership,
  deleteComment,
  getCommentForAuth,
  getUserById,
  listComments,
} from '@/infrastructure/database/table-queries/comment-queries'
import type { Session } from '@/infrastructure/auth/better-auth/schema'

/**
 * Create comment on a record
 */
interface CreateCommentConfig {
  readonly session: Readonly<Session>
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
  readonly user?:
    | {
        readonly id: string
        readonly name: string
        readonly email: string
        readonly image: string | undefined
      }
    | undefined
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
      readonly user?:
        | {
            readonly id: string
            readonly name: string
            readonly email: string
            readonly image: string | undefined
          }
        | undefined
    }
  },
  SessionContextError
> {
  return Effect.gen(function* () {
    const { session, tableId, recordId, tableName, content } = config

    // Check if record exists and is owned by user
    const hasAccess = yield* checkRecordOwnership({ session, tableName, recordId })
    if (!hasAccess) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    // Create comment
    const comment = yield* createComment({ session, tableId, recordId, content })

    // Fetch comment with user metadata
    const commentWithUser = yield* getCommentWithUser({ session, commentId: comment.id })

    // Format response
    return formatCommentResponse(commentWithUser ?? comment)
  })
}

/**
 * Delete comment configuration
 */
interface DeleteCommentConfig {
  readonly session: Readonly<Session>
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
): Effect.Effect<void, SessionContextError> {
  return Effect.gen(function* () {
    const { session, commentId, tableName } = config

    // Get comment for authorization check
    const comment = yield* getCommentForAuth({ session, commentId })

    if (!comment) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    // Check record ownership (user must have access to the record)
    const hasRecordAccess = yield* checkRecordOwnership({
      session,
      tableName,
      recordId: comment.recordId,
    })

    if (!hasRecordAccess) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    // Get current user to check role
    const currentUser = yield* getUserById({ session, userId: session.userId })

    if (!currentUser) {
      return yield* Effect.fail(new SessionContextError('User not found'))
    }

    // Check authorization: user is comment author OR user is admin
    const isAuthor = comment.userId === session.userId
    const isAdmin = currentUser.role === 'admin'

    if (!isAuthor && !isAdmin) {
      // User has record access but is not the comment author and not an admin
      // Return 403 Forbidden to explicitly deny the operation
      return yield* Effect.fail(new SessionContextError('Forbidden'))
    }

    // Delete comment (soft delete)
    yield* deleteComment({ session, commentId })
  })
}

/**
 * Get comment by ID configuration
 */
interface GetCommentConfig {
  readonly session: Readonly<Session>
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
      readonly user?:
        | {
            readonly id: string
            readonly name: string
            readonly email: string
            readonly image: string | undefined
          }
        | undefined
    }
  },
  SessionContextError
> {
  return Effect.gen(function* () {
    const { session, commentId, tableName } = config

    // Get comment with user metadata
    const comment = yield* getCommentWithUser({ session, commentId })

    if (!comment) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    // Check record ownership
    const hasRecordAccess = yield* checkRecordOwnership({
      session,
      tableName,
      recordId: comment.recordId,
    })

    if (!hasRecordAccess) {
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
  readonly session: Readonly<Session>
  readonly recordId: string
  readonly tableName: string
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
      readonly user?:
        | {
            readonly id: string
            readonly name: string
            readonly email: string
            readonly image: string | undefined
          }
        | undefined
    }[]
  },
  SessionContextError
> {
  return Effect.gen(function* () {
    const { session, recordId, tableName } = config

    // Check record ownership
    const hasRecordAccess = yield* checkRecordOwnership({
      session,
      tableName,
      recordId,
    })

    if (!hasRecordAccess) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    // List comments
    const comments = yield* listComments({ session, recordId })

    // Format response
    return {
      comments: comments.map((comment) => ({
        id: comment.id,
        tableId: comment.tableId,
        recordId: comment.recordId,
        userId: comment.userId,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        user: comment.user,
      })),
    }
  })
}
