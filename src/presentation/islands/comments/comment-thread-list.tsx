/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows of a comment thread. Extracted from the main island file to respect
 * the per-island `max-lines: 250` cap, as `comment-thread-controls` already is.
 */

import { Fragment, type ReactElement } from 'react'
import { CommentThreadItem } from './comment-thread-item'
import type { CommentsListResponse } from './comment-thread-types'

export interface CommentListProps {
  readonly comments: CommentsListResponse['comments']
  readonly currentUserId?: string
  readonly currentUserIsAdmin?: boolean
  readonly threading: boolean
  readonly isSaving: boolean
  readonly isDeleting: boolean
  readonly isReplying: boolean
  readonly onSaveEdit: (id: string, content: string) => Promise<void>
  readonly onConfirmDelete: (id: string) => Promise<void>
  readonly onSubmitReply: (parentCommentId: string, content: string) => Promise<void>
}

function renderItem(
  comment: CommentsListResponse['comments'][number],
  props: CommentListProps
): ReactElement {
  const {
    currentUserId,
    currentUserIsAdmin,
    threading,
    isSaving,
    isDeleting,
    isReplying,
    onSaveEdit,
    onConfirmDelete,
    onSubmitReply,
  } = props
  const isAuthor = Boolean(currentUserId && comment.userId === currentUserId)
  const isTopLevel = comment.parentCommentId === null
  const canReply = threading && isTopLevel && Boolean(currentUserId)
  const replyCount = isTopLevel
    ? props.comments.filter((c) => c.parentCommentId === comment.id).length
    : undefined
  return (
    <CommentThreadItem
      key={comment.id}
      comment={comment}
      canEdit={isAuthor}
      canDelete={isAuthor || Boolean(currentUserIsAdmin)}
      canReply={canReply}
      isSaving={isSaving}
      isDeleting={isDeleting}
      isReplying={isReplying}
      replyCount={replyCount}
      onSaveEdit={onSaveEdit}
      onConfirmDelete={onConfirmDelete}
      onSubmitReply={onSubmitReply}
    />
  )
}

/**
 * The rows of the thread, in reading order.
 *
 * A reply follows its parent as a SIBLING row rather than as a list nested
 * inside it: the frame separates its rows with one rule apiece, and a nested
 * `<ul>` would break that rule at the parent's own padding instead of running
 * the width of the frame. The reply's indent is carried by
 * `computeCommentItemClasses({ depth: 1 })`, whose 34px is measured from the
 * frame's left edge — the avatar plus its gap — so a reply's text starts
 * exactly where its parent's text starts.
 */
export function CommentList(props: CommentListProps): ReactElement {
  const { comments, threading } = props
  // When threading is off OR no parentCommentId exists, render flat (preserves
  // pre-PG-02 behavior — [internal ref]).
  if (!threading) {
    return <ul>{comments.map((c) => renderItem(c, props))}</ul>
  }
  const topLevel = comments.filter((c) => c.parentCommentId === null)
  return (
    <ul>
      {topLevel.map((parent) => (
        <Fragment key={parent.id}>
          {renderItem(parent, props)}
          {comments
            .filter((c) => c.parentCommentId === parent.id)
            .map((reply) => renderItem(reply, props))}
        </Fragment>
      ))}
    </ul>
  )
}
