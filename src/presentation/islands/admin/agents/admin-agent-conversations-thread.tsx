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
 * A message's `toolCalls` render as collapsed rows under its bubble
 * (`-tool-calls`), and its model as a badge beside its role. A `tool` turn's
 * body is the tool's own output, kept monospaced.
 * Its idle / loading / error states live here so the island stays a thin render
 * under the per-island `max-lines` cap.
 */

import { type ReactElement } from 'react'
import { conversationCaptions } from './admin-agent-conversations-captions'
import {
  formatDateTime,
  roleLabel,
  type ConversationHeader,
  type ThreadMessage,
  type ThreadState,
} from './admin-agent-conversations-data'
import { useAgentConversationString as useWord } from './admin-agent-conversations-strings'
import { ToolCalls } from './admin-agent-conversations-tool-calls'

/** The catalogue key of each speaker's tag (`agentConversations.role*`). */
const ROLE_KEYS: Readonly<Record<string, string>> = {
  user: 'roleUser',
  assistant: 'roleAssistant',
  tool: 'roleTool',
  system: 'roleSystem',
}
/** A single message turn, aligned + styled by role. */
function MessageTurn({ message }: { readonly message: ThreadMessage }): ReactElement {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const align = isUser ? 'items-end' : 'items-start'
  const bubble = isUser
    ? 'bg-muted text-muted-foreground'
    : isTool
      ? 'bg-muted text-muted-foreground border-border border font-mono'
      : 'bg-card text-foreground border-border border'

  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      <div className="text-foreground-subtle flex items-center gap-2 px-1 text-sm">
        <span className="font-medium">
          {useWord(ROLE_KEYS[message.role] ?? '', roleLabel(message.role))}
        </span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{formatDateTime(message.createdAt)}</span>
        {message.model ? (
          <span
            data-testid="message-model"
            title={conversationCaptions().model}
            className="border-border text-muted-foreground rounded border px-1.5 py-px font-mono text-xs"
          >
            {message.model}
          </span>
        ) : undefined}
      </div>
      <div className={`text-md max-w-[44rem] rounded-lg px-3.5 py-2.5 leading-relaxed ${bubble}`}>
        {isTool ? (
          <pre className="overflow-x-auto text-sm whitespace-pre-wrap">{message.content}</pre>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
      <ToolCalls payload={message.toolCalls} />
      <MessageFootnote message={message} />
    </div>
  )
}

/** The per-message footnote: the token count on agent turns, the "interrupted" marker. */
function MessageFootnote({
  message,
}: {
  readonly message: ThreadMessage
}): ReactElement | undefined {
  const parts: ReadonlyArray<string> = [
    typeof message.tokenCount === 'number' ? `${message.tokenCount} tokens` : '',
  ].filter((part) => part.length > 0)
  const interrupted = message.status === 'incomplete'
  if (parts.length === 0 && !interrupted) return undefined
  return (
    <div className="text-foreground-subtle flex items-center gap-2 px-1 text-sm">
      {parts.length > 0 ? <span className="font-mono">{parts.join(' · ')}</span> : undefined}
      {interrupted ? (
        <span className="text-muted-foreground inline-flex items-center gap-1 font-medium">
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
      <h3 className="text-foreground text-xl font-semibold tracking-tight">{header.title}</h3>
      <p className="text-foreground-subtle flex flex-wrap items-center gap-2 text-sm">
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
      className="border-border bg-card flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center"
    >
      <p className="text-foreground text-md font-medium">{title}</p>
      <p className="text-muted-foreground text-md max-w-sm leading-relaxed">{body}</p>
      {children}
    </section>
  )
}

/** The loading skeleton for the thread column. */
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
}: {
  readonly state: ThreadState
  readonly onRetry: () => void
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
  if (state.phase === 'loading') return <ThreadLoading />
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
      <p
        data-testid="conversation-read-only"
        className="border-border text-foreground-subtle border-t pt-3 text-sm"
      >
        {conversationCaptions().readOnly}
      </p>
    </div>
  )
}
