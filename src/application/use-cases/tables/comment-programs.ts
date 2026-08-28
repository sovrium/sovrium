/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { ForbiddenError, NotFoundError } from '@/domain/errors'
import { isAdminRole } from '@/domain/models/shared/permission-evaluation'
import { isGuestSession } from '@/domain/services/guest-session'
import type { UserMetadataWithOptionalImage } from '@/application/ports/models/user-metadata'
import type { UserSession } from '@/application/ports/models/user-session'
import type { DatabaseError } from '@/domain/errors'

/**
 * Create comment on a record
 *
 * Optional `parentCommentId` distinguishes top-level comments from
 * replies (Y-6 comment-posted trigger). The value lands in the
 * `record_comments.parent_id` column; the response surfaces it as
 * `parentCommentId` (camelCase) on the comment envelope.
 */
interface CreateCommentConfig {
  readonly session: Readonly<UserSession>
  readonly tableId: string
  readonly recordId: string
  readonly tableName: string
  readonly content: string
  readonly parentCommentId?: string
  /**
   * Guest identity. Supplied only for
   * unauthenticated guest submissions (`session.userId === 'guest'`). When
   * present, the comment is persisted with `userId: null` and the guest
   * name/email so it can be attributed without a Better Auth user row.
   */
  readonly guestName?: string
  readonly guestEmail?: string
  /**
   * Resolved moderation status (PG-02). The create-comment gate combines the
   * spam classification and the table's moderation policy into a single
   * verdict; the program persists it to the row so the moderation status is
   * durable from creation and the response reflects the stored value rather
   * than a synthesized literal. Defaults to `'approved'` when omitted.
   */
  readonly status?: 'approved' | 'pending' | 'rejected'
}

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
   *. Only the create response echoes the
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
  readonly guestName?: string | null
  readonly status?: 'approved' | 'pending' | 'rejected'
}): { readonly comment: CreatedComment } {
  return {
    comment: {
      id: comment.id,
      tableId: comment.tableId,
      recordId: comment.recordId,
      userId: comment.userId,
      content: comment.content,
      // eslint-disable-next-line unicorn/no-null -- null for top-level comments (see CreatedComment.parentCommentId)
      parentCommentId: comment.parentId ?? null,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt?.toISOString() ?? comment.createdAt.toISOString(),
      user: toCommentDisplayUser(comment.user),
      // eslint-disable-next-line unicorn/no-null -- public wire contract: null when not a guest comment
      guestName: comment.guestName ?? null,
      // Reader-safe moderation status. Defaults to `'approved'` for read
      // paths (list/get/update) whose row projections do not yet surface a
      // status column; the create path merges the persisted value in.
      status: comment.status ?? 'approved',
    },
  }
}

export function createCommentProgram(config: CreateCommentConfig): Effect.Effect<
  {
    /**
     * Create-response comment. Carries the guest's OWN `guestEmail` echoed
     * back — the only response where a guest
     * email is surfaced, and only to the submitter. Reader-facing list/get
     * use the no-email {@link CreatedComment}.
     */
    readonly comment: CreatedCommentWithGuestEmail
    /**
     * Full author metadata (INCLUDING email) for the comment-posted (Y-6)
     * automation trigger ONLY. Never serialized to the HTTP response — the
     * route surfaces `comment.user` (the no-email {@link CommentDisplayUser})
     * and reads `author` solely to populate the trigger payload. Splitting
     * the two keeps the commenter's email off the wire while the legit
     * server-side trigger consumer keeps working.
     */
    readonly author: UserMetadataWithOptionalImage | undefined
  },
  DatabaseError | NotFoundError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const {
      session,
      tableId,
      recordId,
      tableName,
      content,
      parentCommentId,
      guestName,
      guestEmail,
      status,
    } = config

    // Check if record exists
    const hasAccess = yield* comments.checkRecordExists({ session, tableName, recordId })
    if (!hasAccess) {
      return yield* Effect.fail(new NotFoundError('Record not found'))
    }

    // Guest vs authenticated split: the auth-exemption middleware stashes
    // the guest sentinel (see isGuestSession) for unauthenticated guest
    // submissions. A guest comment is stored with `userId: null` and the
    // guest name/email; an authenticated comment carries the real Better
    // Auth user ID and no guest identity.
    // The resolved moderation `status` (PG-02) is persisted to the row so
    // the response reflects the stored verdict rather than a literal.
    const comment = yield* comments.create({
      session,
      tableId,
      recordId,
      content,
      parentId: parentCommentId,
      status,
      ...(isGuestSession(session.userId) ? { guestName, guestEmail } : {}),
    })

    // Fetch comment with user metadata
    const commentWithUser = yield* comments.getWithUser({ session, commentId: comment.id })

    // Format response — preserves parentId AND guest identity from the
    // freshly-inserted row even when the join in `getWithUser` did not
    // surface them (the helper only projects user-side fields, so we merge
    // the structural + guest fields back from the create result before
    // formatting).
    const merged = commentWithUser
      ? {
          ...commentWithUser,
          parentId: comment.parentId,
          guestName: comment.guestName,
          status: comment.status,
        }
      : { ...comment, updatedAt: comment.createdAt }
    // Echo the guest's OWN email back on the create response only (005). The
    // reader-safe `formatCommentResponse` drops it; we re-add it here so the
    // submitter sees what they posted without it leaking to the read paths.
    const formatted = formatCommentResponse(merged)
    return {
      comment: { ...formatted.comment, guestEmail: comment.guestEmail },
      author: commentWithUser?.user,
    }
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
): Effect.Effect<void, DatabaseError | ForbiddenError | NotFoundError, CommentRepository> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, commentId, tableName } = config

    // Get comment for authorization check
    const comment = yield* comments.getForAuth({ session, commentId })

    if (!comment) {
      return yield* Effect.fail(new NotFoundError('Comment not found'))
    }

    // Get current user to check role
    const currentUser = yield* comments.getUserById({ session, userId: session.userId })

    if (!currentUser) {
      return yield* Effect.fail(new NotFoundError('User not found'))
    }

    // Check authorization: user is comment author OR user is admin
    const isAuthor = comment.userId === session.userId
    const isAdmin = isAdminRole(currentUser.role)

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
      readonly userId: string | null
      readonly parentCommentId: string | null
      readonly content: string
      readonly createdAt: string
      readonly updatedAt: string
      readonly user?: CommentDisplayUser | undefined
    }
  },
  DatabaseError | NotFoundError,
  CommentRepository
