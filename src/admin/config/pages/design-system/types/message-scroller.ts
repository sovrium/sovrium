/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `message-scroller` — the frame a conversation scrolls in.
//
// `height` is required because a frame that grows with its content never
// scrolls. `defaultScrollPosition` decides where a reader lands when the frame
// opens: at the latest turn (`end`, a chat), at the first line (`start`, a
// transcript read top to bottom), or at the top of the last turn with a little
// of the one before (`last-anchor`, a long answer read from its beginning).

import type { PageComponent, TypePageBody } from './body-shape'

const turns = (): readonly PageComponent[] => [
  { type: 'marker', content: 'Yesterday', variant: 'separator' },
  {
    type: 'message',
    author: 'Léa Moreau',
    children: [{ type: 'bubble', content: 'Can the invoice be split in two?' }],
  },
  {
    type: 'message',
    author: 'Support',
    align: 'end',
    children: [{ type: 'bubble', align: 'end', content: 'Yes. One per site?' }],
  },
  { type: 'marker', content: 'Today', variant: 'separator' },
  {
    type: 'message',
    author: 'Léa Moreau',
    children: [{ type: 'bubble', content: 'One per site, and the same due date.' }],
  },
  {
    type: 'message',
    author: 'Support',
    align: 'end',
    children: [{ type: 'bubble', align: 'end', content: 'Done. Both are in your inbox.' }],
  },
]

const frame = (position: 'end' | 'start' | 'last-anchor'): PageComponent =>
  ({
    type: 'message-scroller',
    height: '200px',
    defaultScrollPosition: position,
    props: { className: 'w-full max-w-md rounded-lg border' },
    children: turns(),
  }) as PageComponent

const messageScroller: TypePageBody = {
  options: [
    {
      id: 'default-scroll-position',
      title: 'Default scroll position',
      configKey: 'message-scroller.defaultScrollPosition',
      drawings: [
        { label: "defaultScrollPosition: 'end'", children: [frame('end')] },
        { label: "defaultScrollPosition: 'start'", children: [frame('start')] },
        { label: "defaultScrollPosition: 'last-anchor'", children: [frame('last-anchor')] },
      ],
    },
  ],
  drawings: [{ label: 'default', children: [frame('end')] }],
}

export default messageScroller
