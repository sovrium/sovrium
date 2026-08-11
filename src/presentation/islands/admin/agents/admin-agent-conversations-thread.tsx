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
 * tool call, and an "interrompu" marker for a streamed turn that never finished.
 * Its idle / loading / error states live here so the island stays a thin render
 * under the per-island `max-lines` cap.
 */

import { type ReactElement } from 'react'
import {
  formatDateTime,
  roleLabel,
  type ConversationHeader,
  type ThreadMessage,
  type ThreadState,
} from './admin-agent-conversations-data'

/** Format a tool-call payload (or a JSON tool message body) as readable text. */
function formatToolPayload(message: ThreadMessage): string {
  if (message.toolCalls != undefined) {
    try {
      return JSON.stringify(message.toolCalls, undefined, 2)
    } catch {
      return String(message.toolCalls)
    }
  }
  return message.content
}

/** A single message turn, aligned + styled by role. */
function MessageTurn({ message }: { readonly message: ThreadMessage }): ReactElement {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const align = isUser ? 'items-end' : 'items-start'
  const bubble = isUser
    ? 'bg-background-subtle text-foreground-muted'
    : isTool
      ? 'bg-background-subtle text-foreground-muted border-border border font-mono'
      : 'bg-background-raised text-foreground border-border border'

  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      <div className="text-foreground-subtle flex items-center gap-2 px-1 text-xs">
        <span className="font-medium">{roleLabel(message.role)}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{formatDateTime(message.createdAt)}</span>
      </div>
      <div className={`max-w-[44rem] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${bubble}`}>
        {isTool ? (
          <pre className="overflow-x-auto text-xs whitespace-pre-wrap">
            {formatToolPayload(message)}
          </pre>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
      <MessageFootnote message={message} />
    </div>
  )
}

/** The per-message footnote: model + token count on agent turns, "interrompu" marker. */
function MessageFootnote({
  message,
}: {
  readonly message: ThreadMessage
}): ReactElement | undefined {
  const parts: ReadonlyArray<string> = [
    message.model ? message.model : '',
    typeof message.tokenCount === 'number' ? `${message.tokenCount} jetons` : '',
  ].filter((part) => part.length > 0)
  const interrupted = message.status === 'incomplete'
  if (parts.length === 0 && !interrupted) return undefined
  return (
    <div className="text-foreground-subtle flex items-center gap-2 px-1 text-xs">
      {parts.length > 0 ? <span className="font-mono">{parts.join(' · ')}</span> : undefined}
      {interrupted ? (
        <span className="text-foreground-muted inline-flex items-center gap-1 font-medium">
          <span aria-hidden="true">•</span> reply interrupted
        </span>
      ) : undefined}
    </div>
  )
}

/** The thread header: conversation title + session + created/last-activity. */
function ThreadHeader({ header }: { readonly header: ConversationHeader }): ReactElement {
  return (
    <header className="border-border flex flex-col gap-1 border-b pb-3">
      <h3 className="text-foreground text-lg font-semibold tracking-tight">{header.title}</h3>
      <p className="text-foreground-subtle flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono">{header.sessionId}</span>
        <span aria-hidden="true">·</span>
        <span>Last activity {formatDateTime(header.lastActivityAt)}</span>
      </p>
    </header>
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
      className="border-border bg-background-raised flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center"
    >
      <p className="text-foreground text-sm font-medium">{title}</p>
      <p className="text-foreground-muted max-w-sm text-sm leading-relaxed">{body}</p>
      {children}
    </section>
  )
}

/** The loading skeleton for the thread column. */
function ThreadLoading(): ReactElement {
  return (
    <div
      aria-label="Loading conversation"
      aria-busy="true"
      className="flex flex-col gap-3"
    >
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className={[
            'bg-background-subtle border-border h-16 animate-pulse rounded-lg border',
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
}: {
  readonly state: ThreadState
  readonly onRetry: () => void
}): ReactElement {
  if (state.phase === 'idle') {
    return (
      <ThreadStateCard
        label="No conversation selected"
        title="Select a conversation"
        body="Pick one from the list to read its messages."
      />
    )
  }
  if (state.phase === 'loading') return <ThreadLoading />
  if (state.phase === 'error') {
    return (
      <ThreadStateCard
        label="Couldn’t load"
        title="Couldn’t load the conversation"
        body="The messages could not be loaded. Try again."
      >
        <button
          type="button"
          onClick={onRetry}
          className="text-foreground-muted hover:text-foreground-muted/80 mt-1 text-sm font-medium"
        >
          Retry
        </button>
      </ThreadStateCard>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {state.header ? <ThreadHeader header={state.header} /> : undefined}
      <div
        aria-label="Message thread"
        className="flex flex-col gap-4"
      >
        {state.messages.map((message) => (
          <MessageTurn
            key={message.id}
            message={message}
          />
        ))}
      </div>
    </div>
  )
}
