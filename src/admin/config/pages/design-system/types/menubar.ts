/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `menubar` — the application menu bar, shut and with one menu down.
//
// The first drawing is the real component: a menubar at rest is its row of
// triggers, outlined in the `border` colour, which is a real resting state and
// worth drawing as one. The second composes the open menu under a drawn bar
// whose open trigger is filled, for the same reason every other overlay here is
// composed — a live one closes the moment focus leaves it. See `menu-panel.ts`.

import { menuPanel } from './menu-panel'
import { box, line } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

const go = { type: 'navigate', path: '/design-system' } as const

const MENUS = ['File', 'Edit', 'View', 'Help'] as const

/** The bar, drawn with base-nova's `menubar` and `menubar-trigger` classes. */
const bar = (openIndex: number): PageComponent =>
  box(
    'flex h-8 items-center gap-0.5 rounded-lg border p-[3px]',
    MENUS.map((label, i) =>
      line(
        label,
        `flex items-center rounded-sm px-1.5 py-[2px] text-sm font-medium ${i === openIndex ? 'bg-muted' : ''}`,
        'menubar-trigger',
        'span'
      )
    ),
    'menubar'
  )

const menubar: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'menubar',
          menus: MENUS.map((label) => ({
            label,
            items: [{ label: `${label} menu`, action: go }],
          })),
        } as PageComponent,
      ],
    },
    {
      label: 'with open menu',
      children: [
        box('flex flex-col items-start gap-1', [
          bar(0),
          menuPanel('menubar', [
            { label: 'New record', shortcut: '⌘N', highlighted: true },
            { label: 'Import CSV' },
            'separator',
            { label: 'Export', shortcut: '⌘E' },
          ]),
        ]),
      ],
    },
  ],
}

export default menubar
