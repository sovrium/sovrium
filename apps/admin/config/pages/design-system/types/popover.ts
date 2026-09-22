/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `popover` — a panel anchored to the thing that opened it.
//
// It renders its trigger and nothing else until a pointer arrives, so the open
// state is composed. What separates it from a tooltip is that a popover holds
// CONTENT a reader acts on rather than a word they read, which is why the
// drawing has controls in it.

import { panel, panelHead } from './_overlay'
import type { TypePageBody } from './_shape'

const popover: TypePageBody = {
  drawings: [
    {
      label: 'open',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-col items-start gap-1.5' },
          children: [
            {
              type: 'button',
              variant: 'outline',
              size: 'sm',
              label: 'Columns',
              props: { type: 'button' },
            },
            panel({
              width: 'w-64',
              children: [
                ...panelHead('Columns'),
                // A checkbox carries `checked`/`indeterminate` and no label of
                // its own — the label belongs to the `field` around it, which is
                // how every form in this app is built.
                {
                  type: 'field',
                  fieldLabel: 'Name',
                  children: [{ type: 'checkbox', checked: true }],
                },
                {
                  type: 'field',
                  fieldLabel: 'Company',
                  children: [{ type: 'checkbox', checked: true }],
                },
                { type: 'field', fieldLabel: 'Amount', children: [{ type: 'checkbox' }] },
              ],
            }),
          ],
        },
      ],
    },
  ],
}

export default popover
