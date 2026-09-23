/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `preview` — one type, one option, one value, drawn.
//
// The narrowest of the three drawing primitives, and the most specific: it takes
// a type, an option PATH and a value, applies that one option to the engine's
// own catalogue exhibit, and draws the result. Beside the line
// `pagination.position: both`, the picture of a grid with pagers top and bottom.
//
// ─── HOW IT DIFFERS FROM `specimen`, WHICH IS EASY TO MISS ─────────────────
//
// A `specimen` draws a component. A `preview` draws a DIFFERENCE: it exists to
// sit next to one row of an option list and show what that row does. That is
// why it takes an option path rather than a whole component, and why its caption
// is a sentence about the value rather than a name for the drawing.
//
// ─── AND ONE HONEST NOTE ABOUT THIS CONSOLE ────────────────────────────────
//
// The option sections on these pages do not use it. They declare the component
// directly, because an authored drawing can set several keys at once, compose a
// context around the component, and say what the renderer does rather than what
// the schema names — none of which a single option path can express. `preview`
// remains the right primitive for a list generated FROM the schema, which is a
// surface this console no longer carries.

import type { TypePageBody } from './body-shape'

const preview: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [
        {
          type: 'preview',
          subject: { type: 'badge', option: 'badgeVariant', value: 'outline' },
          caption: 'A quieter badge, for a status the reader is not being asked to act on.',
        },
      ],
    },
    {
      label: 'showValue',
      children: [
        {
          type: 'preview',
          subject: { type: 'badge', option: 'badgeVariant', value: 'destructive' },
          caption: 'The one badge that means something went wrong.',
          showValue: true,
        },
      ],
    },
  ],
}

export default preview
