/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Display-category component renderers ([internal ref] prestyled defaults).
 *
 * This file gathers the renderers for the bare-`<div>`-fallback display
 * schemas that gained prestyled-by-default chrome in the
 * "prestyled-by-default islands" plan:
 *
 *   - `empty-state`   — dashed-border "nothing here yet" module with
 *                       optional title + description
 *
 * Other display-category renderers stay where they were (`list-item`,
 * `timeline` in
 * `structural-components.tsx`) — they were already wired into those
 * groupings before this slice. The static-table renderer left this file
 * entirely when `static-table` folded into `table`: one literal now needs one
 * registry entry, and it sits beside the bound renderer in
 * `island-data-components.tsx` (markup in `static-table-component.tsx`).
 * Splitting these two new renderers into a
 * dedicated file keeps `special-components.tsx` under the per-island
 * `max-lines: 300` cap while still grouping the display-category chrome
 * logically.
 *
 * Each renderer composes its className via
 * {@link mergePrestyle} (defaults → author override) so
 * `props.className` from a schema author appends after the prestyled
 * defaults at the Tailwind cascade.
 */

import {
  computeEmptyStateContainerClasses,
  computeEmptyStateTitleClasses,
} from '../../design/display-default-classes'
import { avatarComponent } from './avatar-component'
import { descriptionListComponent } from './description-list-component'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'

/**
 * Display-category renderers: the schemas that previously fell
 * through to the unstyled `<div>` fallback in `dispatchComponentType` now
 * carry their own opinionated chrome via these renderers.
 */
export const displayComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  // `avatar` — a person or a record as a picture, initials, or an overlapping
  // stack of them. Its own module: the fallback chain, the group arithmetic and
  // the presence dot are three decisions, and folding them in here would put
  // this file over the 300-line cap React components are held to.
  avatar: avatarComponent,

  // `description-list` — term/detail pairs as a real `<dl>`. Its own module for
  // the same reason, and because the `<dl>`/`<dt>`/`<dd>` shape is the half of
  // the type that a stylesheet could not have supplied.
  'description-list': descriptionListComponent,

  // Empty-state — prestyled-by-default. Renders a centered
  // dashed-border module with optional title + description from the
  // schema's `emptyTitle` / `emptyDescription` fields. Children render
  // below the description (used for CTA buttons via the action fields).
  'empty-state': ({ elementProps, content, renderedChildren }) => {
    const title = elementProps['emptyTitle'] as string | undefined
    const description = elementProps['emptyDescription'] as string | undefined
    const authorClassName = elementProps['className'] as string | undefined
    const className = mergePrestyle(computeEmptyStateContainerClasses(), authorClassName)
    return (
      <div
        data-testid={elementProps['data-testid'] as string | undefined}
        id={elementProps['id'] as string | undefined}
        className={className}
        data-component="empty-state"
        role="status"
      >
        {title ? <h3 className={computeEmptyStateTitleClasses()}>{title}</h3> : undefined}
        {description ? <p className="text-md">{description}</p> : undefined}
        {content || renderedChildren}
      </div>
    )
  },
}
