/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  AI_CHAT_RESPONDING_DOT,
  AI_CHAT_TRANSCRIPT_FIT,
  computeAiChatBubbleClasses,
  computeAiChatBubbleContentClasses,
} from '@/presentation/design/ai-chat-composition-classes'
import {
  computeMarkerClasses,
  computeMarkerContentClasses,
} from '@/presentation/design/marker-default-classes'
import {
  computeMessageClasses,
  computeMessageContentClasses,
} from '@/presentation/design/message-default-classes'
import { computeMessageScrollerClasses } from '@/presentation/design/message-scroller-default-classes'
import {
  AnswerBubble,
  CitedSources,
  ReasoningMarker,
  StoppedMarker,
  ToolLine,
} from './answer-parts'
import { AttachmentChip } from './attachment-chip'
import { ChatElicitationPart } from './chat-elicitation'
import { isBlankAnswer } from './chat-stream-client'
import type { ChatElicitationAnswer, ChatLabels, ChatMessage, ChatStatus } from './types'
import type { ReactElement } from 'react'

/** A saved turn's Edit, Regenerate and pager, loaded with the first saved turn. */
const TurnFooter = lazy(() =>
  import('./chat-branch-controls').then((module) => ({ default: module.TurnFooter }))
)

/**
 * The transcript of the `ai-chat` island, composed from the conversation
 * types: the frame is a `message-scroller`, each turn a `message` holding a
 * bubble (and the files the reader picked, as `attachment` chips that say the
 * agent did not receive them), the
 * "responding" indicator a live `marker`, and replayed history is closed by a
 * separator `marker`.
 *
 * It takes NO height: the panel owns `chatHeight`, and
 * the frame takes what the composer leaves it and scrolls the rest. It keeps
 * the latest turn in view on every update.
 */

interface MessagesViewProps {
  readonly messages: readonly ChatMessage[]
  readonly status: ChatStatus
  /** Every engine-written word, in the page language. */
  readonly labels: ChatLabels
  /** Approve or deny a call the agent holds. */
  readonly onDecide: (approvalId: string, decision: 'approve' | 'reject') => void
  /** Answer a question the agent asks. */
  readonly onAnswer: (elicitationId: string, answer: ChatElicitationAnswer) => void
  /** The conversation on screen, and the branch a turn's actions answer. */
  readonly sessionId: string
  readonly showBranch: (branch: Promise<readonly ChatMessage[]>) => void
}

/** What a turn needs beyond itself: the view's props, and whether a request is in flight. */
interface TurnContext extends MessagesViewProps {
  readonly busy: boolean
}

/**
 * An assistant turn's parts in reading order: its reasoning, the tools it
 * called, the question it asked the reader, the answer, and the line a
 * stopped answer keeps.
 */
const AnswerParts = ({
  message,
  context,
}: {
  readonly message: ChatMessage
  readonly context: TurnContext
}): ReactElement => (
  <>
    {(message.reasoning ?? '').length > 0 && (
      <ReasoningMarker
        text={message.reasoning ?? ''}
        label={context.labels.reasoning}
      />
    )}
    {(message.tools ?? []).map((tool) => (
      <ToolLine
        key={tool.id}
        tool={tool}
        labels={context.labels}
        busy={context.busy}
        onDecide={context.onDecide}
      />
    ))}
    {message.elicitation !== undefined && (
      <ChatElicitationPart
        elicitation={message.elicitation}
        labels={context.labels.question}
        busy={context.busy}
        onAnswer={context.onAnswer}
      />
    )}
    {message.content.length > 0 && <AnswerBubble message={message} />}
    {(message.citations ?? []).length > 0 && (
      <CitedSources
        message={message}
        label={context.labels.sources}
      />
    )}
    {message.stopReason === 'stopped' && <StoppedMarker label={context.labels.stopped} />}
  </>
)

/** The reader's question, exactly as typed, in its bubble. */
const QuestionBubble = ({ text }: { readonly text: string }): ReactElement => (
  <div
    data-slot="bubble"
    data-align="end"
    className={computeAiChatBubbleClasses()}
  >
    <div
      data-slot="bubble-content"
      className={computeAiChatBubbleContentClasses('user')}
    >
      {text}
    </div>
  </div>
)

/**
 * A saved turn's actions, once it is saved and done arriving. While a question
 * is edited, the editor takes the place of its bubble.
 */
