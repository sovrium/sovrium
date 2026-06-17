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
} from '../recipes/specialty-islands-default-classes'
import type { ChatMessage, ChatStatus } from './types'
import type { ReactElement } from 'react'


interface MessagesViewProps {
  readonly messages: readonly ChatMessage[]
  readonly status: ChatStatus
  readonly chatHeight: number
}

export function MessagesView({ messages, status, chatHeight }: MessagesViewProps): ReactElement {
  const endRef = useRef<HTMLDivElement>(null)

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
      style={{ minHeight: `${chatHeight}px` }}
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
          className="bg-background-subtle mr-auto flex w-fit gap-1 rounded-lg px-3 py-2"
        >
          <span className="bg-border-strong h-2 w-2 animate-bounce rounded-full" />
          <span className="bg-border-strong h-2 w-2 animate-bounce rounded-full [animation-delay:150ms]" />
          <span className="bg-border-strong h-2 w-2 animate-bounce rounded-full [animation-delay:300ms]" />
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
