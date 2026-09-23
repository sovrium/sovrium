/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `drawer` — a panel that slides in from an edge and covers the page.
//
// Refused by the catalogue for the same reason as its siblings: it would cover
// the kit rather than sit in it. Drawn as the panel at each edge, and — unlike
// every other overlay here — with a real Sizes section, because a drawer is the
// one overlay whose WIDTH is a declared key.
//
// ─── THE SIZES SECTION IS AUTHORED, AND THE SCHEMA CANNOT SUPPLY IT ────────
//
// The derived Sizes section follows a closed `size` union. A drawer's width is
// `drawerSize`, a differently-named key, so `sizeCount` reads 0 and the derived
// section never fires. The axis is real and declared; only its name is not the
// one the projection looks for.

import { panel, panelHead } from './overlay-panel'
import type { PageComponent, TypePageBody } from './body-shape'

/** The drawer panel pinned to one edge of a page-shaped frame. */
const atEdge = (
  side: 'left' | 'right',
  width: string,
  children: readonly PageComponent[]
): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className: `border-border bg-background-subtle flex w-full rounded-lg border p-3 ${side === 'right' ? 'justify-end' : 'justify-start'}`,
    },
    children: [panel({ width, children: [...children] })],
  }) as PageComponent

const row = (label: string, value: string): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: {
      className:
        'border-border flex items-baseline justify-between gap-4 border-b py-1.5 last:border-b-0',
    },
    children: [
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground-subtle text-[11px]' },
        content: label,
      },
      {
        type: 'text',
        element: 'span',
        props: { className: 'text-foreground text-sm' },
        content: value,
      },
    ],
  }) as PageComponent

const drawer: TypePageBody = {
  drawings: [
    {
      label: 'right',
      children: [
        atEdge('right', 'w-72', panelHead('Filters', 'Narrow the list without leaving it.')),
      ],
    },
    {
      label: 'record',
      children: [
        atEdge('right', 'w-80', [
          ...panelHead('Rénovation atelier'),
          row('Company', 'Menuiserie Roux'),
          row('Stage', 'Proposal'),
          row('Amount', '24 500 €'),
          row('Close date', '2026-10-14'),
        ]),
      ],
    },
    {
      label: 'left',
      children: [atEdge('left', 'w-64', panelHead('Sections', 'Everywhere this document goes.'))],
    },
  ],
  sizes: [
    {
      label: "drawerSize: 'sm' · 256px",
      children: [atEdge('right', 'w-64', panelHead('Filters'))],
    },
    {
      label: "drawerSize: 'md' · 320px",
      children: [atEdge('right', 'w-80', panelHead('Filters'))],
    },
    {
      label: "drawerSize: 'lg' · 512px",
      children: [atEdge('right', 'w-[32rem]', panelHead('Filters'))],
    },
    { label: "drawerSize: 'full'", children: [atEdge('right', 'w-full', panelHead('Filters'))] },
  ],
}

export default drawer
