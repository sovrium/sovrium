/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `label` — the name of a control, set apart from it.
//
// Most controls name themselves through `field`, which draws its own label. This
// type is for the control that sits outside one: a switch in a row, a checkbox
// in a sentence. `for` is what makes it a label rather than a line of text — a
// press on the words moves the focus to the control whose `props.id` it names,
// and that id must exist on the same page or the config is refused.

import type { TypePageBody } from './body-shape'

const label: TypePageBody = {
  drawings: [
    {
      label: 'for',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-72 flex-col gap-2' },
          children: [
            { type: 'label', text: 'Work email', for: 'design-system-label-email' },
            {
              type: 'input',
              props: {
                id: 'design-system-label-email',
                type: 'email',
                placeholder: 'lea@atelier-verne.fr',
              },
            },
          ],
        },
      ],
    },
    {
      label: 'required',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-72 flex-col gap-2' },
          children: [
            {
              type: 'label',
              text: 'Company name',
              required: true,
              for: 'design-system-label-company',
            },
            { type: 'input', props: { id: 'design-system-label-company' } },
          ],
        },
      ],
    },
    {
      label: 'beside a switch',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex items-center gap-2' },
          children: [
            { type: 'switch', props: { id: 'design-system-label-notify' } },
            {
              type: 'label',
              text: 'Email me when a deal closes',
              for: 'design-system-label-notify',
            },
          ],
        },
      ],
    },
  ],
}

export default label
