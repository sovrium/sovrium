/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `radio-group` — one choice out of a few, both ways round.
//
// Both are the real component. `orientation` is the key, and the choice it
// carries is about the OPTIONS rather than the space: stacked when the labels
// are sentences, in a row when they are words and the reader is comparing them.

import type { TypePageBody } from './_shape'

const OPTIONS = [
  { label: 'Every day', value: 'daily' },
  { label: 'Every week', value: 'weekly' },
  { label: 'Never', value: 'never' },
]

const radioGroup: TypePageBody = {
  drawings: [
    {
      label: 'vertical',
      children: [{ type: 'radio-group', options: OPTIONS, defaultValue: 'weekly' }],
    },
    {
      label: 'horizontal',
      children: [
        {
          type: 'radio-group',
          options: [
            { label: 'Day', value: 'd' },
            { label: 'Week', value: 'w' },
            { label: 'Month', value: 'm' },
          ],
          orientation: 'horizontal',
          defaultValue: 'w',
        },
      ],
    },
  ],
}

export default radioGroup
