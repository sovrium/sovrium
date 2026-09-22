/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback } from 'react'
import { computeAiChatErrorClasses } from '@/presentation/design/ai-chat-default-classes'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
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

/**
 * Retry is a recovery affordance, not a destructive one — the error tone is
 * already carried by the block it sits in, so the button stays quiet.
 */
const RETRY_BUTTON = computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })

export default function AiChatIsland(props: AiChatIslandProps): ReactElement {
  const { messages, status, send, retry } = useChat(props)

  const handleRetry = useCallback(() => retry(), [retry])

  return (
    // FRAMELESS on purpose — see the comments island for the same reasoning:
    // this renders inside the SSR host, which already draws the panel. Before R-E
    // both sides drew it and a hydrated chat carried two nested borders.
    //
    // HEIGHTLESS for the same reason, since [internal ref]: the host
    // carries the author's `chatHeight` as an inline style, so this fills it
    // (`h-full`) and re-establishes the identical flex column the SSR skeleton
    // draws — log, composer, chips, in that order, with the log absorbing the
    // slack. Reading `chatHeight` here again would put a second sizer on one
    // prop, which is exactly the defect that clipped the composer.
    <div className="flex h-full flex-col overflow-hidden">
      <MessagesView
        messages={messages}
        status={status}
      />

      {status === 'error' && (
        <div
          data-testid="chat-error"
          role="alert"
          className={`${computeAiChatErrorClasses()} flex items-center gap-2`}
        >
          <span>The assistant is unavailable. Please try again.</span>
          <button
            type="button"
            data-testid="chat-retry"
            onClick={handleRetry}
            className={RETRY_BUTTON}
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
        suggestions={props.suggestions}
        onSend={send}
      />
    </div>
  )
}
