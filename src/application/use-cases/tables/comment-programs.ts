/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { SessionContextError } from '@/domain/errors'
import type { UserMetadataWithOptionalImage } from '@/application/ports/models/user-metadata'
import type { UserSession } from '@/application/ports/models/user-session'

interface CreateCommentConfig {
  readonly session: Readonly<UserSession>
  readonly tableId: string
  readonly recordId: string
  readonly tableName: string
  readonly content: string
  readonly parentCommentId?: string
}

export interface CommentDisplayUser {
  readonly id: string
  readonly name: string
  readonly image: string | undefined
}

function toCommentDisplayUser(
  user: UserMetadataWithOptionalImage | undefined
): CommentDisplayUser | undefined {
  return user ? { id: user.id, name: user.name, image: user.image } : undefined
}

export interface CreatedComment {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly content: string
  readonly parentCommentId: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly user?: CommentDisplayUser | undefined
}

function formatCommentResponse(comment: {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly content: string
  readonly parentId?: string | null
  readonly createdAt: Date
  readonly updatedAt?: Date
  readonly user?: UserMetadataWithOptionalImage | undefined
}): { readonly comment: CreatedComment } {
  return {
    comment: {
      id: comment.id,
      tableId: comment.tableId,
      recordId: comment.recordId,
      userId: comment.userId,
      content: comment.content,
      parentCommentId: comment.parentId ?? null,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt?.toISOString() ?? comment.createdAt.toISOString(),
      user: toCommentDisplayUser(comment.user),
    },
  }
}

export function createCommentProgram(config: CreateCommentConfig): Effect.Effect<
  {
    readonly comment: CreatedComment
    readonly author: UserMetadataWithOptionalImage | undefined
  },
  SessionContextError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, tableId, recordId, tableName, content, parentCommentId } = config

    const hasAccess = yield* comments.checkRecordExists({ session, tableName, recordId })
    if (!hasAccess) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    const comment = yield* comments.create({
      session,
      tableId,
      recordId,
      content,
      parentId: parentCommentId,
    })

    const commentWithUser = yield* comments.getWithUser({ session, commentId: comment.id })

    const merged = commentWithUser
      ? { ...commentWithUser, parentId: comment.parentId }
      : { ...comment, updatedAt: comment.createdAt }
    return { ...formatCommentResponse(merged), author: commentWithUser?.user }
  })
}

interface DeleteCommentConfig {
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
}

export function deleteCommentProgram(
  config: DeleteCommentConfig
): Effect.Effect<void, SessionContextError, CommentRepository> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, commentId, tableName } = config

    const comment = yield* comments.getForAuth({ session, commentId })

    if (!comment) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    const currentUser = yield* comments.getUserById({ session, userId: session.userId })

    if (!currentUser) {
      return yield* Effect.fail(new SessionContextError('User not found'))
    }

    const isAuthor = comment.userId === session.userId
    const isAdmin = currentUser.role === 'admin'

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
      return yield* Effect.fail(new SessionContextError('Forbidden'))
    }

    yield* comments.remove({ session, commentId })
  })
}

interface GetCommentConfig {
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
}

export function getCommentProgram(config: GetCommentConfig): Effect.Effect<
  {
    readonly comment: {
      readonly id: string
      readonly tableId: string
      readonly recordId: string
      readonly userId: string | null
      readonly parentCommentId: string | null
      readonly content: string
      readonly createdAt: string
      readonly updatedAt: string
      readonly user?: CommentDisplayUser | undefined
    }
  },
  SessionContextError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, commentId, tableName } = config

    const comment = yield* comments.getWithUser({ session, commentId })

    if (!comment) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    const recordExists = yield* comments.checkRecordExists({
      session,
      tableName,
      recordId: comment.recordId,
      isAdmin: true,
    })

    if (!recordExists) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    return formatCommentResponse(comment)
  })
}

interface ListCommentsConfig {
  readonly session: Readonly<UserSession>
  readonly recordId: string
  readonly tableName: string
  readonly limit?: number
  readonly offset?: number
  readonly sortOrder?: 'asc' | 'desc'
}

function formatCommentsList(
  comments: readonly {
    readonly id: string
    readonly tableId: string
    readonly recordId: string
    readonly userId: string | null
    readonly parentId?: string | null
    readonly content: string
    readonly createdAt: Date
    readonly updatedAt: Date
    readonly user?: UserMetadataWithOptionalImage | undefined
  }[]
): readonly {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly parentCommentId: string | null
  readonly content: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly user?: CommentDisplayUser | undefined
}[] {
  return comments.map((comment) => ({
    id: comment.id,
    tableId: comment.tableId,
    recordId: comment.recordId,
    userId: comment.userId,
    parentCommentId: comment.parentId ?? null,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    user: toCommentDisplayUser(comment.user),
  }))
}

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

interface UpdateCommentConfig {
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
  readonly content: string
}

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
  SessionContextError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, commentId, tableName, content } = config

    const comment = yield* comments.getForAuth({ session, commentId })

    if (!comment) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    const isAuthor = comment.userId === session.userId

    const hasRecordAccess = yield* comments.checkRecordExists({
      session,
      tableName,
      recordId: comment.recordId,
    })

    if (!hasRecordAccess) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    if (!isAuthor) {
      return yield* Effect.fail(new SessionContextError('Forbidden'))
    }

    yield* comments.update({ session, commentId, content })

    const updatedComment = yield* comments.getWithUser({ session, commentId })

    if (!updatedComment) {
      return yield* Effect.fail(new SessionContextError('Comment not found'))
    }

    return formatCommentResponse(updatedComment)
  })
}

interface UpdateCommentStatusConfig {
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
  readonly status: 'approved' | 'rejected' | 'pending'
}

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

export function updateCommentStatusProgram(
  config: UpdateCommentStatusConfig
): Effect.Effect<ModeratedCommentResult | undefined, SessionContextError, CommentRepository> {
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
  })
}

export function listCommentsProgram(config: ListCommentsConfig): Effect.Effect<
  {
    readonly comments: readonly {
      readonly id: string
      readonly tableId: string
      readonly recordId: string
      readonly userId: string | null
      readonly parentCommentId: string | null
      readonly content: string
      readonly createdAt: string
      readonly updatedAt: string
      readonly user?: CommentDisplayUser | undefined
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

    yield* verifyRecordAccess({ session, tableName, recordId })

    const commentsList = yield* comments.list({ session, recordId, limit, offset, sortOrder })

    const pagination =
      limit !== undefined
        ? calculatePagination({
            limit,
            offset,
            total: yield* comments.getCount({ session, recordId }),
          })
        : undefined

    return {
      comments: formatCommentsList(commentsList),
      ...(pagination && { pagination }),
    }
  })
}
