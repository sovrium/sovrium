/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Fragment } from 'react'
import {
  TIMELINE_CONNECTOR_CLASSES,
  TIMELINE_ITEM_CLASSES,
  TIMELINE_ITEM_CONTENT_CLASSES,
  TIMELINE_ITEM_RAIL_CLASSES,
  TIMELINE_MARKER_CLASSES,
  TIMELINE_RAIL_CLASSES,
} from '../../design/timeline-anatomy-classes'
import * as Renderers from '../elements'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'

/**
 * The structural `timeline`: an ordered list of the authored children, each an
 * item with a marker on the rail and a connector down to the next event. The
 * rail's parts are `aria-hidden` decorations; the list and its items are what
 * a screen reader announces.
 */
export function renderTimelineRail({
  elementPropsWithSpacing,
  content,
  renderedChildren,
  interactions,
}: Parameters<ComponentRenderer>[0]): ReturnType<ComponentRenderer> {
  const authorClassName = elementPropsWithSpacing['className'] as string | undefined
  const last = renderedChildren.length - 1
  // One keyed `Fragment` (the `<>` shorthand takes no key) as the sole entry
  // of `children`, as the other structural renderers hand theirs over.
  const children = (
    <Fragment key="timeline-body">
      {content !== undefined && content !== '' && <li role="none">{content}</li>}
      {renderedChildren.map((child, index) => (
        <li
          key={index}
          data-slot="timeline-item"
          className={TIMELINE_ITEM_CLASSES}
        >
          <span className={TIMELINE_ITEM_RAIL_CLASSES}>
            <span
              aria-hidden="true"
              data-slot="timeline-marker"
              className={TIMELINE_MARKER_CLASSES}
            />
            {index < last && (
              <span
                aria-hidden="true"
                data-slot="timeline-connector"
                className={TIMELINE_CONNECTOR_CLASSES}
              />
            )}
          </span>
          <div className={TIMELINE_ITEM_CONTENT_CLASSES}>{child}</div>
        </li>
      ))}
    </Fragment>
  )
  return Renderers.renderHTMLElement({
    type: 'ol',
    props: {
      ...elementPropsWithSpacing,
      'data-slot': 'timeline',
      className: mergePrestyle(TIMELINE_RAIL_CLASSES, authorClassName),
    },
    content: undefined,
    children: [children],
    interactions: interactions,
  })
}
