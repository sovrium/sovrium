/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
  const editLabel = useCommentString('comments.edit', 'Edit')
  const deleteLabel = useCommentString('comments.delete', 'Delete')
  if (!canEdit && !canDelete && !canReply) return undefined
  return (
    <div className={computeCommentActionsClasses()}>
      {canEdit && (
        <button
          type="button"
          onClick={() => onSetMode('editing')}
          className={computeCommentActionClasses()}
        >
          {editLabel}
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={() => onSetMode('confirming-delete')}
          className={computeCommentActionClasses()}
        >
          {deleteLabel}
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
  const one = useCommentString('comments.oneReply', '1 reply')
  const many = useCommentString('comments.replies', '{count} replies')
  if (isReplyItem || replyCount === undefined || replyCount <= 0) return undefined
  return (
    <p
      data-reply-count={String(replyCount)}
      className={computeCommentTimestampClasses()}
    >
      {replyCount === 1 ? one : many.split('{count}').join(String(replyCount))}
    </p>
  )
}

/**
 * The view mode, and the reply mode that opens below it: the comment as read,
 * its affordances, the inline reply form while replying, and its reply count.
 */
function ViewModeItem({
  comment,
  testId,
  liClassName,
  mode,
  onSetMode,
  canEdit,
  canDelete,
  canReply,
  onSubmitReply,
  isReplying,
  replyCount,
}: Pick<
  CommentThreadItemProps,
  'comment' | 'canEdit' | 'canDelete' | 'canReply' | 'onSubmitReply' | 'isReplying' | 'replyCount'
> & {
  readonly testId: string
  readonly liClassName: string
  readonly mode: ItemMode
  readonly onSetMode: (mode: ItemMode) => void
}): ReactElement {
  const replyPlaceholder = useCommentString('comments.replyPlaceholder', 'Write a reply…')
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
        onSetMode={onSetMode}
      />
      {mode === 'replying' && (
        <CommentThreadForm
          variant="reply"
          placeholder={replyPlaceholder}
          isSubmitting={isReplying}
          onSubmit={async (content) => {
            await onSubmitReply(comment.id, content)
            onSetMode('view')
          }}
          onCancel={() => onSetMode('view')}
        />
      )}
      <ReplyCount
        isReplyItem={comment.parentCommentId !== null}
        replyCount={replyCount}
      />
    </CommentRow>
  )
}

/** One comment: the mode it is in (view, editing, confirming delete, replying) and its row. */
export function CommentThreadItem(props: CommentThreadItemProps): ReactElement {
  const { comment, isSaving, isDeleting, onSaveEdit, onConfirmDelete } = props
  const [mode, setMode] = useState<ItemMode>('view')
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
    <ViewModeItem
      {...props}
      testId={testId}
      liClassName={liClassName}
      mode={mode}
      onSetMode={setMode}
    />
  )
}
