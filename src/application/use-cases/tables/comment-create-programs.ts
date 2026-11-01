/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Posting a comment on a record — the program the post flow and the
 * comment-posted trigger build on.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { NotFoundError } from '@/domain/errors'
import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { formatCommentResponse, type CreatedCommentWithGuestEmail } from './comment-query-programs'
import type { UserMetadataWithOptionalImage } from '@/application/ports/contracts/user-metadata'
import type { UserSession } from '@/application/ports/contracts/user-session'
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
  /** The resolved moderation verdict (PG-02), persisted to the row; `'approved'` when omitted. */
  readonly status?: 'approved' | 'pending' | 'rejected'
  /** `'system'`: the app writes it, with no author account, and reaches any live record. */
  readonly actor?: 'session' | 'system'
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
    const { session, tableId, recordId, tableName, content, parentCommentId } = config
    const { guestName, guestEmail, status, actor } = config

    // Check if record exists (the app's own comment reaches any live record)
    const hasAccess = yield* comments.checkRecordExists({
      ...{ session, tableName, recordId },
      isAdmin: actor === 'system',
    })
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
      ...(actor === undefined ? {} : { actor }),
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
  }).pipe(Effect.withSpan('tables.create-comment-program'))
}
