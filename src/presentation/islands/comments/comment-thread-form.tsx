/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useId, useState, type ReactElement, type ReactNode } from 'react'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import {
  computeCommentComposerTextareaClasses,
  computeCommentFormClasses,
} from '@/presentation/design/comments-default-classes'
import { computeFormFieldErrorClasses } from '@/presentation/design/form-layout-classes'
import {
  computeInputGroupBlockAddonClasses,
  computeInputGroupFrameClasses,
} from '@/presentation/design/input-group-block-classes'
import { pendingControlProps } from '@/presentation/design/pending-state'
import { pressWhilePending } from '@/presentation/islands/runtime/pending-control'
import { CommentMentionListbox } from './comment-mention-listbox'
import { useCommentString } from './comment-strings'
import { mentionOptionId, useMentionComposer, type MentionComposer } from './use-mention-composer'

const SUBMIT_BUTTON = computePartButtonClasses({ variant: 'default', size: 'sm' })
const CANCEL_BUTTON = computePartButtonClasses({ variant: 'secondary', size: 'sm' })
const COMPOSER_ADDON = computeInputGroupBlockAddonClasses({ align: 'block-end' })

/**
 * Authenticated comment form.
 *
 * - Plain `<textarea>` (no Tiptap dependency in v1 — keeps the bundle smaller
 *   and lets the client-side validation regex on `value.trim()` work without
 *   a serialized HTML round-trip).
 * - 10 000 character limit (matches the API contract in
 *   `validateCreateCommentBody`).
 * - Empty + whitespace-only submissions are blocked client-side with a
 * "Comment cannot be empty" message.
 * - Typing `@` opens the mention picker; a picked person reads as `@<name>` in
 *   the textarea and is posted as `@[<user id>]` markup.
 */
interface CommentThreadFormProps {
  readonly placeholder: string
  readonly onSubmit: (content: string) => Promise<void>
  readonly isSubmitting: boolean
  /**
   * When `'reply'`, the form swaps its `aria-label` to "Reply" and exposes
   * an optional Cancel button. The submit
   * button label flips to "Submit reply" so the regression-step
   * `getByRole('button', { name: /submit|post/i })` still matches.
   */
  readonly variant?: 'comment' | 'reply'
  readonly onCancel?: () => void
}

/**
 * The form's action row: the submit button plus an optional Cancel button
 * (reply variant only). Extracted to keep `CommentThreadForm` under the
 * component-size limit.
 */
function CommentFormActions({
  isReply,
  isSubmitting,
  submitLabel,
  submittingLabel,
  onCancel,
}: {
  readonly isReply: boolean
  readonly isSubmitting: boolean
  readonly submitLabel: string
  readonly submittingLabel: string
  readonly onCancel?: () => void
}): ReactElement {
  return (
    <>
      <button
        type="submit"
        data-slot="button"
        {...pendingControlProps(isSubmitting)}
        className={SUBMIT_BUTTON}
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
      {isReply && onCancel && (
        <button
          type="button"
          data-slot="button"
          onClick={onCancel}
          className={CANCEL_BUTTON}
        >
          Cancel
        </button>
      )}
    </>
  )
}

/**
 * A comment textarea that can mention people, framed as an `input-group` whose
 * `block-end` addon holds the buttons passed as children, with the picker
 * under the group.
 *
 * The textarea stays a TEXTBOX — the writer is writing prose, and the picker is
 * an aid to it — and points at the picker with `aria-controls` and at the
 * active person with `aria-activedescendant` while the picker is open.
 */
export function MentionTextarea({
  composer,
  label,
  placeholder,
  children,
}: {
  readonly composer: MentionComposer
  readonly label: string
  readonly placeholder?: string
  readonly children: ReactNode
}): ReactElement {
  const listboxId = useId()
  const showsOption = composer.open && composer.candidates.length > 0
  return (
    <>
      <div
        role="group"
        data-slot="input-group"
        className={computeInputGroupFrameClasses()}
      >
        <textarea
          ref={composer.textareaRef}
          name="content"
          aria-label={label}
          aria-autocomplete="list"
          {...(composer.open && { 'aria-controls': listboxId })}
          {...(showsOption && {
            'aria-activedescendant': mentionOptionId(listboxId, composer.activeIndex),
          })}
          placeholder={placeholder}
          value={composer.value}
          onChange={composer.onChange}
          onSelect={composer.onSelect}
          onKeyDown={composer.onKeyDown}
          maxLength={10_000}
          data-slot="input-group-control"
          className={computeCommentComposerTextareaClasses()}
        />
        <div
          role="group"
          data-slot="input-group-addon"
          data-align="block-end"
          className={COMPOSER_ADDON}
        >
          {children}
        </div>
      </div>
      {composer.open && (
        <CommentMentionListbox
          composer={composer}
          listboxId={listboxId}
        />
      )}
    </>
  )
}

/** The catalog key and English of each composer string, per variant. */
const COMPOSER_STRINGS = {
  comment: {
    textarea: ['comments.write', 'Write a comment'],
    empty: ['comments.empty', 'Comment cannot be empty'],
    submit: ['comments.submit', 'Submit comment'],
    submitting: ['comments.posting', 'Posting…'],
  },
  reply: {
    textarea: ['comments.reply', 'Reply'],
    empty: ['comments.replyEmpty', 'Reply cannot be empty'],
    submit: ['comments.submitReply', 'Submit reply'],
    submitting: ['comments.postingReply', 'Posting reply…'],
  },
} as const

/** The composer's words in the page language, for a comment or a reply. */
function useComposerLabels(isReply: boolean) {
  const strings = COMPOSER_STRINGS[isReply ? 'reply' : 'comment']
  return {
    textarea: useCommentString(strings.textarea[0], strings.textarea[1]),
    empty: useCommentString(strings.empty[0], strings.empty[1]),
    submit: useCommentString(strings.submit[0], strings.submit[1]),
    submitting: useCommentString(strings.submitting[0], strings.submitting[1]),
  }
}

export function CommentThreadForm({
  placeholder,
  onSubmit,
  isSubmitting,
  variant = 'comment',
  onCancel,
}: CommentThreadFormProps): ReactElement {
  const composer = useMentionComposer()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const isReply = variant === 'reply'
  const labels = useComposerLabels(isReply)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    if (pressWhilePending(event)) return
    event.preventDefault()
    if (composer.value.trim().length === 0) {
      setErrorMessage(labels.empty)
      return
    }
    setErrorMessage(undefined)
    await onSubmit(composer.encode())
    composer.reset()
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-comments-form={isReply ? 'reply' : 'authenticated'}
      className={`comments-form ${computeCommentFormClasses()}`}
      noValidate
    >
      <MentionTextarea
        composer={composer}
        label={labels.textarea}
        placeholder={placeholder}
      >
        <CommentFormActions
          isReply={isReply}
          isSubmitting={isSubmitting}
          submitLabel={labels.submit}
          submittingLabel={labels.submitting}
          onCancel={onCancel}
        />
      </MentionTextarea>
      {errorMessage && (
        <p
          role="alert"
          className={computeFormFieldErrorClasses()}
        >
          {errorMessage}
        </p>
      )}
    </form>
  )
}
