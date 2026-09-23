/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `spinner` — waiting, when nothing else can be shown.
//
// The type declares no variant union and no props at all: a spinner is one
// thing. What the design system names as its three forms are the three SIZES it
// is drawn at, which the recipe sets rather than the schema — so the headings
// are the sizes and there is no Sizes section, because a section claiming a
// `size` key would send an author to write one the decoder refuses.
//
// The middle drawing carries a label, because a spinner with no word beside it
// says that something is happening and not what.

import type { TypePageBody } from './body-shape'

const spinner: TypePageBody = {
  drawings: [
    {
      label: 'sm',
      children: [{ type: 'spinner', props: { className: 'size-4' } }],
    },
    {
      label: 'md with label',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'text-foreground-subtle flex items-center gap-2 text-sm' },
          children: [
            { type: 'spinner', props: { className: 'size-5' } },
            { type: 'text', element: 'span', content: 'Loading runs…' },
          ],
        },
      ],
    },
    {
      label: 'lg',
      children: [{ type: 'spinner', props: { className: 'size-8' } }],
    },
  ],
}

export default spinner
