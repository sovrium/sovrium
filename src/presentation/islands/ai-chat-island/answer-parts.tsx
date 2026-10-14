/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeAiChatAnswerContentClasses,
  computeAiChatBubbleClasses,
  computeAiChatToolDecisionClasses,
} from '@/presentation/design/ai-chat-composition-classes'
import {
  computeMarkerClasses,
  computeMarkerContentClasses,
} from '@/presentation/design/marker-default-classes'
import { AttachmentChip } from './attachment-chip'
import type { ChatCitation, ChatLabels, ChatMessage, ChatToolLine } from './types'
import type { ReactElement } from 'react'

/**
 * The parts of an assistant turn beyond its text, each a `marker` like the
 * transcript's other status lines: the model's reasoning, collapsed; a line
 * per tool the agent called, saying where it stands in words, with Approve and
 * Deny while a call waits for the reader; and the line a stopped answer keeps. Plus the answer's bubble, drawn
 * from the Markdown the server rendered and sanitized.
 */

/** The words the parts read, in the page language. */
export type AnswerLabels = Pick<
  ChatLabels,
  | 'reasoning'
  | 'stopped'
  | 'approve'
  | 'deny'
  | 'awaitingApproval'
  | 'denied'
  | 'failed'
  | 'running'
  | 'closed'
>

/**
 * The words after a tool's name, by where it stands: none once done, and none
 * for a call held without the id to decide it by.
 */
const stateWords = (tool: ChatToolLine, labels: AnswerLabels): string | undefined =>
  tool.state === 'pending-approval'
    ? tool.approvalId === undefined
      ? undefined
      : labels.awaitingApproval
    : tool.state === 'done'
      ? undefined
      : labels[tool.state]

/**
 * The model's reasoning: a marker holding a closed disclosure. Its summary
 * drops the native triangle for a chevron that turns when it opens, and the
 * reasoning reads muted, set off by a start rule, so it never competes with
 * the answer.
 */
export const ReasoningMarker = ({
  text,
  label,
}: {
  readonly text: string
  readonly label: string
}): ReactElement => (
  <div
    data-slot="marker"
    data-variant="default"
    data-testid="chat-reasoning"
    className={computeMarkerClasses('default')}
  >
    <details
      data-slot="marker-content"
      className={`group ${computeMarkerContentClasses()}`}
    >
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 select-none [&::-webkit-details-marker]:hidden">
        {label}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="size-3.5 transition-transform group-open:rotate-180"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <p className="text-muted-foreground mt-1 border-l pl-3 whitespace-pre-wrap">{text}</p>
    </details>
  </div>
)

/** One tool the agent called: its name, its state, and the decision while it is held. */
export const ToolLine = ({
  tool,
  labels,
  busy,
  onDecide,
}: {
  readonly tool: ChatToolLine
  readonly labels: AnswerLabels
  /** A request is in flight: the decision cannot be sent twice. */
  readonly busy: boolean
  readonly onDecide: (approvalId: string, decision: 'approve' | 'reject') => void
}): ReactElement => {
  const { approvalId } = tool
  const held = tool.state === 'pending-approval' && approvalId !== undefined
  const words = stateWords(tool, labels)
  return (
    <div
      data-slot="marker"
      data-variant="default"
      data-testid="chat-tool"
      data-tool-name={tool.name}
      data-tool-state={tool.state}
      aria-busy={tool.state === 'running' ? true : undefined}
      className={`${computeMarkerClasses('default')} flex-wrap`}
    >
      <span
        data-slot="marker-content"
        className={computeMarkerContentClasses()}
      >
        <code>{tool.name}</code>
        {words !== undefined && ` · ${words}`}
      </span>
      {held && (
        <span className="flex gap-1.5">
          <button
            type="button"
            data-testid="chat-approve"
            disabled={busy}
            onClick={() => onDecide(approvalId, 'approve')}
            className={computeAiChatToolDecisionClasses('default')}
          >
            {labels.approve}
          </button>
          <button
            type="button"
            data-testid="chat-deny"
            disabled={busy}
            onClick={() => onDecide(approvalId, 'reject')}
            className={computeAiChatToolDecisionClasses('outline')}
          >
            {labels.deny}
          </button>
        </span>
      )}
    </div>
  )
}

