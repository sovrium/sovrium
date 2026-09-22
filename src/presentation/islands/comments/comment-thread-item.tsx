/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop -- per-comment state machine renders 4 distinct modes (view/edit/confirming-delete/replying); per-handler arrow props are conventional React pattern. */

import { useState, type ReactElement, type ReactNode } from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeCommentActionClasses,
  computeCommentActionsClasses,
  computeCommentAuthorClasses,
  computeCommentAvatarClasses,
  computeCommentBodyColumnClasses,
  computeCommentComposerFieldClasses,
  computeCommentItemClasses,
  computeCommentMetaClasses,
  computeCommentTextClasses,
  computeCommentTimestampClasses,
} from '@/presentation/design/comments-default-classes'
import { CommentThreadForm } from './comment-thread-form'
import { isEdited, resolveCommentAuthorName, type CommentRecord } from './comment-thread-types'

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

// Computed once at module scope: a button recipe is pure, and re-deriving the
// same three strings on every keystroke in an open edit box is pure waste.
const PRIMARY_BUTTON = computeButtonDefaultClasses({ variant: 'default', size: 'sm' })
const SECONDARY_BUTTON = computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })
const DESTRUCTIVE_BUTTON = computeButtonDefaultClasses({ variant: 'destructive', size: 'sm' })

/**
 * The author's first initial, for the row's avatar circle. Derived from the
 * name already carried in props — the avatar fetches nothing.
 */
function authorInitial(comment: CommentRecord): string {
  return resolveCommentAuthorName(comment, 'Anonymous').trim().charAt(0).toUpperCase()
}

/**
 * The shared row shell: the avatar, then the body column every mode fills.
 * The circle is `aria-hidden` because its initial only repeats the author name
 * the meta row states in full a few pixels away.
 */
function CommentRow({
  comment,
  testId,
  className,
  children,
}: {
  readonly comment: CommentRecord
  readonly testId: string
  readonly className: string
  readonly children: ReactNode
}): ReactElement {
  return (
    <li
      data-testid={testId}
      data-comment-id={comment.id}
      className={className}
    >
      <span
        aria-hidden="true"
        className={computeCommentAvatarClasses()}
      >
        {authorInitial(comment)}
      </span>
      <div className={computeCommentBodyColumnClasses()}>{children}</div>
    </li>
  )
}

function CommentMeta({ comment }: { readonly comment: CommentRecord }): ReactElement {
  // Author attribution precedence: guest name,
  // then authenticated user's name, then the "Anonymous" floor (see
  // resolveCommentAuthorName). The `.comments-author` class is the public hook
  // the public-comments specs scope their assertions to.
  const authorName = resolveCommentAuthorName(comment, 'Anonymous')
  const created = new Date(comment.createdAt)
  return (
    <header className={computeCommentMetaClasses()}>
      <span className={`comments-author ${computeCommentAuthorClasses()}`}>{authorName}</span>
      <time
        dateTime={comment.createdAt}
        className={computeCommentTimestampClasses()}
      >
        {created.toLocaleString()}
      </time>
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
        className={computeCommentComposerFieldClasses()}
        maxLength={10_000}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(value)}
          disabled={isSaving || value.trim().length === 0}
          className={PRIMARY_BUTTON}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={SECONDARY_BUTTON}
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
      className="bg-background-subtle grid gap-2 rounded-[var(--radius-base,4px)] p-2 text-sm"
    >
      <p>Are you sure you want to delete this comment by {authorName}?</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          className={DESTRUCTIVE_BUTTON}
        >
          {isDeleting ? 'Deleting…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={SECONDARY_BUTTON}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

type ItemMode = 'view' | 'editing' | 'confirming-delete' | 'replying'

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
          Reply
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

/** The editing-mode rendering of a comment item. */
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
    <CommentRow
      comment={comment}
      testId={testId}
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
    </CommentRow>
  )
}

/** The delete-confirmation rendering of a comment item. */
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
    <CommentRow
      comment={comment}
      testId={testId}
      className={liClassName}
    >
      <CommentMeta comment={comment} />
      <p className={computeCommentTextClasses()}>{comment.content}</p>
      <DeleteConfirm
        authorName={resolveCommentAuthorName(comment, 'this author')}
        isDeleting={isDeleting}
        onConfirm={async () => {
          await onConfirmDelete(comment.id)
          // After confirmation the parent removes the row; setMode is moot
          // but defensive in case the deletion fails and the row stays.
          onSetMode('view')
        }}
        onCancel={() => onSetMode('view')}
      />
    </CommentRow>
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
        {comment.content}
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
    </CommentRow>
  )
}
