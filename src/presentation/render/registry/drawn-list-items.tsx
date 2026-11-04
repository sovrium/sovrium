/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeListSeparatorClasses,
  computeListShellClasses,
} from '@/presentation/design/list-default-classes'
import { listRowClasses } from '@/presentation/design/list-row-class-resolution'
import { DRAWN_ROWS_STYLE } from '@/presentation/render/resolve/drawn-island-content'
import type { PartClassMap } from '@/domain/models/app/design/component-parts'
import type { ListItemLayout, ListRowClasses } from '@/presentation/design/list-row-classes'
import type { ReactElement } from 'react'

/** One drawn item: its text column and, between items, the separator. */
function DrawnItem({
  title,
  subtitle,
  classes,
  separated,
}: {
  readonly title: string | undefined
  readonly subtitle: string | undefined
  readonly classes: ListRowClasses
  readonly separated: boolean
}): ReactElement {
  return (
    <li
      data-slot="item"
      data-size="sm"
      data-list-item="true"
      className={classes.item}
    >
      <div
        data-slot="item-content"
        className={classes.textColumn}
      >
        {title ? (
          <div
            data-slot="item-title"
            data-list-title="true"
            className={classes.title}
          >
            {title}
          </div>
        ) : undefined}
        {subtitle ? (
          <p
            data-slot="item-description"
            data-list-subtitle="true"
            className={classes.subtitle}
          >
            {subtitle}
          </p>
        ) : undefined}
      </div>
      {separated ? (
        <div
          data-slot="item-separator"
          className={computeListSeparatorClasses()}
        />
      ) : undefined}
    </li>
  )
}

/**
 * A list's first page as the server read it for its reader
 * (`drawn-island-content.ts`): one item per row, its title and subtitle as the
 * item template prints them, on the parts and classes the mounted island draws
 * an item with — so the browser's find and a print reach the items before the
 * list mounts, and nothing moves when it does.
 */
export function DrawnListItems({
  items,
  itemLayout,
  parts,
  ariaLabel,
}: {
  readonly items: readonly (readonly string[])[]
  readonly itemLayout: string | undefined
  readonly parts: PartClassMap | undefined
  readonly ariaLabel: string | undefined
}): ReactElement {
  const classes = listRowClasses({
    ...(itemLayout === 'stacked' ? { itemLayout: 'stacked' as ListItemLayout } : {}),
    ...(parts !== undefined ? { parts } : {}),
  })
  return (
    <ul
      data-slot="item-group"
      aria-label={ariaLabel}
      className={classes.list ?? computeListShellClasses()}
      style={DRAWN_ROWS_STYLE}
    >
      {items.map(([title, subtitle], index) => (
        <DrawnItem
          key={`drawn-${String(index)}`}
          title={title}
          subtitle={subtitle}
          classes={classes}
          separated={index < items.length - 1}
        />
      ))}
    </ul>
  )
}
