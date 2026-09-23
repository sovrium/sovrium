/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `avatar` — who, in the smallest space a face fits.
//
// Every drawing is the real component. `items` is the key that changes what it
// IS rather than how it looks: present, the component becomes a stack and reads
// `src`, `initials` and `status` per member instead of from itself. That is why
// the group is a variant here rather than a prop note.

import type { TypePageBody } from './body-shape'

const avatar: TypePageBody = {
  drawings: [
    {
      label: 'image',
      children: [
        { type: 'avatar', src: '/favicon.ico', alt: 'Léa Fontaine', label: 'Léa Fontaine' },
      ],
    },
    {
      label: 'initials',
      children: [{ type: 'avatar', initials: 'LF', label: 'Léa Fontaine' }],
    },
    {
      label: 'group',
      children: [
        {
          type: 'avatar',
          label: 'Deal owners',
          max: 3,
          items: [
            { initials: 'LF', label: 'Léa Fontaine' },
            { initials: 'NM', label: 'Nadia Meyer' },
            { initials: 'TR', label: 'Thomas Roux' },
            { initials: 'CB', label: 'Camille Bernard' },
          ],
        },
      ],
    },
    {
      label: 'with status',
      children: [{ type: 'avatar', initials: 'NM', label: 'Nadia Meyer', status: 'online' }],
    },
  ],
}

export default avatar
