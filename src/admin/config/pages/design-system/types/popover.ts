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
//
// base-nova draws it as a ringed card on the `popover` colour with no arrow,
// headed by `props.title` and `props.description` in its `popover-header`.

import { box, floatingPanel, line } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

/** One labelled input; the label belongs to the `field` around it. */
const dimension = (label: string, name: string, placeholder: string): PageComponent =>
  ({
    type: 'field',
    fieldLabel: label,
    children: [{ type: 'input', props: { name, placeholder } }],
  }) as PageComponent

const popover: TypePageBody = {
  drawings: [
    {
      label: 'open',
      children: [
        box('flex flex-col items-start gap-1', [
          {
            type: 'button',
            variant: 'outline',
            label: 'Column width',
            props: { type: 'button' },
          } as PageComponent,
          floatingPanel('popover', [
            box(
              'flex flex-col gap-0.5 text-sm',
              [
                line('Column width', 'font-medium', 'popover-title'),
                line('Applies to this view only.', 'text-muted-foreground', 'popover-description'),
              ],
              'popover-header'
            ),
            dimension('Width', 'width', '240px'),
            dimension('Minimum width', 'min-width', '120px'),
          ]),
        ]),
      ],
    },
  ],
}

export default popover
