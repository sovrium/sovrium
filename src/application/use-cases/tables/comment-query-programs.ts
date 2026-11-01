/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading a record's comments: one comment by id, and the thread.
 *
 * Also home of the reader-safe response shape every comment verb projects
 * (`formatCommentResponse`), so the create, change and read programs cannot
 * drift apart on which author fields reach the wire.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { NotFoundError } from '@/domain/errors'
import { belongsToAddress } from '@/domain/models/app/tables/comment-address-service'
import type { UserMetadataWithOptionalImage } from '@/application/ports/contracts/user-metadata'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DatabaseError } from '@/domain/errors'
import type { CommentAddress } from '@/domain/models/app/tables/comment-address-service'

/**
 * Reader-exposed comment author shape.
 *
 * Deliberately a NO-EMAIL projection of {@link UserMetadataWithOptionalImage}.
 * Comment list/detail responses are reader-exposed (any role with table read
 * permission can fetch them), so the commenter's email must never reach the
 * wire. The author email is still available server-side (the create program
 * resolves the full {@link UserMetadataWithOptionalImage} so the comment-posted
 * trigger can populate `{{trigger.author.email}}`); it is only dropped at the
 * response-shaping boundary below.
 */
export interface CommentDisplayUser {
  readonly id: string
  readonly name: string
  readonly image: string | undefined
}

/**
 * Project a full user-metadata record down to the reader-safe display shape,
 * dropping `email`. The single choke point that keeps commenter emails off
 * the comment API responses.
 */
function toCommentDisplayUser(
  user: UserMetadataWithOptionalImage | undefined
): CommentDisplayUser | undefined {
  return user ? { id: user.id, name: user.name, image: user.image } : undefined
}

/**
 * Comment shape the program returns. Includes the optional `parentCommentId`
 * so the comment-create handler can hand it to the comment-posted trigger
 * without re-querying. `null` (rather than `undefined`) is the public wire
 * contract for top-level comments — see the `comment-posted` trigger spec
 * (Y-6) which asserts `{{trigger.comment.parentCommentId}}` renders as an
 * empty string when null.
 *
 * `user` is the reader-safe {@link CommentDisplayUser} (no email).
 */
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
  /**
   * Guest display name. `null` for
   * authenticated comments; the guest name for guest comments. Reader-safe —
   * surfaced on every comment response so the guest can be attributed in the
   * thread.
   *
   * `guestEmail` is deliberately NOT on this shape: it is reader-private
   * Only the create response echoes the
   * guest's OWN email back to them (005) via {@link CreatedCommentWithGuestEmail}.
   */
  readonly guestName: string | null
  /**
   * Persisted moderation status (PG-02). Mirrors the value written to the
   * `record_comments.status` column at create time. `'approved'` for
   * non-moderated tables; `'pending'`/`'rejected'` when the moderation
   * policy or spam guard flags the comment. Reader-safe.
   */
  readonly status: 'approved' | 'pending' | 'rejected'
}

/**
 * Create-response comment shape. Extends the reader-safe {@link CreatedComment}
 * with the guest's `guestEmail` — echoed back ONLY on the create response so
 * the guest can confirm what they submitted.
 * Never used for reader-facing list/get/update responses.
 */
export interface CreatedCommentWithGuestEmail extends CreatedComment {
  readonly guestEmail: string | null
}

/**
 * Format comment into the reader-safe response shape (no `guestEmail`).
 *
 * Reader-safe is the DEFAULT (fail-closed): list, get, and update all surface
 * this shape directly. The create program is the only caller that re-adds
 * `guestEmail` on top (see {@link createCommentProgram}).
 */
export function formatCommentResponse(comment: {
  readonly id: string
  readonly tableId: string
  readonly recordId: string
  readonly userId: string | null
  readonly content: string
  readonly parentId?: string | null
  readonly createdAt: Date
  readonly updatedAt?: Date
  readonly user?: UserMetadataWithOptionalImage | undefined
  readonly guestName?: string | null
  readonly status: 'approved' | 'pending' | 'rejected'
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
      guestName: comment.guestName ?? null,
      // The stored moderation status — every read path projects the column,
      // so the label is the truth, never a default.
      status: comment.status,
    },
  }
}

/**
 * Get comment by ID configuration
 */
interface GetCommentConfig {
  readonly session: Readonly<UserSession>
  readonly commentId: string
  readonly tableName: string
  readonly address: CommentAddress
  /**
   * Moderation visibility, the thread's rule:
   * `true` reads every status; `false`/omitted reads an approved comment only,
   * and a pending or rejected one fails exactly as a missing one. Fail-closed.
   */
  readonly viewerIsAdmin?: boolean
}

/**
 * Get comment by ID program
 */
