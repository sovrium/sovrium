/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `checkbox` — one box, and a set of them.
//
// The type carries `checked` and `indeterminate`; its caption rides in `props`,
// under `label` or `content`, with `label` winning where both are given. Both
// resolve in the served markup and after hydration alike — which was not true
// until recently, and is the sort of thing worth checking rather than assuming:
// a caption that appears only once a script has run reads correctly in a browser
// and wrongly for a crawler or a reader without JavaScript. Both drawings
// are the real component, and the second is the one that earns its place —
// `indeterminate` is a third state most authors do not know they have, and it is
// what a parent row of a partially-selected set shows.

import type { TypePageBody } from './body-shape'

const box = (label: string, props: Record<string, unknown> = {}) => ({
  type: 'checkbox' as const,
  ...props,
  props: { label },
})

const checkbox: TypePageBody = {
  drawings: [
    {
      label: 'single',
      children: [box('Remind me before the close date', { checked: true })],
    },
    {
      label: 'list',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col gap-2' },
          children: [
            box('All columns', { indeterminate: true }),
            {
              type: 'container',
              element: 'div',
              props: { className: 'flex flex-col gap-2 pl-5' },
              children: [
                box('Name', { checked: true }),
                box('Company', { checked: true }),
                box('Amount'),
              ],
            },
          ],
        },
      ],
    },
  ],
}

export default checkbox
