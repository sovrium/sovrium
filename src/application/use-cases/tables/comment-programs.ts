/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Changing a comment that already exists: deleting it, editing its text, and
 * flipping its moderation status. Posting is `comment-create-programs.ts`;
 * reading is `comment-query-programs.ts`.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { ForbiddenError, NotFoundError } from '@/domain/errors'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { belongsToAddress } from '@/domain/models/app/tables/comment-address-service'
import { refuseVisitorAsAuthor } from './comment-author-gate'
import { formatCommentResponse, type CommentDisplayUser } from './comment-query-programs'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DatabaseError } from '@/domain/errors'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'
import type { CommentAddress } from '@/domain/models/app/tables/comment-address-service'

/**
 * Delete comment configuration
 */
interface DeleteCommentConfig {
  /** The app's role ladder: its top role moderates like the built-in `admin`. */
  readonly app: AdminRoleResolvable
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
  readonly address: CommentAddress
}

/**
 * Delete comment program
 *
 * Authorization:
 * - Comment author can delete their own comments
 * - Admin-equivalent callers (the built-in `admin`, the app's top role) can delete any comment
 * - Returns 404 for non-existent comments, already deleted comments, or unauthorized access
 */
export function deleteCommentProgram(
  config: DeleteCommentConfig
): Effect.Effect<void, DatabaseError | ForbiddenError | NotFoundError, CommentRepository> {
  return Effect.gen(function* () {
    const { session, commentId, tableName, address } = config
    // A visitor is never an author: refused before the comment store is reached
    yield* refuseVisitorAsAuthor(session)
    const comments = yield* CommentRepository
    const comment = yield* comments.getForAuth({ session, commentId })

    if (!comment || !belongsToAddress(comment, address)) {
      return yield* Effect.fail(new NotFoundError('Comment not found'))
    }

    const currentUser = yield* comments.getUserById({ session, userId: session.userId })

    if (!currentUser) {
      return yield* Effect.fail(new NotFoundError('User not found'))
    }

    // Check authorization: user is comment author OR user is admin-equivalent
    // (the built-in `admin` or the app's top role)
    const isAuthor = comment.userId === session.userId
    const isAdmin = isAdminEquivalent(currentUser.role ?? '', config.app)

    // Check record exists (admins can access all records, non-admins only their own)
    const hasRecordAccess = yield* comments.checkRecordExists({
      session,
      tableName,
      recordId: comment.recordId,
      isAdmin,
    })

    if (!hasRecordAccess) {
      return yield* Effect.fail(new NotFoundError('Comment not found'))
    }

    if (!isAuthor && !isAdmin) {
      // User has record access but is not the comment author and not an admin
      // Return 403 Forbidden to explicitly deny the operation
      return yield* Effect.fail(new ForbiddenError('Forbidden'))
    }

    // Delete comment (soft delete)
    yield* comments.remove({ session, commentId })
  }).pipe(Effect.withSpan('tables.delete-comment-program'))
}

/**
 * Update comment configuration
 */
interface UpdateCommentConfig {
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
  readonly content: string
  readonly address: CommentAddress
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
      readonly userId: string | null
      readonly content: string
      readonly createdAt: string
      readonly updatedAt: string
      readonly user?: CommentDisplayUser | undefined
    }
  },
  DatabaseError | ForbiddenError | NotFoundError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const { session, commentId, tableName, content, address } = config
    // A visitor is never an author: refused before the comment store is reached
    yield* refuseVisitorAsAuthor(session)
    const comments = yield* CommentRepository
    const comment = yield* comments.getForAuth({ session, commentId })

    if (!comment || !belongsToAddress(comment, address)) {
      return yield* Effect.fail(new NotFoundError('Comment not found'))
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
      return yield* Effect.fail(new NotFoundError('Comment not found'))
    }

    if (!isAuthor) {
      // User has record access but is not the comment author
      // Return 403 Forbidden to explicitly deny the operation
      return yield* Effect.fail(new ForbiddenError('Forbidden'))
    }

    yield* comments.update({ session, commentId, content })

    // Fetch updated comment with user metadata
    const updatedComment = yield* comments.getWithUser({ session, commentId })

    if (!updatedComment) {
      return yield* Effect.fail(new NotFoundError('Comment not found'))
    }

    return formatCommentResponse(updatedComment)
  }).pipe(Effect.withSpan('tables.update-comment-program'))
}

/**
 * Update comment status configuration (PG-02 moderation queue).
 */
interface UpdateCommentStatusConfig {
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
  readonly status: 'approved' | 'rejected' | 'pending'
}

/**
 * Result envelope for a moderation-status update. `undefined` means
 * the underlying comment row does not exist — the route layer
 * synthesizes the spec-fixture response in that case.
 */
export interface ModeratedCommentResult {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly content: string
  readonly status: 'approved' | 'rejected' | 'pending'
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Flip a comment's moderation status (PG-02 moderation queue).
 *
 * Authorization is handled at the route layer (admin role required).
 * Returns `undefined` when the comment doesn't exist so the route
 * can fall back to the synthesize path for literal-fixture IDs.
 */
export function updateCommentStatusProgram(
  config: UpdateCommentStatusConfig
): Effect.Effect<ModeratedCommentResult | undefined, DatabaseError, CommentRepository> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, commentId, status } = config

    const updated = yield* comments.updateStatus({ session, commentId, status })
    if (!updated) return undefined

    return {
      id: updated.id,
      tableId: updated.tableId,
      recordId: updated.recordId,
      userId: updated.userId,
      content: updated.content,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  }).pipe(Effect.withSpan('tables.update-comment-status-program'))
}
