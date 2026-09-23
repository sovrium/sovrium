/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `toggle` — a button that stays pressed.
//
// Two drawings for the two things it can hold — a glyph or a word — and a real
// Sizes section, because this type DOES declare a closed `size` union. The three
// steps are the schema's own, so an author reading this page can write them.
//
// The difference from `switch`: a toggle belongs in a toolbar beside other
// buttons and reads as part of a set; a switch is a setting on its own line.
//
// Its caption rides in `props`, under `label` or `content`. Until recently this
// type read `content` alone, so a toggle written with `label` rendered the word
// “Toggle” and no error — and the design system's own catalogue card was
// mislabelled by it. Both spellings work now, server-side and after hydration.

import type { TypePageBody } from './body-shape'

const toggle: TypePageBody = {
  drawings: [
    {
      label: 'icon',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex items-center gap-1' },
          children: [
            { type: 'toggle', pressed: true, props: { label: 'B', 'aria-label': 'Bold' } },
            { type: 'toggle', props: { label: 'I', 'aria-label': 'Italic' } },
          ],
        },
      ],
    },
    {
      label: 'text',
      children: [{ type: 'toggle', pressed: true, props: { label: 'Show archived' } }],
    },
  ],
}

export default toggle
