/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `separator` — a type whose whole appearance is one pixel, drawn three ways.
//
// It declares no variant union, so the derived page drew it once: a bordered box
// with a hairline in it, under a heading, which reads as a page that failed
// rather than a component that is a line. What a reader needs is not the line
// but what the line DOES, so each drawing puts one in the position a page would.
//
// All three are the real component. `orientation: vertical` stands the rule up
// between the items of a row, and `label` sets words into the middle of a
// horizontal one — shadcn's FieldSeparator, the "or continue with" between two
// ways to sign in. A vertical separator takes no label, so there is no fourth
// drawing combining the two.

import type { TypePageBody } from './body-shape'

const separator: TypePageBody = {
  drawings: [
    {
      label: 'horizontal',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'w-full', 'data-design-kit-type': 'separator' },
          children: [{ type: 'separator' }],
        },
      ],
    },
    {
      label: "orientation: 'vertical'",
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'text-foreground flex h-5 items-center gap-3 text-sm' },
          children: [
            { type: 'text', element: 'span', content: 'Fields' },
            { type: 'separator', orientation: 'vertical' },
            { type: 'text', element: 'span', content: 'Views' },
            { type: 'separator', orientation: 'vertical' },
            { type: 'text', element: 'span', content: 'Automations' },
          ],
        },
      ],
    },
    {
      label: 'label',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'w-full' },
          children: [{ type: 'separator', label: 'Or continue with' }],
        },
      ],
    },
  ],
}

export default separator