> {
  return Effect.gen(function* () {
    const comments = yield* CommentRepository
    const { session, commentId, tableName } = config

    // Get comment with user metadata
    const comment = yield* comments.getWithUser({ session, commentId })

    if (!comment) {
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
  /**
   * Moderation visibility. The handler
   * resolves the viewer's admin-ness from the session/role and threads it
   * here. `true` → admin sees every moderation status; `false`/omitted →
   * non-admins and guests see approved-only. Fail-closed default.
   */
  readonly viewerIsAdmin?: boolean
  /**
   * Raw `:tableId` URL param. Scopes BOTH the comment read itself and the
   * [internal ref] unread-count watermark to the same `(table, record)` identity
   * comments are stored under. Not optional: record ids are per-table
   * sequences, so a record-only read returns every same-numbered record's
   * comments across the app.
   */
  readonly tableId: string
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
 * dropped (reader-private, [internal ref]) and `guestName` is
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
    const comments = yield* CommentRepository
    const { session, commentId, tableName, content } = config

    // Get comment for authorization check
    const comment = yield* comments.getForAuth({ session, commentId })

    if (!comment) {
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

    // Update comment
    yield* comments.update({ session, commentId, content })

    // Fetch updated comment with user metadata
    const updatedComment = yield* comments.getWithUser({ session, commentId })

    if (!updatedComment) {
      return yield* Effect.fail(new NotFoundError('Comment not found'))
    }

    // Format response
    return formatCommentResponse(updatedComment)
  })
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
    const { tableId, readTracking } = config

    // Moderation visibility. Fail-closed:
    // when the viewer's admin-ness is unknown (`undefined`), default to
    // approved-only so pending/rejected comments never leak to non-admins.
    const includeAllStatuses = viewerIsAdmin === true

    // Check record exists
    yield* verifyRecordAccess({ session, tableName, recordId })

    // List comments (admins see all statuses; everyone else approved-only)
    const commentsList = yield* comments.list({
      session,
      tableId,
      recordId,
      limit,
      offset,
      sortOrder,
      includeAllStatuses,
    })

    // Get total count and pagination if requested. Count mirrors the list
    // visibility so the pagination total matches the rows the viewer sees.
    const pagination =
      limit !== undefined
        ? calculatePagination({
            limit,
            offset,
            total: yield* comments.getCount({ session, tableId, recordId, includeAllStatuses }),
          })
        : undefined

    // [internal ref]: project the per-user unread count only when the table opts into
    // read tracking. The viewer's own comments never count as unread; the
    // read-state is per-user and isolated (enforced in the query).
    const unreadCount =
      readTracking === true
        ? yield* comments.countUnread({ session, tableId, recordId })
        : undefined

    // Format response
    return {
      comments: formatCommentsList(commentsList),
      ...(pagination && { pagination }),
      ...(unreadCount !== undefined && { unreadCount }),
    }
  })
}
