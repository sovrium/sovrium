/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `button-group` — several exclusive actions of equal weight, drawn as a group.
//
// The type declares no variant union and has no props of its own: what it is, is
// a container that joins the buttons inside it. So both drawings are the real
// group with real buttons in it, and what differs is what they carry.

import type { TypePageBody } from './body-shape'

const groupOf = (children: readonly unknown[]) => ({
  type: 'button-group' as const,
  children: [...children],
})

const b = (label: string, variant = 'secondary') => ({
  type: 'button' as const,
  variant,
  label,
  props: { type: 'button' },
})

const buttonGroup: TypePageBody = {
  drawings: [
    {
      label: 'segmented',
      children: [groupOf([b('Table'), b('Board'), b('Calendar')])],
    },
    {
      label: 'attached with icon',
      children: [
        groupOf([
          b('New deal', 'default'),
          {
            type: 'button',
            variant: 'default',
            props: { type: 'button', 'aria-label': 'More options' },
            children: [{ type: 'icon', props: { name: 'chevron-down', size: 14 } }],
          },
        ]),
      ],
    },
  ],
}

export default buttonGroup
