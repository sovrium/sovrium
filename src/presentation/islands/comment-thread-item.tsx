/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useState, type ReactElement, type ReactNode } from 'react'
import { CommentThreadForm } from './comment-thread-form'
import { isEdited, type CommentRecord } from './comment-thread-types'
import {
  computeCommentItemClasses,
  computeCommentMetaClasses,
} from './specialty-islands-default-classes'

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
  readonly children?: ReactNode
}

function CommentMeta({ comment }: { readonly comment: CommentRecord }): ReactElement {
  const authorName = comment.user?.name ?? 'Unknown'
  const created = new Date(comment.createdAt)
  return (
    <header className={computeCommentMetaClasses()}>
      <span className="text-foreground font-medium">{authorName}</span>
      <time dateTime={comment.createdAt}>{created.toLocaleString()}</time>
    </header>
  )
}

function EditForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  readonly initial: string
  readonly onSave: (content: string) => void
  readonly onCancel: () => void
  readonly isSaving: boolean
}): ReactElement {
  const [value, setValue] = useState(initial)
  return (
    <div className="grid gap-2">
      <textarea
        aria-label="Edit comment"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="border-input bg-background min-h-[80px] rounded border px-2 py-1 text-sm"
        maxLength={10_000}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(value)}
          disabled={isSaving || value.trim().length === 0}
          className="bg-primary text-primary-foreground rounded px-3 py-1 text-sm disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border-input text-foreground rounded border px-3 py-1 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function DeleteConfirm({
  authorName,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  readonly authorName: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly isDeleting: boolean
}): ReactElement {
  return (
    <div
      role="alertdialog"
      aria-label="Delete comment"
      className="border-input grid gap-2 rounded border p-2 text-sm"
    >
      <p>Are you sure you want to delete this comment by {authorName}?</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          className="bg-error-solid text-error-solid-fg rounded px-3 py-1 disabled:opacity-50"
        >
          {isDeleting ? 'Deleting…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border-input rounded border px-3 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

type ItemMode = 'view' | 'editing' | 'confirming-delete' | 'replying'

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
  if (!canEdit && !canDelete && !canReply) return undefined
  return (
    <div className="flex gap-2 text-xs">
      {canEdit && (
        <button
          type="button"
          onClick={() => onSetMode('editing')}
          className="text-foreground-muted hover:text-foreground underline"
        >
          Edit
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={() => onSetMode('confirming-delete')}
          className="text-foreground-muted hover:text-error-solid underline"
        >
          Delete
        </button>
      )}
      {canReply && (
        <button
          type="button"
          onClick={() => onSetMode('replying')}
          className="text-foreground-muted hover:text-foreground underline"
        >
          Reply
        </button>
      )}
    </div>
  )
}

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
      className="text-foreground-muted text-xs"
    >
      {replyCount === 1 ? '1 reply' : `${replyCount} replies`}
    </p>
  )
}

function EditModeItem({
  comment,
  liClassName,
  testId,
  isSaving,
  onSaveEdit,
  onSetMode,
}: {
  readonly comment: CommentRecord
  readonly liClassName: string
  readonly testId: string
  readonly isSaving: boolean
  readonly onSaveEdit: (commentId: string, content: string) => Promise<void>
  readonly onSetMode: (mode: ItemMode) => void
}): ReactElement {
  return (
    <li
      data-testid={testId}
      data-comment-id={comment.id}
      className={liClassName}
    >
      <CommentMeta comment={comment} />
      <EditForm
        initial={comment.content}
        isSaving={isSaving}
        onSave={async (next) => {
          await onSaveEdit(comment.id, next)
          onSetMode('view')
        }}
        onCancel={() => onSetMode('view')}
      />
    </li>
  )
}

function DeleteModeItem({
  comment,
  liClassName,
  testId,
  isDeleting,
  onConfirmDelete,
  onSetMode,
}: {
  readonly comment: CommentRecord
  readonly liClassName: string
  readonly testId: string
  readonly isDeleting: boolean
  readonly onConfirmDelete: (commentId: string) => Promise<void>
  readonly onSetMode: (mode: ItemMode) => void
}): ReactElement {
  return (
    <li
      data-testid={testId}
      data-comment-id={comment.id}
      className={liClassName}
    >
      <CommentMeta comment={comment} />
      <p className="text-sm">{comment.content}</p>
      <DeleteConfirm
        authorName={comment.user?.name ?? 'this author'}
        isDeleting={isDeleting}
        onConfirm={async () => {
          await onConfirmDelete(comment.id)
          onSetMode('view')
        }}
        onCancel={() => onSetMode('view')}
      />
    </li>
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
  children,
}: CommentThreadItemProps): ReactElement {
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
    <li
      data-testid={testId}
      data-comment-id={comment.id}
      className={liClassName}
    >
      <CommentMeta comment={comment} />
      <p className="text-sm">
        {comment.content}
        {isEdited(comment) && <span className="text-foreground-subtle ml-2 text-xs">(edited)</span>}
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
          placeholder="Write a reply…"
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
      {children && <ul className="grid gap-2">{children}</ul>}
    </li>
  )
}
