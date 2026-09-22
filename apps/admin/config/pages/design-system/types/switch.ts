/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `switch` — a setting that takes effect as it is flipped.
//
// The type carries `checked` and nothing else — no size key, which is why there
// is no Sizes section here. Its caption rides in `props`, under `label` or
// `content`, and both resolve in the served markup as well as after hydration. What the reference calls this type's three forms are
// two recipe steps and a labelled composition, and the page says so rather than
// claiming an axis an author cannot write.
//
// The difference from a checkbox is not the shape: a checkbox proposes a value
// that a form later submits, a switch applies one immediately. That is why a
// switch inside a form with a save button is nearly always the wrong control.

import type { TypePageBody } from './_shape'

const aSwitch: TypePageBody = {
  drawings: [
    {
      label: 'default',
      children: [{ type: 'switch', checked: true }],
    },
    {
      label: 'with label',
      children: [
        { type: 'switch', checked: true, props: { label: 'Remind me before the close date' } },
      ],
    },
  ],
}

export default aSwitch
