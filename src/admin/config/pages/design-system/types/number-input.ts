/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `number-input` — a number, with and without the buttons.
//
// Both are the real component. `showStepper` is the key, and the choice it
// carries is about the value's RANGE rather than about taste: increment buttons
// help where a reader nudges by one and get in the way where they type a figure.

import type { TypePageBody } from './body-shape'

const numberInput: TypePageBody = {
  drawings: [
    {
      label: 'stepper',
      children: [
        {
          type: 'number-input',
          min: 1,
          max: 20,
          step: 1,
          defaultValue: 3,
          showStepper: true,
          props: { className: 'w-40' },
        },
      ],
    },
    {
      label: 'plain',
      // A four-digit default on purpose. The lint gate wants a separator on any
      // literal of five digits or more, and the preset this config is compiled
      // into serialises the VALUE — so `24_500` written here still emits
      // `24500` there, and the gate fails on a generated file no one can edit.
      children: [
        {
          type: 'number-input',
          min: 0,
          step: 100,
          defaultValue: 9800,
          props: { className: 'w-40' },
        },
      ],
    },
  ],
}

export default numberInput
