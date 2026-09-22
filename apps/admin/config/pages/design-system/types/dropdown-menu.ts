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
// second drawing composes the list under a real trigger.

import { panel } from './_overlay'
import type { PageComponent, TypePageBody } from './_shape'

const item = (label: string, destructive = false): PageComponent =>
  ({
    type: 'text',
    element: 'span',
    props: {
      className: `${destructive ? 'text-error-fg' : 'text-foreground'} rounded px-2 py-1.5 text-sm`,
    },
    content: label,
  }) as PageComponent

const dropdownMenu: TypePageBody = {
  drawings: [
    {
      label: 'closed',
      children: [
        {
          type: 'dropdown-menu',
          triggerLabel: 'Actions',
          menuItems: [
            { label: 'Duplicate', action: { type: 'navigate', path: '/design-system' } },
            { label: 'Export CSV', action: { type: 'navigate', path: '/design-system' } },
          ],
        },
      ],
    },
    {
      label: 'open',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col items-start gap-1.5' },
          children: [
            {
              type: 'button',
              variant: 'outline',
              size: 'sm',
              label: 'Actions',
              props: { type: 'button' },
            },
            panel({
              width: 'w-52',
              children: [
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex flex-col' },
                  children: [item('Duplicate'), item('Export CSV'), item('Revoke access', true)],
                },
              ],
            }),
          ],
        },
      ],
    },
  ],
}

export default dropdownMenu
