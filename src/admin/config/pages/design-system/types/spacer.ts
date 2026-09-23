/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `spacer` — a type with no appearance at all, drawn as the gap it makes.
//
// The derived page drew it as an empty bordered box, which is exactly what a
// component with nothing to render looks like on its own and exactly what a
// reader cannot learn anything from. A spacer's whole subject is the DISTANCE
// between two things, so both drawings put two things either side of one and
// mark the gap.
//
// The dashed measure is not the component. It is the console saying "this is
// the part you cannot see", which is the only honest way to draw a void.

import type { PageComponent, TypePageBody } from './body-shape'

const BLOCK = 'bg-background-subtle border-border rounded border px-3 py-2 text-[11px]'

const gapMeasure = (label: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border text-foreground-subtle flex items-center justify-center rounded border border-dashed py-3 text-[10px]',
    },
    children: [{ type: 'text', element: 'span', content: label }],
  }) as PageComponent

const spacer: TypePageBody = {
  drawings: [
    {
      label: 'between blocks',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full flex-col gap-0' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: BLOCK },
              children: [{ type: 'text', element: 'span', content: 'Section above' }],
            },
            gapMeasure('spacer'),
            {
              type: 'container',
              element: 'div',
              props: { className: BLOCK },
              children: [{ type: 'text', element: 'span', content: 'Section below' }],
            },
          ],
        },
      ],
    },
    {
      label: 'pushing apart',
      children: [
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'border-border flex w-full items-center gap-0 rounded border p-2',
          },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: BLOCK },
              children: [{ type: 'text', element: 'span', content: 'Deals' }],
            },
            {
              type: 'container',
              element: 'div',
              props: {
                className:
                  'border-border text-foreground-subtle mx-2 flex flex-1 items-center justify-center rounded border border-dashed py-2 text-[10px]',
              },
              children: [{ type: 'text', element: 'span', content: 'spacer · takes the rest' }],
            },
            {
              type: 'container',
              element: 'div',
              props: { className: BLOCK },
              children: [{ type: 'text', element: 'span', content: 'New deal' }],
            },
          ],
        },
      ],
    },
  ],
}

export default spacer
