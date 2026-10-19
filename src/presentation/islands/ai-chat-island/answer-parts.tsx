/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import {
  computeAiChatAnswerContentClasses,
  computeAiChatBubbleClasses,
} from '@/presentation/design/ai-chat-composition-classes'
import {
  computeMarkerClasses,
  computeMarkerContentClasses,
} from '@/presentation/design/marker-default-classes'
import { AttachmentChip } from './attachment-chip'
import type { ChatCitation, ChatMessage } from './types'
import type { KeyboardEvent, ReactElement, SyntheticEvent } from 'react'

/**
 * The parts of an assistant turn beyond its trace (`trace-parts.tsx`): the line
 * a stopped answer keeps, the answer's bubble, drawn from the Markdown the
 * server rendered and sanitized, and the sources it cites.
 */

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

/** The hover card of a cited number, loaded the first time one is reached. */
const CitationCard = lazy(() => import('./citation-card'))

/** How long the card stays once the pointer leaves the number, to let it reach the card. */
const CLOSE_DELAY_MS = 200

/** The cited number an event reached, if any. */
const citedNumber = (target: EventTarget): Element | null =>
  target instanceof Element ? target.closest('[data-testid="chat-citation"]') : null

/**
 * The hover card of the answer's cited numbers: opened on the number the
 * pointer rests on or the keyboard reaches, closed when it leaves, on blur
 * and on Escape — the focus staying on the number.
 */
const useCitationCard = (message: ChatMessage) => {
  const [anchor, setAnchor] = useState<Element | undefined>(undefined)
  const timer = useRef<number | undefined>(undefined)
  const stay = useCallback(() => window.clearTimeout(timer.current), [])
  const close = useCallback(() => {
    window.clearTimeout(timer.current)
    setAnchor(undefined)
  }, [])
  const open = useCallback(
    (event: SyntheticEvent) => {
      const number = citedNumber(event.target)
      if (number === null) return
      stay()
      setAnchor(number)
    },
    [stay]
  )
  const leave = useCallback((event: SyntheticEvent) => {
    if (citedNumber(event.target) !== null)
      timer.current = window.setTimeout(() => setAnchor(undefined), CLOSE_DELAY_MS)
  }, [])
  const escape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    },
    [close]
  )
  const citation = (message.citations ?? []).find(
    (cited) => cited.index === Number(anchor?.textContent)
  )
  const card =
    anchor === undefined || citation === undefined ? null : (
      <Suspense fallback={null}>
        <CitationCard
          citation={citation}
          anchor={anchor}
          onClose={close}
          onStay={stay}
        />
      </Suspense>
    )
  return {
    card,
    handlers: {
      onPointerOver: open,
      onFocus: open,
      onPointerOut: leave,
      onBlur: close,
      onKeyDown: escape,
    },
  }
}

/**
 * The answer's bubble. Its Markdown is rendered and passed through the ONE
 * canonical sanitizer on the server (S2) and arrives as `html` — the browser
 * ships neither a Markdown renderer nor a sanitizer. The text that arrived
 * since the last rendering follows it as plain text, which React escapes,
 * until the next rendering covers it; an answer with no rendering yet is all
 * plain text. A cited number shows its passage in a hover card.
 */
export const AnswerBubble = ({ message }: { readonly message: ChatMessage }): ReactElement => {
  const tail = message.content.slice(message.html === undefined ? 0 : (message.htmlCovers ?? 0))
  const { card, handlers } = useCitationCard(message)
  return (
    <div
      data-slot="bubble"
      data-align="start"
      className={computeAiChatBubbleClasses()}
    >
      <div
        data-slot="bubble-content"
        className={computeAiChatAnswerContentClasses()}
        {...handlers}
      >
        {message.html !== undefined && (
          <div
            className="typeset typeset-chat"
            // eslint-disable-next-line sovrium/require-sanitized-html, react-perf/jsx-no-new-object-as-prop -- markup is the server's `sanitizeRichTextHTML` output, carried on the chat stream; the browser does not ship the sanitizer (see the note above)
            dangerouslySetInnerHTML={{ __html: withCitationLinks(message, message.html) }}
          />
        )}
        {tail.length > 0 && <span className="whitespace-pre-wrap">{tail}</span>}
      </div>
      {card}
    </div>
  )
}
