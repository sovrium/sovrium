/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-perf/jsx-no-new-function-as-prop -- conventional React form event-handler pattern. */

import { useState, type ReactElement } from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeCommentComposerFieldClasses,
  computeCommentFormClasses,
} from '@/presentation/design/comments-default-classes'
import { computeFormFieldErrorClasses } from '@/presentation/design/form-layout-classes'

const SUBMIT_BUTTON = computeButtonDefaultClasses({ variant: 'default', size: 'sm' })
const CANCEL_BUTTON = computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })

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
    <div className="flex gap-2">
      <button
        type="submit"
        disabled={isSubmitting}
        className={SUBMIT_BUTTON}
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
      {isReply && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className={CANCEL_BUTTON}
        >
          Cancel
        </button>
      )}
    </div>
  )
}

export function CommentThreadForm({
  placeholder,
  onSubmit,
  isSubmitting,
  variant = 'comment',
  onCancel,
}: CommentThreadFormProps): ReactElement {
  const [value, setValue] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const isReply = variant === 'reply'
  const textareaLabel = isReply ? 'Reply' : 'Write a comment'

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (value.trim().length === 0) {
      setErrorMessage(isReply ? 'Reply cannot be empty' : 'Comment cannot be empty')
      return
    }
    setErrorMessage(undefined)
    await onSubmit(value)
    setValue('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-comments-form={isReply ? 'reply' : 'authenticated'}
      className={`comments-form ${computeCommentFormClasses()}`}
      noValidate
    >
      <textarea
        name="content"
        aria-label={textareaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={10_000}
        className={computeCommentComposerFieldClasses()}
      />
      {errorMessage && (
        <p
          role="alert"
          className={computeFormFieldErrorClasses()}
        >
          {errorMessage}
        </p>
      )}
      <CommentFormActions
        isReply={isReply}
        isSubmitting={isSubmitting}
        submitLabel={isReply ? 'Submit reply' : 'Submit comment'}
        submittingLabel={isReply ? 'Posting reply…' : 'Posting…'}
        onCancel={onCancel}
      />
    </form>
  )
}
