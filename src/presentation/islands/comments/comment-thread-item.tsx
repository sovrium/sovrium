/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines-per-function -- per-comment state machine renders 4 distinct modes (view/edit/confirming-delete/replying); per-handler arrow props are conventional React pattern. */

import { useState, type ReactElement } from 'react'
import {
  computeCommentActionClasses,
  computeCommentActionsClasses,
  computeCommentItemClasses,
  computeCommentTextClasses,
  computeCommentTimestampClasses,
} from '@/presentation/design/comments-default-classes'
import { CommentRow, CommentMeta, EditModeItem, DeleteModeItem } from './comment-item-parts'
import { CommentBodyText } from './comment-mention-text'
import { useCommentString } from './comment-strings'
import { CommentThreadForm } from './comment-thread-form'
import { isEdited, type CommentRecord } from './comment-thread-types'
import type { ItemMode } from './comment-item-parts'

/**
 * Renders a single comment with author + content + timestamp + (when allowed)
 * edit/delete/reply affordances. Each affordance opens an inline panel:
 *
 * - edit-mode swaps the content for a controlled textarea + Save/Cancel
 * - delete-mode emits a confirmation panel before the destructive call
 * - reply-mode opens an inline reply form below the comment body
 *
 * `canEdit` and `canDelete` are computed by the parent thread island (author
 * owns edit + delete; admin owns delete on every comment). `canReply`
 * additionally requires top-level depth + threading enabled + a signed-in
 * user — replies themselves never expose a Reply affordance (single-level
 * threading).
 *
 * A row is an avatar plus a body column, separated from its neighbours by the
 * frame's own rule rather than by a border of its own — see
 * `comments-default-classes.ts` for why a thread is ONE frame and not a stack
 * of cards. Replies are emitted by the parent island as SIBLING rows carrying
 * `depth: 1`, which is what `computeCommentItemClasses`' 34px inset measures
 * from; nesting a reply inside its parent's row is what the flat frame
 * replaces.
 */
interface CommentThreadItemProps {
  readonly comment: CommentRecord
  readonly canEdit: boolean
  readonly canDelete: boolean
  readonly canReply: boolean
  readonly onSaveEdit: (commentId: string, content: string) => Promise<void>
  readonly onConfirmDelete: (commentId: string) => Promise<void>
  readonly onSubmitReply: (parentCommentId: string, content: string) => Promise<void>
  readonly isSaving: boolean
  readonly isDeleting: boolean
  readonly isReplying: boolean
  readonly replyCount?: number
}

/**
 * The view-mode action bar (Edit / Delete / Reply). Returns `undefined`
 * when no affordance is permitted so the parent renders nothing. Extracted
 * from `CommentThreadItem` to keep that component's complexity in budget.
 */
function CommentActions({
  canEdit,
  canDelete,
  canReply,
  onSetMode,
}: {
  readonly canEdit: boolean
  readonly canDelete: boolean
  readonly canReply: boolean
  readonly onSetMode: (mode: ItemMode) => void
}): ReactElement | undefined {
  const replyLabel = useCommentString('comments.reply', 'Reply')
  if (!canEdit && !canDelete && !canReply) return undefined
  return (
    <div className={computeCommentActionsClasses()}>
      {canEdit && (
        <button
          type="button"
          onClick={() => onSetMode('editing')}
          className={computeCommentActionClasses()}
        >
          Edit
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={() => onSetMode('confirming-delete')}
          className={computeCommentActionClasses()}
        >
          Delete
        </button>
      )}
      {canReply && (
        <button
          type="button"
          onClick={() => onSetMode('replying')}
          className={computeCommentActionClasses()}
        >
          {replyLabel}
        </button>
      )}
    </div>
  )
}

/**
 * The reply count footer (top-level comments only). Returns `undefined`
 * when the comment is a reply itself or has no replies.
 */
function ReplyCount({
  isReplyItem,
  replyCount,
}: {
  readonly isReplyItem: boolean
  readonly replyCount: number | undefined
}): ReactElement | undefined {
  if (isReplyItem || replyCount === undefined || replyCount <= 0) return undefined
  return (
    <p
      data-reply-count={String(replyCount)}
      className={computeCommentTimestampClasses()}
    >
      {replyCount === 1 ? '1 reply' : `${replyCount} replies`}
    </p>
  )
}

export function CommentThreadItem({
  comment,
  canEdit,
  canDelete,
  canReply,
  onSaveEdit,
  onConfirmDelete,
  onSubmitReply,
  isSaving,
  isDeleting,
  isReplying,
  replyCount,
}: CommentThreadItemProps): ReactElement {
  const [mode, setMode] = useState<ItemMode>('view')
  const replyPlaceholder = useCommentString('comments.replyPlaceholder', 'Write a reply…')
  const isReplyItem = comment.parentCommentId !== null
  const testId = isReplyItem ? 'comment-reply' : 'comment'
  const liClassName = computeCommentItemClasses({ depth: isReplyItem ? 1 : 0 })

  if (mode === 'editing') {
    return (
      <EditModeItem
        comment={comment}
        liClassName={liClassName}
        testId={testId}
        isSaving={isSaving}
        onSaveEdit={onSaveEdit}
        onSetMode={setMode}
      />
    )
  }

  if (mode === 'confirming-delete') {
    return (
      <DeleteModeItem
        comment={comment}
        liClassName={liClassName}
        testId={testId}
        isDeleting={isDeleting}
        onConfirmDelete={onConfirmDelete}
        onSetMode={setMode}
      />
    )
  }

  return (
    <CommentRow
      comment={comment}
      testId={testId}
      className={liClassName}
    >
      <CommentMeta comment={comment} />
      <p className={computeCommentTextClasses()}>
        <CommentBodyText comment={comment} />
        {isEdited(comment) && (
          <span className={`ml-2 ${computeCommentTimestampClasses()}`}>(edited)</span>
        )}
      </p>
      <CommentActions
        canEdit={canEdit}
        canDelete={canDelete}
        canReply={canReply}
        onSetMode={setMode}
      />
      {mode === 'replying' && (
        <CommentThreadForm
          variant="reply"
          placeholder={replyPlaceholder}
          isSubmitting={isReplying}
          onSubmit={async (content) => {
            await onSubmitReply(comment.id, content)
            setMode('view')
          }}
          onCancel={() => setMode('view')}
        />
      )}
      <ReplyCount
        isReplyItem={isReplyItem}
        replyCount={replyCount}
      />
    </CommentRow>
  )
}
