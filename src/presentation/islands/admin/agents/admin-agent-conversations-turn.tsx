/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * One turn of a conversation thread, as the read-only transcript draws it.
 *
 * A question is a muted bubble on the right; an answer is plain text on the
 * left, at the reading width, because it is what the operator came to read and
 * a frame around it only adds a border to look past. A `tool` turn keeps a
 * monospaced frame: its body is a tool's raw output, not prose. Each turn is
 * labelled with who spoke — the person on a question, the agent on an answer —
 * and when, with the model as a badge on an answer that names one.
 */

import { type ReactElement } from 'react'
import { conversationCaptions } from './admin-agent-conversations-captions'
import { formatDateTime, roleLabel, type ThreadMessage } from './admin-agent-conversations-data'
import { useAgentConversationString as useWord } from './admin-agent-conversations-strings'
import { ToolCalls } from './admin-agent-conversations-tool-calls'

/** The catalogue key of each speaker's tag (`agentConversations.role*`). */
const ROLE_KEYS: Readonly<Record<string, string>> = {
  user: 'roleUser',
  assistant: 'roleAssistant',
  tool: 'roleTool',
  system: 'roleSystem',
}

/**
 * The name a turn is labelled with: the person on a question, the agent on an
 * answer — the role's word only where neither is known, or for a tool or
 * system turn.
 */
function useAuthor(role: string, person: string, agent: string): string {
  const word = useWord(ROLE_KEYS[role] ?? '', roleLabel(role))
  if (role === 'user' && person !== '') return person
  if (role === 'assistant' && agent !== '') return agent
  return word
}

/** The body classes of a turn, by who spoke. */
const bodyClasses = (role: string): string => {
  if (role === 'user') return 'bg-muted text-foreground max-w-[80%] rounded-2xl px-4 py-2.5'
  if (role === 'tool')
    return 'bg-muted text-muted-foreground border-border w-full rounded-lg border px-3.5 py-2.5 font-mono'
  return 'text-foreground w-full max-w-[44rem] px-1'
}

/** A single message turn, aligned + styled by role. */
export function MessageTurn({
  message,
  person,
  agent,
}: {
  readonly message: ThreadMessage
  readonly person: string
  readonly agent: string
}): ReactElement {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs">
        <span className="text-foreground font-medium">
          {useAuthor(message.role, person, agent)}
        </span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{formatDateTime(message.createdAt)}</span>
        {message.model ? (
          <span
            data-testid="message-model"
            title={conversationCaptions().model}
            className="border-border text-muted-foreground rounded-md border px-1.5 font-mono text-xs"
          >
            {message.model}
          </span>
        ) : undefined}
      </div>
      <div className={`text-md leading-relaxed ${bodyClasses(message.role)}`}>
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
    <div className="text-muted-foreground flex items-center gap-2 px-1 text-xs">
      {parts.length > 0 ? <span className="font-mono">{parts.join(' · ')}</span> : undefined}
      {interrupted ? (
        <span className="inline-flex items-center gap-1 font-medium">
          <span aria-hidden="true">•</span> reply interrupted
        </span>
      ) : undefined}
    </div>
  )
}