const SavedTurnFooter = ({
  message,
  context,
  editing,
}: {
  readonly message: ChatMessage
  readonly context: TurnContext
  readonly editing: readonly [boolean, (editing: boolean) => void]
}): ReactElement | null =>
  message.serverId === undefined || message.streaming === true ? null : (
    <Suspense fallback={null}>
      <TurnFooter
        message={message}
        sessionId={context.sessionId}
        labels={context.labels.branch}
        busy={context.busy}
        showBranch={context.showBranch}
        editing={editing}
      />
    </Suspense>
  )

/** One turn: a `message` whose surface is a bubble, with its files under it. */
function Turn({
  message,
  index,
  context,
}: {
  readonly message: ChatMessage
  readonly index: number
  readonly context: TurnContext
}): ReactElement {
  const role = message.role === 'user' ? 'user' : 'assistant'
  const align = role === 'user' ? 'end' : 'start'
  const editing = useState(false)
  return (
    <div
      data-slot="message"
      data-align={align}
      data-message-role={message.role}
      data-testid={`message-${index}`}
      data-streaming={message.streaming === true ? 'true' : undefined}
      data-stop-reason={message.stopReason === 'end' ? undefined : message.stopReason}
      className={computeMessageClasses()}
    >
      <div
        data-slot="message-content"
        className={computeMessageContentClasses()}
      >
        {role === 'assistant' && (
          <AnswerParts
            message={message}
            context={context}
          />
        )}
        {role === 'user' && message.content.length > 0 && !editing[0] && (
          <QuestionBubble text={message.content} />
        )}
        {(message.attachments ?? []).map((file, fileIndex) => (
          <AttachmentChip
            key={`${fileIndex}:${file.name}`}
            file={file}
            notSentLabel={context.labels.notSent}
          />
        ))}
        <SavedTurnFooter
          message={message}
          context={context}
          editing={editing}
        />
      </div>
    </div>
  )
}

/** The live marker shown while the assistant is responding. */
const RespondingMarker = ({ label }: { readonly label: string }): ReactElement => (
  <div
    data-slot="marker"
    data-variant="default"
    data-testid="chat-loading"
    role="status"
    aria-label={label}
    className={computeMarkerClasses('default')}
  >
    <span
      data-slot="marker-content"
      className={`${computeMarkerContentClasses()} flex gap-1 py-1`}
    >
      <span className={AI_CHAT_RESPONDING_DOT} />
      <span className={`${AI_CHAT_RESPONDING_DOT} [animation-delay:150ms]`} />
      <span className={`${AI_CHAT_RESPONDING_DOT} [animation-delay:300ms]`} />
    </span>
  </div>
)

/** The separator closing the replayed turns, so new turns read as new. */
const HistoryMarker = ({ label }: { readonly label: string }): ReactElement => (
  <div
    data-slot="marker"
    data-variant="separator"
    data-testid="chat-history-marker"
    className={computeMarkerClasses('separator')}
  >
    <span
      data-slot="marker-content"
      className={computeMarkerContentClasses()}
    >
      {label}
    </span>
  </div>
)

export function MessagesView(props: MessagesViewProps): ReactElement {
  const { messages, status, labels } = props
  const frameRef = useRef<HTMLDivElement>(null)

  // Keep the latest turn in view on every update.
  useEffect(() => {
    const frame = frameRef.current
    if (frame !== null) frame.scrollTo({ top: frame.scrollHeight })
  }, [messages, status])

  const replayed = messages.filter((message) => message.id.startsWith('history-')).length
  const context: TurnContext = { ...props, busy: status === 'sending' || status === 'streaming' }
  // Waiting: nothing of the answer has arrived yet.
  const last = messages.at(-1)
  const waiting =
    status === 'sending' || (status === 'streaming' && last !== undefined && isBlankAnswer(last))

  return (
    <div
      ref={frameRef}
      data-slot="message-scroller"
      data-ai-chat-messages
      data-testid="chat-messages"
      role="log"
      aria-label={labels.log}
      aria-live="polite"
      aria-relevant="additions"
      className={`chat-messages ${computeMessageScrollerClasses()} ${AI_CHAT_TRANSCRIPT_FIT}`}
    >
      {messages.flatMap((message, index) => [
        <Turn
          key={message.id}
          message={message}
          index={index}
          context={context}
        />,
        ...(replayed > 0 && index === replayed - 1
          ? [
              <HistoryMarker
                key="history-marker"
                label={labels.history}
              />,
            ]
          : []),
      ])}
      {waiting && <RespondingMarker label={labels.responding} />}
    </div>
  )
}
