/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `divider` — a type whose whole appearance is one pixel, drawn three ways.
//
// It declares no variant union, so the derived page drew it once: a bordered box
// with a hairline in it, under a heading, which reads as a page that failed
// rather than a component that is a line. What a reader needs is not the line
// but what the line DOES, so each drawing puts one in the position a page would.
//
// Only the first is the component on its own. `divider` accepts nothing but the
// core fields — no orientation, no label — so the vertical and labelled forms
// are compositions a page makes WITH a divider rather than options on one, and
// drawing them as if they were options would document a config surface that
// does not exist.

import type { TypePageBody } from './body-shape'

const RULE = 'border-border border-t'

const divider: TypePageBody = {
  drawings: [
    {
      label: 'horizontal',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'w-full', 'data-design-kit-type': 'divider' },
          children: [{ type: 'divider' }],
        },
      ],
    },
    {
      label: 'vertical',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'text-foreground flex items-center gap-3 text-sm' },
          children: [
            { type: 'text', element: 'span', content: 'Fields' },
            // A `div`, not a `span`: `container` takes block elements only
            // (div, section, main, aside, nav, header, footer, article) and the
            // schema refuses the config outright otherwise. `inline-block` is
            // what puts it back on the text baseline.
            {
              type: 'container',
              element: 'div',
              props: { className: 'border-border inline-block h-6 border-l' },
              children: [],
            },
            { type: 'text', element: 'span', content: 'Views' },
          ],
        },
      ],
    },
    {
      label: 'labelled',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex w-full items-center gap-3' },
          children: [
            {
              type: 'container',
              element: 'div',
              props: { className: `flex-1 ${RULE}` },
              children: [],
            },
            {
              type: 'text',
              element: 'span',
              props: { className: 'text-foreground-subtle text-[11px]' },
              content: 'or continue with',
            },
            {
              type: 'container',
              element: 'div',
              props: { className: `flex-1 ${RULE}` },
              children: [],
            },
          ],
        },
      ],
    },
  ],
}

export default divider
