/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `context-menu` — the same list, opened by the right button.
//
// A context menu has no trigger of its own: the trigger is a gesture on
// something else. So the resting drawing is the real component wrapped around
// a row — it looks like the row, and a right click (or a long press) on it
// opens the menu where the pointer is. The open drawing is a still, because
// the popup exists only while it is open: the row it was opened on and the
// panel beside it, which is also what makes this type different from a
// dropdown — the target stays visible and marked. The panel is the
// dropdown's, a little wider. See `menu-panel.ts`.

import { menuPanel } from './menu-panel'
import { box, line } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

const go = { type: 'navigate', path: '/design-system' } as const

/** The real component: at rest, it is the row it wraps. */
const live = {
  type: 'context-menu',
  menuItems: [
    { label: 'Open', shortcut: '↵', action: go },
    { label: 'Duplicate', shortcut: '⌘D', action: go },
    { separator: true },
    { label: 'Delete', variant: 'destructive', action: go },
  ],
  children: [
    box('bg-muted w-full rounded-md border px-3 py-2 text-sm', [
      line('Rénovation atelier', 'text-foreground', undefined, 'span'),
    ]),
  ],
} as PageComponent

const contextMenu: TypePageBody = {
  drawings: [
    { label: 'closed', children: [live] },
    {
      label: 'open',
      children: [
        box('flex w-full flex-col items-start gap-1', [
          box(
            'bg-muted w-full rounded-md border px-3 py-2 text-sm',
            [line('Rénovation atelier', 'text-foreground', undefined, 'span')],
            'context-menu-trigger'
          ),
          menuPanel(
            'context-menu',
            [
              { label: 'Open', shortcut: '↵', highlighted: true },
              { label: 'Duplicate', shortcut: '⌘D' },
              'separator',
              { label: 'Delete', destructive: true },
            ],
            'w-56'
          ),
        ]),
      ],
    },
  ],
}

export default contextMenu
