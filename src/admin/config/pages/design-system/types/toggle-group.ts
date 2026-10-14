/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `toggle-group` — a set of toggles that know about each other.
//
// `toggleType` is the whole decision and it is drawn rather than described:
// `single` is a choice (one option wins, like a view switcher), `multiple` is a
// filter (any number hold at once). Same markup, different meaning, and the key
// that separates them is one word.
//
// The `size` union is the schema's, so the Sizes section here is real.
//
// The items are drawn apart, a small gap between each, as shadcn/ui's Toggle
// Group draws them by default, and `orientation` turns the row into a column.

import type { TypePageBody } from './body-shape'

const VIEWS = [
  { label: 'Table', value: 'table' },
  { label: 'Board', value: 'board' },
  { label: 'Calendar', value: 'calendar' },
]

const toggleGroup: TypePageBody = {
  drawings: [
    {
      label: 'single',
      children: [{ type: 'toggle-group', options: VIEWS, toggleType: 'single' }],
    },
    {
      label: 'multiple',
      children: [
        {
          type: 'toggle-group',
          options: [
            { label: 'Open', value: 'open' },
            { label: 'Won', value: 'won' },
            { label: 'Lost', value: 'lost' },
          ],
          toggleType: 'multiple',
        },
      ],
    },
  ],
  options: [
    {
      id: 'orientation',
      title: 'Orientation',
      configKey: 'toggle-group.orientation',
      drawings: [
        {
          label: 'orientation: horizontal',
          children: [{ type: 'toggle-group', options: VIEWS, toggleType: 'single' }],
        },
        {
          label: 'orientation: vertical',
          children: [
            { type: 'toggle-group', options: VIEWS, toggleType: 'single', orientation: 'vertical' },
          ],
        },
      ],
    },
  ],
}

export default toggleGroup
