/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `sheet` — a panel that slides in from a side edge and covers the page. The
// panel that rises from the bottom is a different type, `drawer` (`drawer.ts`).
//
// Refused by the catalogue for the same reason as its siblings: it would cover
// the kit rather than sit in it. Drawn as the panel at each edge, and — unlike
// every other overlay here — with a real Sizes section, because a sheet is the
// one overlay whose WIDTH is a declared key.
//
// base-nova's sheet is square-cornered, on the `popover` colour, and draws ONE
// border: the edge facing the page. Its header has no divider under it, and its
// close is the X in the top-right corner.
//
// ─── THE SIZES SECTION IS AUTHORED, AND THE SCHEMA CANNOT SUPPLY IT ────────
//
// The derived Sizes section follows a closed `size` union. A sheet's width is
// `drawerSize`, a differently-named key, so `sizeCount` reads 0 and the derived
// section never fires. The axis is real and declared; only its name is not the
// one the projection looks for.

import { box, closeButton, line } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

/** The `sheet-header` slot: title, then the sentence under it, no divider. */
const header = (title: string, description?: string): PageComponent =>
  box(
    'flex flex-col gap-0.5 p-4',
    [
      line(title, 'text-foreground text-base font-medium', 'sheet-title'),
      ...(description === undefined
        ? []
        : [line(description, 'text-muted-foreground text-sm', 'sheet-description')]),
    ],
    'sheet-header'
  )

/** The sheet's `sheet-content`, pinned to one edge of a page-shaped frame. */
const atEdge = (
  side: 'left' | 'right',
  width: string,
  children: readonly PageComponent[]
): PageComponent =>
  box(
    `bg-background relative flex h-64 w-full overflow-hidden rounded-lg border ${side === 'right' ? 'justify-end' : 'justify-start'}`,
    [
      box('absolute inset-0 bg-black/10', [], 'sheet-overlay'),
      box(
        `bg-popover text-popover-foreground relative flex h-full flex-col gap-4 text-sm shadow-lg ${side === 'right' ? 'border-l' : 'border-r'} ${width}`,
        [...children, closeButton('sheet', 'top-3 right-3')],
        'sheet-content'
      ),
    ]
  )

const row = (label: string, value: string): PageComponent =>
  box('flex items-baseline justify-between gap-4 border-b py-1.5 last:border-b-0', [
    line(label, 'text-muted-foreground text-xs', undefined, 'span'),
    line(value, 'text-foreground text-sm', undefined, 'span'),
  ])

const sheet: TypePageBody = {
  drawings: [
    {
      label: 'right',
      children: [
        atEdge('right', 'w-72', [header('Filters', 'Narrow the list without leaving it.')]),
      ],
    },
    {
      label: 'record',
      children: [
        atEdge('right', 'w-80', [
          header('Rénovation atelier', 'Proposal for Menuiserie Roux.'),
          box('flex flex-col px-4', [
            row('Company', 'Menuiserie Roux'),
            row('Stage', 'Proposal'),
            row('Amount', '24 500 €'),
            row('Close date', '2026-10-14'),
          ]),
        ]),
      ],
    },
    {
      label: 'left',
      children: [atEdge('left', 'w-64', [header('Sections', 'Everywhere this document goes.')])],
    },
  ],
  sizes: [
    {
      label: "drawerSize: 'sm' · 256px",
      children: [atEdge('right', 'w-64', [header('Filters')])],
    },
    {
      label: "drawerSize: 'md' · 320px",
      children: [atEdge('right', 'w-80', [header('Filters')])],
    },
    {
      label: "drawerSize: 'lg' · 512px",
      children: [atEdge('right', 'w-[32rem]', [header('Filters')])],
    },
    { label: "drawerSize: 'full'", children: [atEdge('right', 'w-full', [header('Filters')])] },
  ],
}

export default sheet
