/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The shared agent-chat composer — the conversation `log` + the message input
 * row, driven by {@link useAgentChat}. Mounted by the Conversations page's
 * "New conversation" flow (`admin-agent-conversations` island), which mounts
 * the composer in its thread column when an operator starts a fresh
 * conversation.
 *
 * Drawn with the same anatomy as the public `ai-chat`: a `message-scroller`
 * frame holding `message` turns whose surface is a `bubble`, and shadcn's
 * `input-group` composer with the send control in a `block-end` addon. The
 * classes come from the shared composed recipe
 * (`ai-chat-composition-classes`), so the console's chat and the public chat
 * cannot drift apart.
 *
 * The surface carries the conversation `log` ("Conversation") — assistant
 * replies render as `article` landmarks ("Agent reply") — plus the
 * message input (`textbox` "Message the agent") + the "Send" button.
 */

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import {
  AI_CHAT_TRANSCRIPT_FIT,
  computeAiChatBubbleClasses,
  computeAiChatBubbleContentClasses,
  computeAiChatComposerButtonClasses,
  computeAiChatComposerClasses,
  computeAiChatPanelClasses,
  computeAiChatTextareaClasses,
} from '@/presentation/design/ai-chat-composition-classes'
import {
  computeInputGroupAddonClasses,
  computeInputGroupClasses,
} from '@/presentation/design/input-group-default-classes'
import {
  computeMessageClasses,
  computeMessageContentClasses,
} from '@/presentation/design/message-default-classes'
import { computeMessageScrollerClasses } from '@/presentation/design/message-scroller-default-classes'
import { ChatTurnActions, type ChatTurnAction } from './admin-agent-chat-actions'
import { useAgentChat, type AgentChatTurn } from './admin-agent-chat-data'
import { useAgentConversationString as useWord } from './admin-agent-conversations-strings'

/** Shared empty-actions reference — a fresh `[]` per render would remount the list. */
const NO_ACTIONS: ReadonlyArray<ChatTurnAction> = []

/** Send is the input group's primary control, pushed to the end of its addon. */
const SEND_BUTTON = `${computeAiChatComposerButtonClasses('default')} ms-auto`

/** Enter sends; Shift+Enter, or Enter while an IME is composing, is a new line. */
const submitOnEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
  e.preventDefault()
  e.currentTarget.form?.requestSubmit()
}

/** The turn's words, in a `bubble` on its own side of the transcript. */
function Bubble({ turn }: { readonly turn: AgentChatTurn }): ReactElement {
  const role = turn.role === 'assistant' ? 'assistant' : 'user'
  return (
    <div
      data-slot="bubble"
      data-align={role === 'user' ? 'end' : 'start'}
      className={computeAiChatBubbleClasses()}
    >
      <div
        data-slot="bubble-content"
        className={computeAiChatBubbleContentClasses(role)}
      >
        {turn.content}
      </div>
    </div>
  )
}

/** A single conversation turn — a `message`; assistant replies are `article` landmarks. */
function ChatTurn({ turn }: { readonly turn: AgentChatTurn }): ReactElement {
  const reply = useWord('reply', 'Agent reply')
  if (turn.role === 'assistant') {
    return (
      <article
        aria-label={reply}
        data-slot="message"
        data-align="start"
        className={computeMessageClasses()}
      >
        <div
          data-slot="message-content"
          className={computeMessageContentClasses()}
        >
          <Bubble turn={turn} />
          {/* What the turn actually DID, under the words it said. Renders nothing
              when the turn took no actions — see `ChatTurnActions`. */}
          <ChatTurnActions actions={turn.actions ?? NO_ACTIONS} />
        </div>
      </article>
    )
  }
  return (
    <div
      data-slot="message"
      data-align="end"
      className={computeMessageClasses()}
    >
      <div
        data-slot="message-content"
        className={computeMessageContentClasses()}
      >
        <Bubble turn={turn} />
      </div>
    </div>
  )
}

/** The conversation thread — a `message-scroller` `log` landmark named "Conversation". */
function Conversation({ turns }: { readonly turns: ReadonlyArray<AgentChatTurn> }): ReactElement {
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const frame = frameRef.current
    if (frame !== null) frame.scrollTo({ top: frame.scrollHeight })
  }, [turns])
  return (
    <div
      ref={frameRef}
      data-slot="message-scroller"
      role="log"
      aria-label={useWord('conversation', 'Conversation')}
      aria-live="polite"
      className={`${computeMessageScrollerClasses()} ${AI_CHAT_TRANSCRIPT_FIT}`}
    >
      {turns.map((turn) => (
        <ChatTurn
          key={turn.id}
          turn={turn}
        />
      ))}
    </div>
  )
}

/** The composer's `block-end` addon, holding the send control. */
function SendAddon({ disabled }: { readonly disabled: boolean }): ReactElement {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align="block-end"
      className={computeInputGroupAddonClasses({ align: 'block-end' })}
    >
      <button
        type="submit"
        data-slot="input-group-button"
        disabled={disabled}
        className={SEND_BUTTON}
      >
        {useWord('send', 'Send')}
      </button>
    </div>
  )
}

/** The `input-group` composer — the `textbox` "Message the agent" + the "Send" button. */
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
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(e.target.value),
    []
  )
  return (
    <form
      onSubmit={handleSubmit}
      className={computeAiChatComposerClasses()}
    >
      <div
        data-slot="input-group"
        role="group"
        className={computeInputGroupClasses()}
      >
        <textarea
          rows={1}
          aria-label={useWord('messageLabel', 'Message the agent')}
          data-slot="input-group-control"
          value={draft}
          onChange={handleChange}
          onKeyDown={submitOnEnter}
          disabled={isSending}
          placeholder={useWord('message', 'Message the agent…')}
          className={computeAiChatTextareaClasses()}
        />
        <SendAddon disabled={draft.trim().length === 0 || isSending} />
      </div>
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
    <div className={computeAiChatPanelClasses()}>
      <Conversation turns={turns} />
      <InputRow
        isSending={status === 'sending'}
        onSend={send}
      />
    </div>
  )
}
