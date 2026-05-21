/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react'
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
      className="chat-messages text-fg-muted flex-1 space-y-2 overflow-y-auto p-4 text-sm"
      style={{ minHeight: `${chatHeight}px` }}
    >
      {messages.map((message, index) => (
        <div
          key={message.id}
          data-message-role={message.role}
          data-testid={`message-${index}`}
          className={
            message.role === 'user'
              ? 'bg-primary text-primary-fg ml-auto w-fit max-w-[80%] rounded-lg px-3 py-2 break-words'
              : 'bg-bg-subtle text-fg mr-auto w-fit max-w-[80%] rounded-lg px-3 py-2 break-words'
          }
        >
          {message.content}
        </div>
      ))}
      {status === 'sending' && (
        <div
          data-testid="chat-loading"
          role="status"
          aria-label="Assistant is responding"
          className="bg-bg-subtle mr-auto flex w-fit gap-1 rounded-lg px-3 py-2"
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
