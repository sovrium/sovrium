/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
import {
  computeAiChatMessageBubbleClasses,
  computeAiChatMessageListClasses,
} from '@/presentation/design/ai-chat-default-classes'
import type { ChatMessage, ChatStatus } from './types'
import type { ReactElement } from 'react'

/**
 * Scrollable message log for the `ai-chat` island.
 *
 * Renders each turn with a role-distinguishing `data-message-role` attribute
 *, a loading indicator while the AI is responding
 *, and auto-scrolls to the latest message on update
 *. Long messages wrap via `break-words`
 *.
 *
 * It takes NO height, and that absence is the fix for [internal ref].
 * This log used to carry an inline `min-height: {chatHeight}px` — the same prop
 * the SSR container already applies as its own `height` — which floored the log
 * at the full height of the box that contains it. A flex item cannot shrink
 * below its `min-height`, so `flex-1` yielded nothing, the composer and the
 * chip strip were laid out past the container's bottom edge, and
 * `overflow-hidden` clipped them away: on the shipped default the input row sat
 * fifty-one pixels outside the visible panel, on every `ai-chat` in every app.
 *
 * The height has one owner now — `computeAiChatContainerClasses`, sized by the
 * renderer — and the log simply takes what the composer leaves it.
 */

interface MessagesViewProps {
  readonly messages: readonly ChatMessage[]
  readonly status: ChatStatus
}

export function MessagesView({ messages, status }: MessagesViewProps): ReactElement {
  const endRef = useRef<HTMLDivElement>(null)

  // Keep the latest message in view on every update.
  useEffect(() => {
    const node = endRef.current
    if (node !== null) node.scrollIntoView({ block: 'end' })
  }, [messages, status])

  return (
    <div
      data-ai-chat-messages
      data-testid="chat-messages"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
      className={`chat-messages ${computeAiChatMessageListClasses()}`}
    >
      {messages.map((message, index) => (
        <div
          key={message.id}
          data-message-role={message.role}
          data-testid={`message-${index}`}
          className={computeAiChatMessageBubbleClasses({
            role: message.role === 'user' ? 'user' : 'assistant',
          })}
        >
          {message.content}
        </div>
      ))}
      {status === 'sending' && (
        <div
          data-testid="chat-loading"
          role="status"
          aria-label="Assistant is responding"
          className="bg-background-subtle mr-auto flex w-fit gap-1 rounded-[10px_10px_10px_2px] px-2.5 py-1.5"
        >
          <span className="bg-foreground-disabled size-1.5 animate-bounce rounded-full" />
          <span className="bg-foreground-disabled size-1.5 animate-bounce rounded-full [animation-delay:150ms]" />
          <span className="bg-foreground-disabled size-1.5 animate-bounce rounded-full [animation-delay:300ms]" />
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
