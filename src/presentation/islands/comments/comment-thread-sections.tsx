/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeCommentActionClasses,
  computeCommentEmptyClasses,
  computeCommentPagerClasses,
  computeCommentSignedOutClasses,
} from '@/presentation/design/comments-default-classes'
import { NumberedPagination } from './comment-thread-controls'
import { CommentThreadForm } from './comment-thread-form'
import { CommentList } from './comment-thread-list'
import type { CommentThreadIslandProps } from './comment-thread-types'
import type { CommentThreadState } from './use-comment-thread'
import type { ReactElement } from 'react'

/**
 * The three regions of a comment thread below its sort bar: the comments (or
 * the empty note), the pager, and the composer (or the sign-in prompt). Each
 * draws one state of {@link CommentThreadState} and owns none.
 */

/** The comments, or the empty note when there are none to show. */
export function CommentThreadBody({
  thread,
  props,
}: {
  readonly thread: CommentThreadState
  readonly props: CommentThreadIslandProps
}): ReactElement | undefined {
  const { editMutation, deleteMutation, replyMutation } = thread.mutations
  if (thread.visible.length === 0) {
    if (props.hideEmptyText === true) return undefined
    return (
      <p
        data-comments-empty-state=""
        className={computeCommentEmptyClasses()}
      >
        {props.emptyText}
      </p>
    )
  }
  return (
    <CommentList
      comments={thread.visible}
      currentUserId={props.currentUserId}
      currentUserIsAdmin={props.currentUserIsAdmin}
      threading={props.threading === true}
      isSaving={editMutation.isPending}
      isDeleting={deleteMutation.isPending}
      isReplying={replyMutation.isPending}
      onSaveEdit={(commentId, content) =>
        editMutation.mutateAsync({ commentId, content }).then(() => undefined)
      }
      onConfirmDelete={(commentId) => deleteMutation.mutateAsync(commentId).then(() => undefined)}
      onSubmitReply={(parentCommentId, content) =>
        replyMutation.mutateAsync({ parentCommentId, content }).then(() => undefined)
      }
    />
  )
}

/**
 * The pager. For `loadMore` it is THE SENTINEL alone: reaching the last row is
 * the reader's request for the next page, so there is no button, because
 * pressing one to continue reading is the interruption the scroll removes.
 * Rendered ONLY while there is more to fetch, so an exhausted thread has
 * nothing left to observe — "the end of the list" and "stop asking" are one
 * state rather than two that could disagree. It sits after the list and before
 * the form, which is where the older end of the thread is.
 */
export function CommentThreadPager({
  thread,
  paginationStyle,
}: {
  readonly thread: CommentThreadState
  readonly paginationStyle: CommentThreadIslandProps['paginationStyle']
}): ReactElement | undefined {
  const { pagination } = thread
  if (paginationStyle === 'loadMore' && pagination?.hasMore === true) {
    return (
      <div
        ref={thread.sentinelRef}
        data-comments-sentinel=""
        aria-hidden="true"
        className={computeCommentPagerClasses()}
      />
    )
  }
  if (paginationStyle !== 'numbered' || pagination === undefined) return undefined
  return (
    <div className={computeCommentPagerClasses()}>
      <NumberedPagination
        total={pagination.total}
        limit={pagination.limit}
        offset={pagination.offset}
        onSelect={thread.goToOffset}
      />
    </div>
  )
}

/** The composer for a signed-in reader; a sign-in link for anyone else. */
export function CommentThreadComposer({
  thread,
  props,
}: {
  readonly thread: CommentThreadState
  readonly props: CommentThreadIslandProps
}): ReactElement {
  const { createMutation } = thread.mutations
  if (props.currentUserId || props.signedIn === true) {
    return (
      <CommentThreadForm
        placeholder={props.placeholder}
        isSubmitting={createMutation.isPending}
        onSubmit={(content) => createMutation.mutateAsync(content).then(() => undefined)}
      />
    )
  }
  return (
    <p className={computeCommentSignedOutClasses()}>
      <a
        href="/sign-in"
        className={computeCommentActionClasses()}
      >
        Sign in to comment
      </a>
    </p>
  )
}
