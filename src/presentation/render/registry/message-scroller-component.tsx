/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { computeMessageScrollerClasses } from '../../design/message-scroller-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { FOLLOWED_PARENT_KEY, READ_STATE_PARENT_KEY } from '../resolve/conversation-read-state'
import { CONVERSATION_DIGEST_KEY } from '../resolve/conversation-rows'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { CSSProperties } from 'react'

/**
 * A bound frame's binding, as its island follows it: the table, and the
 * refresh its `dataSource` asks for. Nothing for an unbound frame.
 */
const liveSourceOf = (dataSource: unknown): Readonly<Record<string, unknown>> => {
  if (dataSource === null || typeof dataSource !== 'object') return {}
  const { table, refreshMode, pollIntervalMs } = dataSource as Readonly<Record<string, unknown>>
  if (typeof table !== 'string') return {}
  return { source: { table, refreshMode, pollIntervalMs } }
}

/** Where the frame opens and whether it follows new turns, as its island reads them. */
const scrollPropsOf = (source: Readonly<Record<string, unknown>>) => ({
  position:
    typeof source['defaultScrollPosition'] === 'string' ? source['defaultScrollPosition'] : 'end',
  autoScroll: source['autoScroll'] === true,
  anchorPeek: typeof source['anchorPeek'] === 'number' ? source['anchorPeek'] : 64,
})

/** The record a frame follows for who is typing in it, as the page's app connection reads it. */
const followedOf = (
  value: unknown
): { readonly table: string; readonly recordId: string } | undefined => {
  const { table, recordId } = (value ?? {}) as Readonly<Record<string, unknown>>
  return typeof table === 'string' && typeof recordId === 'string' ? { table, recordId } : undefined
}

/**
 * `message-scroller` — the scroll frame of a conversation
 * (`data-slot="message-scroller"`). The frame IS the log (`role="log"`,
 * `aria-relevant="additions"`), so an assistive technology announces a turn
 * added to it. Its turns are the server's; the `message-scroller` enhancement
 * island (which renders nothing) places the scroll where the frame opens and,
 * with `autoScroll`, follows new turns.
 *
 * Source: src/domain/models/app/pages/components/component-types/layout/message-scroller.ts
 */
const messageScrollerComponent: ComponentRenderer = ({
  elementPropsWithSpacing,
  renderedChildren,
  component,
  currentLang,
  languages,
}) => {
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const followed = followedOf(source[FOLLOWED_PARENT_KEY])
  const {
    className: authorClassName,
    style: authorStyle,
    ...rest
  } = omitInternalMarkers(elementPropsWithSpacing)
  const style = {
    ...(typeof authorStyle === 'object' && authorStyle !== null ? authorStyle : {}),
    height: typeof source['height'] === 'string' ? source['height'] : undefined,
  } as CSSProperties
  const islandProps = {
    ...scrollPropsOf(source),
    ...liveSourceOf(source['dataSource']),
    // The parent a signed-in reader's frame marks read as it draws its turns.
    ...(typeof source[READ_STATE_PARENT_KEY] === 'object'
      ? { readState: source[READ_STATE_PARENT_KEY] }
      : {}),
    // Who is typing in a followed conversation, drawn below its turns.
    ...(followed === undefined
      ? {}
      : { typingLabel: resolveInterpreterString('conversation.typing', currentLang, languages) }),
  }
  return (
    <div
      {...rest}
      data-slot="message-scroller"
      data-conversation-digest={
        typeof source[CONVERSATION_DIGEST_KEY] === 'string'
          ? source[CONVERSATION_DIGEST_KEY]
          : undefined
      }
      data-follow-table={followed?.table}
      data-follow-record={followed?.recordId}
      role="log"
      aria-relevant="additions"
      style={style}
      className={mergePrestyle(
        computeMessageScrollerClasses(),
        authorClassName as string | undefined
      )}
    >
      {renderedChildren}
      <span
        data-island="message-scroller"
        data-island-props={JSON.stringify(islandProps)}
        hidden
      />
    </div>
  )
}

/** The message-scroller renderer, keyed by type. */
export const messageScrollerComponents = {
  'message-scroller': messageScrollerComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
