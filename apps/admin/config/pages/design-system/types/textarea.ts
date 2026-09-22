/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `textarea` — more than a line, less than a document.
//
// Two drawings. The counter is the one that carries a decision: `maxLength`
// without a visible count is a limit a reader discovers by hitting it, which is
// the worst moment to learn about it.
//
// `autoResize` rides with it, because a fixed `rows` too small for the content is
// the other way this control frustrates someone.

import type { TypePageBody } from './_shape'

const textarea: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'field',
          fieldLabel: 'Internal note',
          children: [
            {
              type: 'textarea',
              rows: 4,
              props: { name: 'note', placeholder: 'What happened on this call?' },
            },
          ],
        },
      ],
    },
    {
      label: 'with counter',
      children: [
        {
          type: 'field',
          fieldLabel: 'Summary',
          fieldDescription: 'This is what the weekly digest sends.',
          children: [
            {
              type: 'textarea',
              rows: 3,
              maxLength: 280,
              autoResize: true,
              props: { name: 'summary' },
            },
          ],
        },
      ],
    },
  ],
}

export default textarea
