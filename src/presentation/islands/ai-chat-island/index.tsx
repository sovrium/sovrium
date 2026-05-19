/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { ChatInputRow } from './chat-input-row'
import { MessagesView } from './messages-view'
import { useChat } from './use-chat'
import type { AiChatIslandProps } from './types'
import type { ReactElement } from 'react'


const DEFAULT_CHAT_HEIGHT_PX = 400

export default function AiChatIsland(props: AiChatIslandProps): ReactElement {
  const { messages, status, send, retry } = useChat(props)
  const chatHeight = props.chatHeight ?? DEFAULT_CHAT_HEIGHT_PX

  const handleRetry = useCallback(() => retry(), [retry])

  return (
    <div className="flex h-full flex-col">
      <MessagesView
        messages={messages}
        status={status}
        chatHeight={chatHeight}
      />

      {status === 'error' && (
        <div
          data-testid="chat-error"
          role="alert"
          className="flex items-center justify-between gap-2 border-t border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>The assistant is unavailable. Please try again.</span>
          <button
            type="button"
            data-testid="chat-retry"
            onClick={handleRetry}
            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      <ChatInputRow
        placeholder={props.placeholder ?? 'Ask a question…'}
        isSending={status === 'sending'}
        allowAttachments={props.allowAttachments === true}
        initialDraft={props.initialValues?.message ?? ''}
        onSend={send}
      />
    </div>
  )
}
