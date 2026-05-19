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
    className="rounded border border-gray-300 px-2 py-2 text-sm text-gray-600 hover:bg-gray-50"
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
      className="flex items-center gap-2 border-t border-gray-200 p-3"
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
        className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        data-ai-chat-send
        data-testid="chat-send"
        disabled={!canSend}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Send
      </button>
    </form>
  )
}
