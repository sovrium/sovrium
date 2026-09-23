/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `reorderable-list` — a list whose order is the data.
//
// Both are the real component. `reorderable` is the key; what it turns on is a
// drag handle and a write, which is why the second drawing is composed rather
// than live: a row mid-drag is a pointer state a static page cannot hold, and
// drawing it matters because it is the only moment the reader learns where the
// row will land.

import type { PageComponent, TypePageBody } from './body-shape'

const row = (label: string, dragging = false): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: dragging
        ? 'border-foreground bg-background-raised flex items-center gap-3 rounded border px-3 py-2 shadow-md'
        : 'border-border flex items-center gap-3 rounded border px-3 py-2',
    },
    children: [
      { type: 'icon', props: { name: 'grip-vertical', size: 14 } },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground text-sm' },
        content: label,
      },
    ],
  }) as PageComponent

const reorderableList: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full flex-col gap-2' },
          children: [row('Qualified'), row('Proposal'), row('Negotiation'), row('Won')],
        },
      ],
    },
    {
      label: 'dragging',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full flex-col gap-2' },
          children: [
            row('Qualified'),
            {
              type: 'container',
              element: 'div',
              props: {
                className:
                  'border-border bg-background-subtle rounded border border-dashed px-3 py-2',
              },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground-subtle text-[11px]' },
                  content: 'drops here',
                },
              ],
            } as PageComponent,
            row('Proposal', true),
            row('Won'),
          ],
        },
      ],
    },
  ],
}

export default reorderableList
