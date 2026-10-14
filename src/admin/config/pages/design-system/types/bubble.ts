/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `bubble` — the words of one turn, on a card's surface with a tail.
//
// It is the body a `message` holds: the message carries who and when, the
// bubble carries what. `align` puts its tail on the sender's side or the
// reply's, and is logical, so a right-to-left page mirrors it.

import type { TypePageBody } from './body-shape'

const bubble: TypePageBody = {
  drawings: [
    {
      label: 'start',
      children: [{ type: 'bubble', content: 'The invoice for September is attached.' }],
    },
    {
      label: "align: 'end'",
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full max-w-md justify-end' },
          children: [
            { type: 'bubble', align: 'end', content: 'Thanks, it is filed under Atelier Verne.' },
          ],
        },
      ],
    },
  ],
}

export default bubble
