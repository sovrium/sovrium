/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { usableLocale } from '@/domain/kernel/format/usable-locale'
import {
  computeCommentAuthorClasses,
  computeCommentAvatarClasses,
  computeCommentAvatarFallbackClasses,
  computeCommentBodyColumnClasses,
  computeCommentMediaClasses,
  computeCommentMetaClasses,
  computeCommentTextClasses,
  computeCommentTimestampClasses,
} from '@/presentation/design/comments-default-classes'
import { resolvePageLocale } from '../runtime/page-locale'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, DESTRUCTIVE_BUTTON } from './comment-button-classes'
import { decodeForEdit } from './comment-mention-source'
import { useMentionString } from './comment-mention-strings'
import { CommentBodyText } from './comment-mention-text'
import { useCommentString } from './comment-strings'
import { MentionTextarea } from './comment-thread-form'
import { resolveCommentAuthorName, type CommentRecord } from './comment-thread-types'
import { useMentionComposer } from './use-mention-composer'
import type { ReactElement, ReactNode } from 'react'

/**
 * The pieces one comment is drawn from: its row and meta line, and its two
 * transient modes, the edit form that replaces its body and the delete
 * confirmation that replaces its actions.
 */

/**
 * The author's first initial, for the row's avatar circle. Derived from the
 * name already carried in props — the avatar fetches nothing.
 */
function authorInitial(comment: CommentRecord): string {
  return resolveCommentAuthorName(comment, 'Anonymous').trim().charAt(0).toUpperCase()
}

/** 1 for a reply, 0 for a comment on the thread. */
const depthOf = (comment: CommentRecord): number => (comment.parentCommentId === null ? 0 : 1)

/**
 * The shared row shell, an `item`: the avatar as its media, then the content
 * column every mode fills. The avatar is `aria-hidden` because its initial only
 * repeats the author name the title states in full beside it.
 */
export function CommentRow({
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
  const depth = depthOf(comment)
  return (
    <li
      data-testid={testId}
      data-comment-id={comment.id}
      data-slot="item"
      data-variant="default"
      data-size="sm"
      className={className}
    >
      <div
        data-slot="item-media"
        className={computeCommentMediaClasses()}
      >
        <span
          aria-hidden="true"
          data-slot="avatar"
          data-size={depth === 0 ? 'default' : 'sm'}
          className={computeCommentAvatarClasses({ depth })}
        >
          <span
            data-slot="avatar-fallback"
            className={computeCommentAvatarFallbackClasses({ depth })}
          >
            {authorInitial(comment)}
          </span>
        </span>
      </div>
      <div
        data-slot="item-content"
        className={computeCommentBodyColumnClasses()}
      >
        {children}
      </div>
    </li>
  )
}

export function CommentMeta({ comment }: { readonly comment: CommentRecord }): ReactElement {
  // Author attribution precedence: guest name,
  // then authenticated user's name, then the "Anonymous" floor (see
  // resolveCommentAuthorName). The `.comments-author` class is the public hook
  // the public-comments specs scope their assertions to.
  const authorName = resolveCommentAuthorName(comment, 'Anonymous')
  const created = new Date(comment.createdAt)
  return (
    <header
      data-slot="item-title"
      className={computeCommentMetaClasses({ depth: depthOf(comment) })}
    >
      <span className={`comments-author ${computeCommentAuthorClasses()}`}>{authorName}</span>
      <time
        dateTime={comment.createdAt}
        className={computeCommentTimestampClasses()}
      >
        {created.toLocaleString(usableLocale(resolvePageLocale()))}
      </time>
    </header>
  )
}

/**
 * The edit box reads the comment's mentions as names, exactly as the thread
 * does, and saves each one back as the markup it came from — so editing a
 * comment never turns a mention into plain text, nor shows its author a token.
 */
function EditForm({
  comment,
  onSave,
  onCancel,
  isSaving,
}: {
  readonly comment: CommentRecord
  readonly onSave: (content: string) => void
  readonly onCancel: () => void
  readonly isSaving: boolean
}): ReactElement {
  const composer = useMentionComposer(decodeForEdit(comment, useMentionString('unknownUser')))
  const saving = useCommentString('form.saving', 'Saving…')
  const { value } = composer
  return (
    <MentionTextarea
      composer={composer}
      label="Edit comment"
    >
      <button
        type="button"
        data-slot="button"
        onClick={() => onSave(composer.encode())}
        disabled={isSaving || value.trim().length === 0}
        className={PRIMARY_BUTTON}
      >
        {isSaving ? saving : 'Save'}
      </button>
      <button
        type="button"
        data-slot="button"
        onClick={onCancel}
        className={SECONDARY_BUTTON}
      >
        Cancel
      </button>
    </MentionTextarea>
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
  const deleting = useCommentString('form.deleting', 'Deleting…')
  return (
    <div
      role="alertdialog"
      aria-label="Delete comment"
      className="bg-muted grid gap-2 rounded-md p-2 text-sm"
    >
      <p>Are you sure you want to delete this comment by {authorName}?</p>
      <div className="flex gap-2">
        <button
          type="button"
          data-slot="button"
          onClick={onConfirm}
          disabled={isDeleting}
          className={DESTRUCTIVE_BUTTON}
        >
          {isDeleting ? deleting : 'Confirm'}
        </button>
        <button
          type="button"
          data-slot="button"
          onClick={onCancel}
          className={SECONDARY_BUTTON}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export type ItemMode = 'view' | 'editing' | 'confirming-delete' | 'replying'

/** The editing-mode rendering of a comment item. */
export function EditModeItem({
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
        comment={comment}
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
export function DeleteModeItem({
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
      <p className={computeCommentTextClasses()}>
        <CommentBodyText comment={comment} />
      </p>
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
