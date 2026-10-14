/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The open menu, drawn for the three menu types — dropdown, context and menubar.
//
// A menu exists only while it is open, and a live one closes the moment focus
// leaves it, so the open state is composed here, row by row, in base-nova's
// anatomy: a ringed panel on the `popover` colour with a 4px inset, rows that
// fill with the `accent` colour when highlighted, a destructive row in the
// `destructive` colour, a hairline separator bled to the panel's edges, and a
// shortcut pushed to the row's end. Each part carries its `data-slot`, with the
// menu's own prefix, so the drawing reads like the live menu in an inspector.
// See `overlay-panel.ts` for why every overlay page draws rather than renders.

import { box, line } from './overlay-panel'
import type { PageComponent } from './body-shape'

/** Which menu the rows belong to; it prefixes every slot. */
type MenuKind = 'dropdown-menu' | 'context-menu' | 'menubar'

/** One row of a drawn menu. */
interface MenuRow {
  readonly label: string
  readonly icon?: string
  readonly shortcut?: string
  readonly destructive?: boolean
  readonly highlighted?: boolean
  readonly disabled?: boolean
}

/** A row, a separator, or a group label. */
type MenuEntry = MenuRow | 'separator' | { readonly group: string }

const ROW = 'relative flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm select-none'

const rowTone = (row: MenuRow): string => {
  if (row.destructive === true)
    return row.highlighted === true ? 'bg-destructive/10 text-destructive' : 'text-destructive'
  if (row.highlighted === true) return 'bg-accent text-accent-foreground'
  return row.disabled === true ? 'text-popover-foreground opacity-50' : 'text-popover-foreground'
}

const rowItem = (kind: MenuKind, row: MenuRow): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: `${ROW} ${rowTone(row)}`,
      'data-slot': `${kind}-item`,
      ...(row.highlighted === true ? { 'data-highlighted': '' } : {}),
      ...(row.disabled === true ? { 'data-disabled': '' } : {}),
      ...(row.destructive === true ? { 'data-variant': 'destructive' } : {}),
    },
    children: [
      ...(row.icon === undefined
        ? []
        : [{ type: 'icon', props: { name: row.icon, size: 16 } } as PageComponent]),
      line(row.label, '', undefined, 'span'),
      ...(row.shortcut === undefined
        ? []
        : [
            line(
              row.shortcut,
              'text-muted-foreground ml-auto text-xs tracking-widest',
              `${kind}-shortcut`,
              'span'
            ),
          ]),
    ],
  }) as PageComponent

const entry = (kind: MenuKind, item: MenuEntry): PageComponent => {
  if (item === 'separator') return box('bg-border -mx-1 my-1 !block h-px', [], `${kind}-separator`)
  if ('group' in item)
    return line(
      item.group,
      'text-muted-foreground px-1.5 py-1 text-xs font-medium',
      `${kind}-label`
    )
  return rowItem(kind, item)
}

/** The open menu's `*-content`: base-nova's ringed panel, at its minimum width. */
export const menuPanel = (
  kind: MenuKind,
  entries: readonly MenuEntry[],
  width = kind === 'dropdown-menu' ? 'w-48' : 'w-56'
): PageComponent =>
  box(
    `bg-popover text-popover-foreground ring-foreground/10 rounded-lg p-1 shadow-md ring-1 ${width}`,
    entries.map((item) => entry(kind, item)),
    `${kind}-content`
  )
