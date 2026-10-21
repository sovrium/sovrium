/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/data-table-toolbar@0.38.0#5e43986315ab

// The search box of a data-table toolbar: its label, placeholder and the channel it publishes on.

// ── From components/data-table-blocks.ts ───────────────────────────────────────
// The console's data grids, INSTALLED from the library's `row-actions` block
// (shadcn's data-table with a trailing `…` menu per row, as dashboard-01 draws
// it). The copy is the block's `table` node; `Console Block Parity` holds it to
// that subtree. Re-install with `sovrium library add block/row-actions --update`.
//
// ─── WHAT THE COPY HOLDS, AND WHAT EACH GRID BINDS ─────────────────────────
//
// It holds the one decision the console takes from the block: a grid's row
// actions are ONE menu per row (`rowActions.display: 'menu'`), destructive last
// after a separator, each confirm naming what it acts on. An app's default stays
// inline buttons; the console is data-dense, so its rows carry a menu.
//
// Everything else is a binding each grid fills through `dataTable`: its read
// (`dataSource`), its columns and their actions, its pager (per endpoint: paged
// with a total → numbered, cursor-paged → none, unpaged → none), its toolbar,
// its messages and its id.
// ── From toolbarSearchCopy ─────────────────────────────────────────────────────
/**
 * The search box of the library's `data-table-toolbar` block, INSTALLED alone:
 * the console grids read system endpoints, which no filter bar, export or
 * import of a TABLE can address, so only the box carries over. What the reader
 * types is published as `q` on the channel the grid listens to, and the
 * endpoint applies it. `Console Block Parity` holds it to the block's first
 * control; re-install with `sovrium library add block/data-table-toolbar --update`.
 */

import type { AppEncoded as AppConfig } from '@/domain/models/app'

type Template = NonNullable<AppConfig['components']>[number]

// eslint-disable-next-line sovrium/no-double-assertion -- a template that declares inputs writes `$name` where the component type expects a list or an object; each placement is decoded as the page component it produces when the app starts
export const consoleToolbarSearch = {
  name: 'console-toolbar-search',
  type: 'search-input',
  render: 'transparent',
  inputs: {
    ariaLabel: {
      kind: 'text',
      required: true,
    },
    placeholder: {
      kind: 'text',
      required: true,
    },
    publishes: {
      kind: 'json',
      required: true,
    },
  },
  props: {
    className: 'h-8 w-full sm:w-[150px] lg:w-[250px]',
    'aria-label': '$ariaLabel',
  },
  placeholder: '$placeholder',
  publishes: '$publishes',
} as unknown as Template
