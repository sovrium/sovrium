/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `marker` — a short note inside a thread, between the turns.
//
// Its three variants are a published axis, so the page derives those sections
// itself. What this file adds is the rest of what a marker can be: an icon in
// front of the words, a link, and a live status that is announced as it
// changes — the "Generating a reply" line under the last turn.

import type { TypePageBody } from './body-shape'

const marker: TypePageBody = {
  options: [
    {
      id: 'icon',
      title: 'Icon',
      configKey: 'marker.icon',
      drawings: [
        {
          label: "icon: 'user-plus'",
          children: [
            { type: 'marker', content: 'Léa Moreau joined the thread', icon: 'user-plus' },
          ],
        },
      ],
    },
    {
      id: 'href',
      title: 'Link',
      configKey: 'marker.href',
      drawings: [
        {
          label: 'href',
          children: [
            { type: 'marker', content: 'Merged into ticket 4821', icon: 'link', href: '#' },
          ],
        },
      ],
    },
    {
      id: 'live',
      title: 'Live',
      configKey: 'marker.live',
      drawings: [
        {
          label: 'live: true',
          children: [{ type: 'marker', content: 'Generating a reply', icon: 'clock', live: true }],
        },
      ],
    },
  ],
}

export default marker
