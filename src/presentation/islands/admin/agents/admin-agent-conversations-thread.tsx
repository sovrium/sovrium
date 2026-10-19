/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The message-THREAD column of the `admin-agent-conversations` island — the right
 * column of the ChatGPT-style two-column viewer. Renders the selected
 * conversation's header + its messages as a read-only transcript: user turns
 * right-aligned, agent / tool / system turns left-aligned, each tagged with its
 * role + time, with a model/token footnote on agent turns, a code block for a
 * tool call, and a "reply interrupted" marker for a streamed turn that never
 * finished.
 *
 * One turn is `-turn`, the head of the thread `-thread-header`; this module
 * holds the column's idle / loading / error states and the transcript around
 * them, so the island stays a thin render under the per-island `max-lines` cap.
 */

import { type ReactElement } from 'react'
import { conversationCaptions } from './admin-agent-conversations-captions'
import { type ThreadState } from './admin-agent-conversations-data'
import { useAgentConversationString as useWord } from './admin-agent-conversations-strings'
import {
  BackToList,
  ThreadHeader,
  type ThreadNames,
} from './admin-agent-conversations-thread-header'
import { MessageTurn } from './admin-agent-conversations-turn'

/** The eye the read-only note leads with. */
function Eye(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle
        cx="12"
        cy="12"
        r="3"
      />
    </svg>
  )
}

/** A centered state card for the thread column (idle / loading / error). */
function ThreadStateCard({
  label,
  title,
  body,
  children,
}: {
  readonly label: string
  readonly title: string
  readonly body: string
  readonly children?: ReactElement
}): ReactElement {
  return (
    <section
      aria-label={label}
      className="border-border bg-card flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border p-10 text-center"
    >
      <p className="text-foreground text-md font-medium">{title}</p>
      <p className="text-muted-foreground text-md max-w-sm leading-relaxed">{body}</p>
      {children}
    </section>
  )
}

/** The thread column's state words, in the console language (`agentConversations.*`). */
function useThreadWords() {
  return {
    idleLabel: useWord('idleLabel', 'No conversation selected'),
    idle: useWord('idle', 'Select a conversation'),
    idleBody: useWord('idleBody', 'Pick one from the list to read its messages.'),
    failedLabel: useWord('loadFailedLabel', 'Couldn’t load'),
    failed: useWord('threadFailed', 'Couldn’t load the conversation'),
    failedBody: useWord('threadFailedBody', 'The messages could not be loaded. Try again.'),
    retry: useWord('retry', 'Retry'),
  }
}

/** The loading skeleton for the thread column. */
function ThreadLoading(): ReactElement {
  return (
    <div
      aria-label={useWord('threadLoading', 'Loading conversation')}
      aria-busy="true"
      className="flex flex-col gap-3"
    >
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className={[
            'bg-muted border-border h-16 animate-pulse rounded-lg border',
            row % 2 === 0 ? 'mr-16' : 'ml-16',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

/** The message-thread column: the selected conversation's transcript, with states. */
export function ConversationThread({
  state,
  onRetry,
  onBack,
  names,
}: {
  readonly state: ThreadState
  readonly onRetry: () => void
  readonly onBack: () => void
  readonly names: ThreadNames
}): ReactElement {
  const { idleLabel, idle, idleBody, failedLabel, failed, failedBody, retry } = useThreadWords()
  if (state.phase === 'idle') {
    return (
      <ThreadStateCard
        label={idleLabel}
        title={idle}
        body={idleBody}
      />
    )
  }
  if (state.phase === 'loading') {
    return (
      <div className="flex flex-col gap-4">
        <BackToList onBack={onBack} />
        <ThreadLoading />
      </div>
    )
  }
  if (state.phase === 'error') {
    return (
      <ThreadStateCard
        label={failedLabel}
        title={failed}
        body={failedBody}
      >
        <button
          type="button"
          onClick={onRetry}
          className="text-muted-foreground hover:text-muted-foreground/80 text-md mt-1 font-medium"
        >
          {retry}
        </button>
      </ThreadStateCard>
    )
  }
  return (
    <ThreadTranscript
      state={state}
      onBack={onBack}
      names={names}
    />
  )
}

/** A loaded thread: the way back, its header, its messages and the read-only note. */
function ThreadTranscript({
  state,
  onBack,
  names,
}: {
  readonly state: ThreadState
  readonly onBack: () => void
  readonly names: ThreadNames
}): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <BackToList onBack={onBack} />
      {state.header ? (
        <ThreadHeader
          header={state.header}
          messages={state.messages}
          names={names}
        />
      ) : undefined}
      <div
        aria-label="Message thread"
        className="flex flex-col gap-5"
      >
        {state.messages.map((message) => (
          <MessageTurn
            key={message.id}
            message={message}
            person={state.header?.userName ?? ''}
            agent={names.agentLabel}
          />
        ))}
      </div>
      <p
        data-testid="conversation-read-only"
        className="border-border text-muted-foreground flex items-center gap-2 border-t pt-3 text-sm"
      >
        <Eye />
        {conversationCaptions().readOnly}
      </p>
    </div>
  )
}
