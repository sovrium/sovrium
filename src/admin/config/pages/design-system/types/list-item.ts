/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `list-item` — one row of a list, with and without a way to pick it.
//
// The type has no keys of its own: it is a row, and what it holds is its
// children. So both drawings are the real component carrying a different
// composition, and the second is the one worth drawing — a list that can be
// selected is a different surface from one that can only be read.

import type { TypePageBody } from './body-shape'

const listItem: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'list-item',
          props: { className: 'w-full' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex w-full items-baseline justify-between gap-3' },
              children: [
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground text-sm' },
                  content: 'Rénovation atelier',
                },
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground-subtle text-[11px]' },
                  content: '24 500 €',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      label: 'with checkbox',
      children: [
        {
          type: 'list-item',
          props: { className: 'w-full' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex w-full items-center gap-3' },
              children: [
                { type: 'checkbox', checked: true },
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground flex-1 text-sm' },
                  content: 'Rénovation atelier',
                },
                {
                  type: 'text',
                  element: 'span',
                  props: { className: 'text-foreground-subtle text-[11px]' },
                  content: '24 500 €',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

export default listItem
