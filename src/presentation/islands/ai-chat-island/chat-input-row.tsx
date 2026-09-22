/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useRef, useState } from 'react'
import {
  computeAiChatInputClasses,
  computeAiChatInputRowClasses,
} from '@/presentation/design/ai-chat-default-classes'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { SuggestionStrip } from './suggestion-strip'
import type { ReactElement, RefObject } from 'react'

/**
 * Send is the ordinary small primary button. It had a bespoke recipe of its
 * own until wave R-E, which is how it drifted from every other primary in the
 * product; Attach is its quiet neighbour.
 */
const SEND_BUTTON = computeButtonDefaultClasses({ size: 'sm' })
const ATTACH_BUTTON = computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })

/**
 * Message-input row for the `ai-chat` island.
 *
 * Owns the draft state, submits on Enter / Send click, disables the Send button
 * when the draft is empty or while the AI is responding ([internal ref] /
 * 028), and renders the optional file-attachment button — plus, under it, the
 * prompt-suggestion chips.
 */

interface ChatInputRowProps {
  readonly placeholder: string
  readonly isSending: boolean
  readonly allowAttachments: boolean
  /** Draft text captured from the SSR skeleton before hydration. */
  readonly initialDraft: string
  /** Starter prompts drawn as chips under this row; absent when none apply. */
  readonly suggestions: ReadonlyArray<string> | undefined
  readonly onSend: (text: string) => void
}

/** Optional file-attachment button, shown only when `allowAttachments`. */
const AttachButton = (): ReactElement => (
  <button
    type="button"
    data-testid="chat-attach"
    aria-label="Attach file"
    className={ATTACH_BUTTON}
  >
    Attach
  </button>
)

/**
 * Draft state, the composer's handlers, and the input node itself.
 *
 * The ref is here rather than in the component because it is half of one
 * behaviour: selecting a suggestion fills the draft AND hands the reader the
 * caret, which is what makes editing the obvious next move ("…waiting on a
 * customer, for Dupont?") rather than a second click away. Filling without
 * focusing would be the same number of lines and a worse composer.
 */
function useComposerState(isSending: boolean, initialDraft: string, onSend: (t: string) => void) {
  const [draft, setDraft] = useState(initialDraft)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    []
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (draft.trim().length === 0 || isSending) return
      onSend(draft)
      setDraft('')
    },
    [draft, isSending, onSend]
  )

  /** Fills the composer and focuses it. It deliberately does NOT send. */
  const handleSelectSuggestion = useCallback((prompt: string) => {
    setDraft(prompt)
    inputRef.current?.focus()
  }, [])

  return { draft, inputRef, handleChange, handleSubmit, handleSelectSuggestion }
}

interface ComposerFormProps {
  readonly placeholder: string
  readonly isSending: boolean
  readonly allowAttachments: boolean
  readonly draft: string
  readonly inputRef: RefObject<HTMLInputElement | null>
  readonly onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  readonly onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}

/** The composer proper: label, optional attach button, field, submit. */
function ComposerForm({
  placeholder,
  isSending,
  allowAttachments,
  draft,
  inputRef,
  onChange,
  onSubmit,
}: ComposerFormProps): ReactElement {
  const canSend = draft.trim().length > 0 && !isSending

  return (
    <form
      data-ai-chat-form
      onSubmit={onSubmit}
      className={computeAiChatInputRowClasses()}
    >
      <label
        htmlFor="ai-chat-input"
        className="sr-only"
      >
        Message
      </label>
      {allowAttachments && <AttachButton />}
      <input
        id="ai-chat-input"
        ref={inputRef}
        data-ai-chat-input
        data-testid="chat-input"
        type="text"
        name="message"
        value={draft}
        onChange={onChange}
        disabled={isSending}
        placeholder={placeholder}
        className={computeAiChatInputClasses()}
      />
      <button
        type="submit"
        data-ai-chat-send
        data-testid="chat-send"
        disabled={!canSend}
        className={SEND_BUTTON}
      >
        Send
      </button>
    </form>
  )
}

export function ChatInputRow({
  placeholder,
  isSending,
  allowAttachments,
  initialDraft,
  suggestions,
  onSend,
}: ChatInputRowProps): ReactElement {
  const { draft, inputRef, handleChange, handleSubmit, handleSelectSuggestion } = useComposerState(
    isSending,
    initialDraft,
    onSend
  )

  // A FRAGMENT, not a wrapper: the chip strip must be a SIBLING of the form
  // rather than a descendant of it, because a `button` inside a form is a
  // submit control — and a chip fills, it does not send.
  return (
    <>
      <ComposerForm
        placeholder={placeholder}
        isSending={isSending}
        allowAttachments={allowAttachments}
        draft={draft}
        inputRef={inputRef}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
      <SuggestionStrip
        suggestions={suggestions}
        onSelect={handleSelectSuggestion}
      />
    </>
  )
}
