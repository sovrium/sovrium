/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shared agent-chat composer — the conversation `log` + the message input
 * row, driven by {@link useAgentChat}. Mounted by the Conversations page's
 * "New conversation" flow (`admin-agent-conversations` island, [internal ref]
 * item M), which mounts the composer in its thread column when an operator
 * starts a fresh conversation.
 *
 * The surface carries the conversation `log` ("Conversation") — assistant
 * replies render as `article` landmarks ("Agent reply") — plus the
 * message input (`textbox` "Message the agent") + the "Send" button.
 */

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import {
  computeAiChatContainerClasses,
  computeAiChatInputClasses,
  computeAiChatInputRowClasses,
  computeAiChatMessageBubbleClasses,
  computeAiChatMessageListClasses,
} from '@/presentation/design/ai-chat-default-classes'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { ChatTurnActions, type ChatTurnAction } from './admin-agent-chat-actions'
import { useAgentChat, type AgentChatTurn } from './admin-agent-chat-data'

/** Shared empty-actions reference — a fresh `[]` per render would remount the list. */
const NO_ACTIONS: ReadonlyArray<ChatTurnAction> = []

/** Send is the ordinary small primary button, as it is in every chat surface. */
const SEND_BUTTON = computeButtonDefaultClasses({ size: 'sm' })

/** A single conversation turn — assistant replies are `article` landmarks. */
function ChatTurn({ turn }: { readonly turn: AgentChatTurn }): ReactElement {
  const isAssistant = turn.role === 'assistant'
  const bubble = computeAiChatMessageBubbleClasses({ role: isAssistant ? 'assistant' : 'user' })
  if (isAssistant) {
    return (
      <article
        aria-label="Agent reply"
        className={bubble}
      >
        {turn.content}
        {/* What the turn actually DID, under the words it said. Renders nothing
            when the turn took no actions — see `ChatTurnActions`. */}
        <ChatTurnActions actions={turn.actions ?? NO_ACTIONS} />
      </article>
    )
  }
  return <div className={bubble}>{turn.content}</div>
}

/** The conversation thread — a `log` landmark named "Conversation". */
function Conversation({ turns }: { readonly turns: ReadonlyArray<AgentChatTurn> }): ReactElement {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = endRef.current
    if (node !== null) node.scrollIntoView({ block: 'end' })
  }, [turns])
  return (
    <div
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      className={computeAiChatMessageListClasses()}
    >
      {turns.map((turn) => (
        <ChatTurn
          key={turn.id}
          turn={turn}
        />
      ))}
      <div ref={endRef} />
    </div>
  )
}

/** The message input row — the `textbox` "Message the agent" + the "Send" button. */
function InputRow({
  isSending,
  onSend,
}: {
  readonly isSending: boolean
  readonly onSend: (text: string) => void
}): ReactElement {
  const [draft, setDraft] = useState('')
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (draft.trim().length === 0 || isSending) return
      onSend(draft)
      setDraft('')
    },
    [draft, isSending, onSend]
  )
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
    []
  )
  return (
    <form
      onSubmit={handleSubmit}
      className={computeAiChatInputRowClasses()}
    >
      <input
        type="text"
        aria-label="Message the agent"
        value={draft}
        onChange={handleChange}
        disabled={isSending}
        placeholder="Message the agent…"
        className={computeAiChatInputClasses()}
      />
      <button
        type="submit"
        disabled={draft.trim().length === 0 || isSending}
        className={SEND_BUTTON}
      >
        Send
      </button>
    </form>
  )
}

/**
 * The agent-chat composer: the conversation `log` + the message input row, wired
 * to {@link useAgentChat} for the given agent slug. Each mount is its own
 * conversation (the hook mints a fresh sessionId), so callers remount it (via a
 * `key`) to begin a new conversation.
 */
export function ChatComposer({ agentSlug }: { readonly agentSlug: string }): ReactElement {
  const { turns, status, send } = useAgentChat(agentSlug)
  return (
    <div className={computeAiChatContainerClasses()}>
      <Conversation turns={turns} />
      <InputRow
        isSending={status === 'sending'}
        onSend={send}
      />
    </div>
  )
}
