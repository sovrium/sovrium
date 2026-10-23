/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import {
  CommentChangeFeed,
  type CommentChange,
} from '@/application/ports/services/comment-change-feed'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DatabaseError } from '@/domain/errors'

/** Announce a change to a record's comment thread on its live feed. */
export const announceCommentChange = (change: CommentChange): Effect.Effect<void> =>
  Effect.gen(function* () {
    const feed = yield* CommentChangeFeed
    yield* feed.announce(change)
  }).pipe(Effect.withSpan('tables.announce-comment-change'))

/**
 * Who a comment's change may be announced to before it changes: its status
 * and author, or nothing for a comment that does not exist.
 */
export const commentAudienceProgram = (
  session: Readonly<UserSession>,
  commentId: string
): Effect.Effect<
  Pick<CommentChange, 'status' | 'authorId'> | undefined,
  DatabaseError,
  CommentRepository
> =>
  Effect.gen(function* () {
    const comments = yield* CommentRepository
    const comment = yield* comments.getForAuth({ session, commentId })
    return comment === undefined ? undefined : { status: comment.status, authorId: comment.userId }
  }).pipe(Effect.withSpan('tables.comment-audience'))
