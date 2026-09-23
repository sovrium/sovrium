/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `swatch` — a named token, resolved and drawn at a size a reader can judge.
//
// All four are the real component. `variant` is what makes it look like several
// different components while being one: a colour token painted, or an easing
// token plotted. The fourth is a composition, because a swatch in a table cell
// is a thing a page does with one rather than a mode of it.

import type { TypePageBody } from './body-shape'

const swatch: TypePageBody = {
  drawings: [
    {
      label: 'single',
      children: [{ type: 'swatch', token: 'primary', label: 'primary', size: 64, showHex: true }],
    },
    {
      label: 'row',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-wrap items-start gap-4' },
          children: ['background', 'background-subtle', 'border', 'foreground'].map((t) => ({
            type: 'swatch',
            token: t,
            label: t,
            size: 48,
          })),
        },
      ],
    },
    {
      label: 'ramp',
      children: [
        {
          type: 'container',
          element: 'div',
          props: { className: 'flex flex-wrap items-start gap-2' },
          children: ['foreground', 'foreground-muted', 'foreground-subtle'].map((t) => ({
            type: 'swatch',
            token: t,
            label: t,
            size: 40,
          })),
        },
      ],
    },
    {
      label: 'in a table cell',
      children: [
        {
          type: 'container',
          element: 'div',
          props: {
            className: 'border-border flex w-full items-center gap-3 rounded border px-3 py-2',
          },
          children: [
            // `label: ''` and not an omitted label: a swatch with no label of
            // its own falls back to printing the token, and the cell then read
            // `primary primary` — the chip naming the colour beside the cell
            // value naming it again. In a cell the chip is the decoration and
            // the mono value is the content, so the chip is the one that gives
            // its name up.
            { type: 'swatch', token: 'primary', label: '', size: 16 },
            {
              type: 'text',
              element: 'span',
              props: { className: 'text-foreground font-mono text-[11px]' },
              content: 'primary',
            },
          ],
        },
      ],
    },
  ],
}

export default swatch
