/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `dropdown-menu` — a trigger and the list it opens.
//
// Shut, this is the real component: that IS its resting state, and it is the one
// overlay on this page whose closed form is worth drawing, because the trigger
// is what a reader clicks. Open, the popup exists only while it is open, so the
// second drawing composes the list under the same real trigger, with the row the
// pointer is on highlighted. See `menu-panel.ts`.

import { menuPanel } from './menu-panel'
import { box } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

const go = { type: 'navigate', path: '/design-system' } as const

/** The real component: shut, it is its trigger. */
const trigger = {
  type: 'dropdown-menu',
  triggerLabel: 'Actions',
  menuItems: [
    { label: 'Duplicate', icon: 'copy', shortcut: '⌘D', action: go },
    { label: 'Export CSV', icon: 'download', action: go },
    { separator: true },
    { label: 'Revoke access', icon: 'trash-2', variant: 'destructive', action: go },
  ],
} as PageComponent

const dropdownMenu: TypePageBody = {
  drawings: [
    { label: 'closed', children: [trigger] },
    {
      label: 'open',
      children: [
        box('flex flex-col items-start gap-1', [
          trigger,
          menuPanel('dropdown-menu', [
            { group: 'This record' },
            { label: 'Duplicate', icon: 'copy', shortcut: '⌘D', highlighted: true },
            { label: 'Export CSV', icon: 'download' },
            { label: 'Move to archive', icon: 'archive', disabled: true },
            'separator',
            { label: 'Revoke access', icon: 'trash-2', destructive: true },
          ]),
        ]),
      ],
    },
  ],
}

export default dropdownMenu
