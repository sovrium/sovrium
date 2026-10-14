/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeMessageScrollerClasses } from '../../design/message-scroller-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { CSSProperties } from 'react'

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
}) => {
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
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
    position:
      typeof source['defaultScrollPosition'] === 'string' ? source['defaultScrollPosition'] : 'end',
    autoScroll: source['autoScroll'] === true,
    anchorPeek: typeof source['anchorPeek'] === 'number' ? source['anchorPeek'] : 64,
  }
  return (
    <div
      {...rest}
      data-slot="message-scroller"
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