export function getCommentProgram(
  config: GetCommentConfig
): Effect.Effect<
  { readonly comment: CreatedComment },
  DatabaseError | NotFoundError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, commentId, tableName, address, viewerIsAdmin } = config

    // Get comment with user metadata
    const comment = yield* comments.getWithUser({ session, commentId })

    // A comment the thread would hide from this reader is, to her, a comment
    // that does not exist: the same failure, so the same 404.
    const hiddenByModeration = comment?.status !== 'approved' && viewerIsAdmin !== true

    if (!comment || !belongsToAddress(comment, address) || hiddenByModeration) {
      return yield* Effect.fail(new NotFoundError('Comment not found'))
    }

    // Check record exists (isAdmin: true because table-level read permission already validated by handler)
    const recordExists = yield* comments.checkRecordExists({
      session,
      tableName,
      recordId: comment.recordId,
      isAdmin: true,
    })

    if (!recordExists) {
      return yield* Effect.fail(new NotFoundError('Comment not found'))
    }

    // Format response. `formatCommentResponse` is reader-safe (no
    // `guestEmail`) by default; the GET-single-comment endpoint is
    // reader-facing so we surface that shape directly. `guestEmail` is
    // reader-private.
    return formatCommentResponse(comment)
  }).pipe(Effect.withSpan('tables.get-comment-program'))
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
  /**
   * Moderation visibility. The handler
   * resolves the viewer's admin-ness from the session/role and threads it
   * here. `true` → admin sees every moderation status; `false`/omitted →
   * non-admins and guests see approved-only. Fail-closed default.
   */
  readonly viewerIsAdmin?: boolean
  /**
   * Every key the thread's comments may be stored under (`commentTableKeysOf`):
   * a comment keeps the id or name it was posted through, so the list, its
   * count and the unread-count watermark read under all of them. Not optional:
   * record ids are per-table sequences, so a record-only read returns every
   * same-numbered record's comments across the app.
   */
  readonly tableKeys: readonly string[]
  /**
   * Opt-in per-user read tracking. When `true` the response carries
   * an `unreadCount`; when omitted/false the feature is inert (no read-state
   * queried, no `unreadCount` key projected).
   */
  readonly readTracking?: boolean
}

/**
 * Format list of comments.
 *
 * Reuses {@link formatCommentResponse} so list/get/create all project the same
 * reader-safe {@link CreatedComment} shape from one place — `guestEmail` is
 * dropped (reader-private, a pages public comments spec) and `guestName` is
 * surfaced (006).
 */
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
    readonly guestName?: string | null
    readonly status: 'approved' | 'pending' | 'rejected'
  }[]
): readonly CreatedComment[] {
  return comments.map((comment) => formatCommentResponse(comment).comment)
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
}): Effect.Effect<void, DatabaseError | NotFoundError, CommentRepository> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const hasAccess = yield* comments.checkRecordExists(params)
    if (!hasAccess) {
      return yield* Effect.fail(new NotFoundError('Record not found'))
    }
  })
}

/**
 * List comments program
 */
export function listCommentsProgram(config: ListCommentsConfig): Effect.Effect<
  {
    readonly comments: readonly CreatedComment[]
    readonly pagination?: {
      readonly total: number
      readonly limit: number
      readonly offset: number
      readonly hasMore: boolean
    }
    /** Per-user unread count; present only under `readTracking`. */
    readonly unreadCount?: number
  },
  DatabaseError | NotFoundError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, recordId, tableName, limit, offset, sortOrder, viewerIsAdmin } = config
    const { tableKeys, readTracking } = config

    // Moderation visibility. Fail-closed:
    // when the viewer's admin-ness is unknown (`undefined`), default to
    // approved-only so pending/rejected comments never leak to non-admins.
    const includeAllStatuses = viewerIsAdmin === true
    const visibility = { includeAllStatuses, ownPending: true } as const

    // Check record exists
    yield* verifyRecordAccess({ session, tableName, recordId })

    // List comments (admins see all statuses; everyone else approved, and her own pending)
    const commentsList = yield* comments.list({
      session,
      tableKeys,
      recordId,
      limit,
      offset,
      sortOrder,
      ...visibility,
    })

    // Get total count and pagination if requested. Count mirrors the list
    // visibility so the pagination total matches the rows the viewer sees.
    const pagination =
      limit !== undefined
        ? calculatePagination({
            limit,
            offset,
            total: yield* comments.getCount({ session, tableKeys, recordId, ...visibility }),
          })
        : undefined

    // Project the per-user unread count only when the table opts into
    // read tracking. The viewer's own comments never count as unread; the
    // read-state is per-user and isolated (enforced in the query).
    const unreadCount =
      readTracking === true
        ? yield* comments.countUnread({ session, tableKeys, recordId })
        : undefined

    return {
      comments: formatCommentsList(commentsList),
      ...(pagination && { pagination }),
      ...(unreadCount !== undefined && { unreadCount }),
    }
  }).pipe(Effect.withSpan('tables.list-comments-program'))
}