/** The line a stopped answer keeps, after what had arrived. */
export const StoppedMarker = ({ label }: { readonly label: string }): ReactElement => (
  <div
    data-slot="marker"
    data-variant="default"
    data-testid="chat-stopped"
    className={computeMarkerClasses('default')}
  >
    <span
      data-slot="marker-content"
      className={computeMarkerContentClasses()}
    >
      {label}
    </span>
  </div>
)

/** The element id of a cited source, which the citation's number links to. */
const sourceId = (message: ChatMessage, index: number): string =>
  `${message.id}-source-${String(index)}`

/**
 * The answer's rendering with each number it cites (`[1]`) as a link to its
 * source under the bubble. Only a number the answer cites is linked, and what
 * is inserted is that number and an id the panel minted, never text of the
 * answer, so the server's sanitized markup stays sanitized.
 *
 * Only TEXT is rewritten: a tag is matched first and kept whole, so a `[1]`
 * inside an attribute (a link's `title`, its `href`) is never split open. The
 * sanitizer escapes `<` and `>` in attribute values, so a tag ends at its
 * first `>`.
 */
const withCitationLinks = (message: ChatMessage, html: string): string => {
  const cited = new Set((message.citations ?? []).map((citation) => citation.index))
  return cited.size === 0
    ? html
    : html.replace(/<[^>]*>|\[(\d+)\]/g, (match, number: string | undefined) =>
        number !== undefined && cited.has(Number(number))
          ? `<sup><a data-testid="chat-citation" href="#${sourceId(message, Number(number))}">${number}</a></sup>`
          : match
      )
}

/** A cited source as the chip draws a stored file: its label, nothing to fetch. */
const sourceFile = (citation: ChatCitation) =>
  ({ name: citation.label, size: 0, state: 'done' }) as const

/** The sources an answer cites, under its bubble, as `attachment` chips a citation links to. */
export const CitedSources = ({
  message,
  label,
}: {
  readonly message: ChatMessage
  readonly label: string
}): ReactElement => (
  <div
    data-testid="chat-sources"
    role="group"
    aria-label={label}
    className="flex flex-wrap gap-1.5"
  >
    {(message.citations ?? []).map((citation: ChatCitation) => (
      <AttachmentChip
        key={citation.index}
        id={sourceId(message, citation.index)}
        file={sourceFile(citation)}
        description={citation.excerpt}
        notSentLabel=""
      />
    ))}
  </div>
)

/**
 * The answer's bubble. Its Markdown is rendered and passed through the ONE
 * canonical sanitizer on the server (S2) and arrives as `html` — the browser
 * ships neither a Markdown renderer nor a sanitizer. The text that arrived
 * since the last rendering follows it as plain text, which React escapes,
 * until the next rendering covers it; an answer with no rendering yet is all
 * plain text.
 */
export const AnswerBubble = ({ message }: { readonly message: ChatMessage }): ReactElement => {
  const tail = message.content.slice(message.html === undefined ? 0 : (message.htmlCovers ?? 0))
  return (
    <div
      data-slot="bubble"
      data-align="start"
      className={computeAiChatBubbleClasses()}
    >
      <div
        data-slot="bubble-content"
        className={computeAiChatAnswerContentClasses()}
      >
        {message.html !== undefined && (
          // eslint-disable-next-line sovrium/require-sanitized-html, react-perf/jsx-no-new-object-as-prop -- markup is the server's `sanitizeRichTextHTML` output, carried on the chat stream; the browser does not ship the sanitizer (see the note above)
          <div dangerouslySetInnerHTML={{ __html: withCitationLinks(message, message.html) }} />
        )}
        {tail.length > 0 && <span className="whitespace-pre-wrap">{tail}</span>}
      </div>
    </div>
  )
}
