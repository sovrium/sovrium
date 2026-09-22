/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `slider` — a number chosen by position rather than typed.
//
// Both are the real component, and the difference between them is the SCALE:
// `min`/`max`/`step` are what an author actually decides, and the same control
// reads differently at 0–100 in fives and at 0–5000 in hundreds. The second
// drawing is there so that choice is visible rather than described.
//
// ─── THERE IS NO RANGE, AND THIS PAGE USED TO CLAIM ONE ────────────────────
//
// The second drawing was labelled `range` and carried no `defaultValue`, on the
// belief that a slider given no single value grows a second handle. It does
// not: `SliderSchema` publishes `defaultValue` as one scalar and the island
// holds one `number`, so the drawing showed one handle resting at the island's
// own default — near the left edge of a 0–5000 track, which reads as an empty
// control rather than as a range. A drawing whose label names a capability the
// schema does not have is the one thing a showcase must never do, so the label
// now names what the drawing is.

import type { TypePageBody } from './_shape'

const slider: TypePageBody = {
  drawings: [
    {
      label: 'fine scale',
      children: [
        {
          type: 'slider',
          min: 0,
          max: 100,
          step: 5,
          defaultValue: 40,
          showValue: true,
          props: { className: 'w-72' },
        },
      ],
    },
    {
      label: 'coarse scale',
      children: [
        {
          type: 'slider',
          min: 0,
          max: 5000,
          step: 100,
          defaultValue: 2500,
          showValue: true,
          props: { className: 'w-72' },
        },
      ],
    },
  ],
}

export default slider
