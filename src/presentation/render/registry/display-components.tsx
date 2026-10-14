/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Display-category component renderers (the prestyled-islands rule prestyled defaults).
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

import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import {
  computeEmptyContentClasses,
  computeEmptyDescriptionClasses,
  computeEmptyHeaderClasses,
  computeEmptyMediaClasses,
  computeEmptyStateContainerClasses,
  computeEmptyStateTitleClasses,
} from '../../design/display-default-classes'
import { resolveLucideIcon } from '../elements/lucide-resolver'
import { avatarComponent } from './avatar-component'
import { descriptionListComponent } from './description-list-component'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'
import type { ReactElement } from 'react'

/**
 * Display-category renderers: the schemas that previously fell
 * through to the unstyled `<div>` fallback in `dispatchComponentType` now
 * carry their own opinionated chrome via these renderers.
 */
/** The empty's icon, framed in a tile (`emptyMedia: icon`, the default) or bare. */
function renderEmptyMedia(component: unknown): ReactElement | undefined {
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const Icon = resolveLucideIcon(
    typeof source['emptyIcon'] === 'string' ? source['emptyIcon'] : undefined
  )
  if (Icon === undefined) return undefined
  const variant = source['emptyMedia'] === 'default' ? 'default' : 'icon'
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      aria-hidden="true"
      className={computeEmptyMediaClasses(variant)}
    >
      <Icon aria-hidden="true" />
    </div>
  )
}

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

  // `empty` — shadcn/ui's anatomy: a header holding the title and the
  // description, and a content slot under it for what the author adds (a call
  // to action, most often). Each part names itself with `data-slot`; the
  // heading stays an `<h3>` so the title keeps its heading role.
  empty: ({ elementProps, content, renderedChildren, component }) => {
    const media = renderEmptyMedia(component)
    const title = elementProps['emptyTitle'] as string | undefined
    const description = elementProps['emptyDescription'] as string | undefined
    const authorClassName = elementProps['className'] as string | undefined
    const className = mergePrestyle(computeEmptyStateContainerClasses(), authorClassName)
    const body = content || (renderedChildren.length > 0 ? renderedChildren : undefined)
    return (
      <div
        data-testid={elementProps['data-testid'] as string | undefined}
        id={elementProps['id'] as string | undefined}
        className={className}
        data-slot="empty"
        data-component="empty"
        data-component-type={hostComponentType(elementProps)}
        role="status"
      >
        {title || description || media ? (
          <div
            data-slot="empty-header"
            className={computeEmptyHeaderClasses()}
          >
            {media}
            {title ? (
              <h3
                data-slot="empty-title"
                className={computeEmptyStateTitleClasses()}
              >
                {title}
              </h3>
            ) : undefined}
            {description ? (
              <p
                data-slot="empty-description"
                className={computeEmptyDescriptionClasses()}
              >
                {description}
              </p>
            ) : undefined}
          </div>
        ) : undefined}
        {body === undefined ? undefined : (
          <div
            data-slot="empty-content"
            className={computeEmptyContentClasses()}
          >
            {body}
          </div>
        )}
      </div>
    )
  },
}
