/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense, useCallback, useMemo } from 'react'
import { computeAiChatErrorClasses } from '@/presentation/design/ai-chat-composition-classes'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { ChatInputRow } from './chat-input-row'
import { MessagesView } from './messages-view'
import { useChat } from './use-chat'
import type { AiChatIslandProps, BranchLabels } from './types'
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
 * Wires the transcript and the chat stream (`POST /api/ai/chat/stream`) into
 * a working chat surface, composed from the conversation types: a
 * `message-scroller` of `message` turns, a live `marker` while a reply is
 * arriving, a separator `marker` after replayed history (`showHistory`),
 * picked files as `attachment` chips, and an `input-group` composer; a failed
 * turn shows a line with a retry button.
 */

/**
 * Retry is a recovery affordance, not a destructive one — the error tone is
 * already carried by the block it sits in, so the button stays quiet.
 */
const RETRY_BUTTON = computePartButtonClasses({ variant: 'outline', size: 'sm' })

/** The conversation list, loaded only by a chat that shows one (`conversations: true`). */
const ConversationSwitcher = lazy(() =>
  import('./chat-branch-controls').then((module) => ({ default: module.ConversationSwitcher }))
)

/** A failed turn: the line saying so, and its Retry. */
const ChatError = ({
  failure,
  retry,
  onRetry,
}: {
  readonly failure: string
  readonly retry: string
  readonly onRetry: () => void
}): ReactElement => (
  <div
    data-testid="chat-error"
    role="alert"
    className={computeAiChatErrorClasses()}
  >
    <span>{failure}</span>
    <button
      type="button"
      data-testid="chat-retry"
      onClick={onRetry}
      className={RETRY_BUTTON}
    >
      {retry}
    </button>
  </div>
)

/** The panel's header: its Conversations button, for a chat that lists them. */
const ChatHeader = ({
  agent,
  labels,
  busy,
  chat,
}: {
  readonly agent: string | undefined
  readonly labels: BranchLabels
  readonly busy: boolean
  readonly chat: ReturnType<typeof useChat>
}): ReactElement => (
  <Suspense fallback={null}>
    <ConversationSwitcher
      agent={agent}
      sessionId={chat.sessionId}
      labels={labels}
      busy={busy}
      showBranch={chat.showBranch}
      onNew={chat.startConversation}
    />
  </Suspense>
)

/**
 * The panel's inside. FRAMELESS on purpose — see the comments island for the
 * same reasoning: this renders inside the SSR host, which already draws the
 * panel. Before R-E both sides drew it and a hydrated chat carried two nested
 * borders.
 *
 * HEIGHTLESS for the same reason, since [internal ref]: the host carries
 * the author's `chatHeight` as an inline style, so this fills it (`h-full`) and
 * re-establishes the identical flex column the SSR skeleton draws — log,
 * composer, chips, in that order, with the log absorbing the slack. Reading
 * `chatHeight` here again would put a second sizer on one prop, which is
 * exactly the defect that clipped the composer.
 */
export default function AiChatIsland(props: AiChatIslandProps): ReactElement {
  const chat = useChat(props)
  const { messages, status, send, retry, stop, decide, answer } = chat
  const busy = status === 'sending' || status === 'streaming'
  const { labels } = props
  const handleRetry = useCallback(() => retry(), [retry])
  const stopControl = useMemo(
    () => (status === 'streaming' ? { label: labels.stop, onStop: stop } : undefined),
    [status, labels.stop, stop]
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {props.conversations === true && (
        <ChatHeader
          agent={props.agent}
          labels={labels.branch}
          busy={busy}
          chat={chat}
        />
      )}
      <MessagesView
        messages={messages}
        status={status}
        labels={labels}
        onDecide={decide}
        onAnswer={answer}
        sessionId={chat.sessionId}
        showBranch={chat.showBranch}
        showUsage={props.showUsage === true}
      />

      {status === 'error' && (
        <ChatError
          failure={labels.failure}
          retry={labels.retry}
          onRetry={handleRetry}
        />
      )}

      <ChatInputRow
        placeholder={props.placeholder ?? ''}
        isSending={busy}
        labels={labels}
        stop={stopControl}
        allowAttachments={props.allowAttachments === true || props.uploads !== undefined}
        uploadChatId={props.uploads?.chatId}
        initialDraft={props.initialValues?.message ?? ''}
        suggestions={props.suggestions}
        voiceInput={props.voiceInput}
        onSend={send}
      />
    </div>
  )
}
