/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import {
  computeAiChatContainerClasses,
  computeAiChatInputClasses,
  computeAiChatInputRowClasses,
  computeAiChatMessageBubbleClasses,
  computeAiChatMessageListClasses,
  computeAiChatSendButtonClasses,
} from '../../recipes/specialty-islands-default-classes'
import { useAgentChat, type AgentChatTurn } from './admin-agent-chat-data'

function ChatTurn({ turn }: { readonly turn: AgentChatTurn }): ReactElement {
  const isAssistant = turn.role === 'assistant'
  const bubble = computeAiChatMessageBubbleClasses({ role: isAssistant ? 'assistant' : 'user' })
  if (isAssistant) {
    return (
      <article
        aria-label="Réponse de l'agent"
        className={bubble}
      >
        {turn.content}
      </article>
    )
  }
  return <div className={bubble}>{turn.content}</div>
}

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
        aria-label="Écrivez à l'agent"
        value={draft}
        onChange={handleChange}
        disabled={isSending}
        placeholder="Écrivez à l'agent…"
        className={computeAiChatInputClasses()}
      />
      <button
        type="submit"
        disabled={draft.trim().length === 0 || isSending}
        className={computeAiChatSendButtonClasses()}
      >
        Envoyer
      </button>
    </form>
  )
}

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
