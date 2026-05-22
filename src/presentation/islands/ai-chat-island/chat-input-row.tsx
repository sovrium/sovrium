/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import type { ReactElement } from 'react'


interface ChatInputRowProps {
  readonly placeholder: string
  readonly isSending: boolean
  readonly allowAttachments: boolean
  readonly initialDraft: string
  readonly onSend: (text: string) => void
}

const AttachButton = (): ReactElement => (
  <button
    type="button"
    data-testid="chat-attach"
    aria-label="Attach file"
    className="border-border text-foreground-muted hover:bg-background-subtle rounded border px-2 py-2 text-sm"
  >
    Attach
  </button>
)

function useDraftState(isSending: boolean, initialDraft: string, onSend: (text: string) => void) {
  const [draft, setDraft] = useState(initialDraft)

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

  return { draft, handleChange, handleSubmit }
}

export function ChatInputRow({
  placeholder,
  isSending,
  allowAttachments,
  initialDraft,
  onSend,
}: ChatInputRowProps): ReactElement {
  const { draft, handleChange, handleSubmit } = useDraftState(isSending, initialDraft, onSend)
  const canSend = draft.trim().length > 0 && !isSending

  return (
    <form
      data-ai-chat-form
      onSubmit={handleSubmit}
      className="border-border flex items-center gap-2 border-t p-3"
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
        data-ai-chat-input
        data-testid="chat-input"
        type="text"
        name="message"
        value={draft}
        onChange={handleChange}
        disabled={isSending}
        placeholder={placeholder}
        className="border-border flex-1 rounded border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        data-ai-chat-send
        data-testid="chat-send"
        disabled={!canSend}
        className="bg-primary text-primary-fg hover:bg-primary-hover rounded px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </button>
    </form>
  )
}
