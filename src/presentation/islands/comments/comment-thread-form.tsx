/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useState, type ReactElement } from 'react'
import { computeCommentFormClasses } from '../recipes/specialty-islands-default-classes'

interface CommentThreadFormProps {
  readonly placeholder: string
  readonly onSubmit: (content: string) => Promise<void>
  readonly isSubmitting: boolean
  readonly variant?: 'comment' | 'reply'
  readonly onCancel?: () => void
}

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
        className="bg-primary text-primary-foreground rounded px-3 py-1 text-sm disabled:opacity-50"
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
      {isReply && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="border-input text-foreground rounded border px-3 py-1 text-sm"
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
        className="border-input bg-background min-h-[100px] rounded border px-2 py-1 text-sm"
      />
      {errorMessage && (
        <p
          role="alert"
          className="text-error-solid text-xs"
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
