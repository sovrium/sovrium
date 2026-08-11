/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { computeAiChatContainerClasses } from '../recipes/specialty-islands-default-classes'
import { ChatInputRow } from './chat-input-row'
import { MessagesView } from './messages-view'
import { useChat } from './use-chat'
import type { AiChatIslandProps } from './types'
import type { ReactElement } from 'react'

/**
 * Interactive `ai-chat` island.
 *
 * Mounted by the island client into the SSR placeholder emitted by
 * `ai-chat-component.tsx`. The placeholder's `<div data-island="ai-chat">`
 * already carries `data-component="ai-chat"` and the author-declared `data-*`
 * attributes, so this component renders ONLY the inner chat surface (message
 * log + error banner + input row) — duplicating `data-component` here would
 * nest two markers and break strict-mode locator assertions.
 *
 * Wires the message log and the chat backend (`POST /api/ai/chat`) into a
 * working chat surface: progressively-revealed responses, a loading indicator,
 * an error banner with a retry button, an optional attachment button, and
 * conversation-history replay when `showHistory` is enabled.
 */

const DEFAULT_CHAT_HEIGHT_PX = 400

export default function AiChatIsland(props: AiChatIslandProps): ReactElement {
  const { messages, status, send, retry } = useChat(props)
  const chatHeight = props.chatHeight ?? DEFAULT_CHAT_HEIGHT_PX

  const handleRetry = useCallback(() => retry(), [retry])

  return (
    <div className={computeAiChatContainerClasses()}>
      <MessagesView
        messages={messages}
        status={status}
        chatHeight={chatHeight}
      />

      {status === 'error' && (
        <div
          data-testid="chat-error"
          role="alert"
          className="border-error-border bg-error-bg text-error-fg flex items-center justify-between gap-2 border-t px-3 py-2 text-sm"
        >
          <span>The assistant is unavailable. Please try again.</span>
          <button
            type="button"
            data-testid="chat-retry"
            onClick={handleRetry}
            className="bg-error-solid text-error-solid-fg rounded px-3 py-1 text-xs font-medium hover:opacity-90"
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
