/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `skeleton` — the shape of content that has not arrived.
//
// `skeletonVariant` declares `text circular rectangular`, and the page derives
// all three. This file used to list two sections instead — `text` and `card` —
// which withheld two members and headed one section with a word the decoder
// refuses.
//
// `card` was worth keeping, and it was never a variant: it is the three
// primitives composed into the thing they stand in for. A skeleton alone
// documents a grey rectangle; a skeleton in the shape of a record documents the
// pattern. So it stays, as what it is — a composition, under the keys it uses.

import type { TypePageBody } from './body-shape'

const skeleton: TypePageBody = {
  options: [
    {
      id: 'composition',
      title: 'Composition',
      configKey: 'skeletonVariant · skeletonWidth · skeletonHeight',
      drawings: [
        {
          label: 'three primitives, one record',
          children: [
            {
              type: 'container',
              element: 'div',
              props: {
                className: 'border-border flex w-full items-start gap-3 rounded-lg border p-4',
              },
              children: [
                {
                  type: 'skeleton',
                  skeletonVariant: 'circular',
                  skeletonWidth: '40px',
                  skeletonHeight: '40px',
                },
                {
                  type: 'container',
                  element: 'div',
                  props: { className: 'flex min-w-0 flex-1 flex-col gap-2' },
                  children: [
                    { type: 'skeleton', skeletonVariant: 'text', props: { className: 'w-1/3' } },
                    { type: 'skeleton', skeletonVariant: 'text', props: { className: 'w-full' } },
                    {
                      type: 'skeleton',
                      skeletonVariant: 'rectangular',
                      skeletonHeight: '64px',
                      props: { className: 'w-full' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

export default skeleton
