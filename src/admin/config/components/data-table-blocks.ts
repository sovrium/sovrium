/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// sovrium-library: block/row-actions@0.37.0#fe05ef53d438
// sovrium-library: block/record-sheet@0.37.0#d970a65eef96
// sovrium-library: block/data-table@0.37.0#9cec907aa829

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

import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** The block's `table` node, as the console installs it. */
export const rowActionsTableCopy = {
  type: 'table',
  rowActions: { display: 'menu' },
} as const

/** A console grid: the installed copy with this grid's bindings. */
export const dataTable = (bindings: Readonly<Record<string, unknown>>): PageComponent =>
  ({ ...rowActionsTableCopy, ...bindings }) as PageComponent

/**
 * A status cell as shadcn's data-table draws one (dashboard-01's Status column):
 * an outline Badge with a leading dot, the word as the reading and the dot as
 * the kind. `cellStyle.className` lands on the `<td>` AND on the `<span>` inside
 * it, so every class is scoped to the span (`[&:is(span)]:`). Literal strings:
 * the build-time class harvest reads this file as text.
 */
export const STATUS_BADGE = {
  neutral:
    "[&:is(span)]:inline-flex [&:is(span)]:items-center [&:is(span)]:gap-1.5 [&:is(span)]:rounded-md [&:is(span)]:border [&:is(span)]:border-border [&:is(span)]:px-1.5 [&:is(span)]:py-0.5 [&:is(span)]:text-xs [&:is(span)]:font-medium [&:is(span)]:before:size-1.5 [&:is(span)]:before:shrink-0 [&:is(span)]:before:rounded-full [&:is(span)]:before:content-[''] [&:is(span)]:text-muted-foreground [&:is(span)]:before:bg-muted-foreground/50",
  positive:
    "[&:is(span)]:inline-flex [&:is(span)]:items-center [&:is(span)]:gap-1.5 [&:is(span)]:rounded-md [&:is(span)]:border [&:is(span)]:border-border [&:is(span)]:px-1.5 [&:is(span)]:py-0.5 [&:is(span)]:text-xs [&:is(span)]:font-medium [&:is(span)]:before:size-1.5 [&:is(span)]:before:shrink-0 [&:is(span)]:before:rounded-full [&:is(span)]:before:content-[''] [&:is(span)]:text-muted-foreground [&:is(span)]:before:bg-green-500",
  caution:
    "[&:is(span)]:inline-flex [&:is(span)]:items-center [&:is(span)]:gap-1.5 [&:is(span)]:rounded-md [&:is(span)]:border [&:is(span)]:border-border [&:is(span)]:px-1.5 [&:is(span)]:py-0.5 [&:is(span)]:text-xs [&:is(span)]:font-medium [&:is(span)]:before:size-1.5 [&:is(span)]:before:shrink-0 [&:is(span)]:before:rounded-full [&:is(span)]:before:content-[''] [&:is(span)]:text-muted-foreground [&:is(span)]:before:bg-amber-500",
  progress:
    "[&:is(span)]:inline-flex [&:is(span)]:items-center [&:is(span)]:gap-1.5 [&:is(span)]:rounded-md [&:is(span)]:border [&:is(span)]:border-border [&:is(span)]:px-1.5 [&:is(span)]:py-0.5 [&:is(span)]:text-xs [&:is(span)]:font-medium [&:is(span)]:before:size-1.5 [&:is(span)]:before:shrink-0 [&:is(span)]:before:rounded-full [&:is(span)]:before:content-[''] [&:is(span)]:text-muted-foreground [&:is(span)]:before:bg-blue-500",
  destructive:
    "[&:is(span)]:inline-flex [&:is(span)]:items-center [&:is(span)]:gap-1.5 [&:is(span)]:rounded-md [&:is(span)]:border [&:is(span)]:border-border [&:is(span)]:px-1.5 [&:is(span)]:py-0.5 [&:is(span)]:text-xs [&:is(span)]:font-medium [&:is(span)]:before:size-1.5 [&:is(span)]:before:shrink-0 [&:is(span)]:before:rounded-full [&:is(span)]:before:content-[''] [&:is(span)]:text-destructive [&:is(span)]:before:bg-destructive",
} as const

/**
 * The console's record drawers, INSTALLED from the library's `record-sheet`
 * block: shadcn's Sheet from the right edge (from the bottom on a phone), at
 * its medium width, with Prev/Next through the grid's rows. What the copy
 * holds is that frame; each drawer binds its id, title, read, fields, whether
 * it may edit, and its actions.
 */
export const recordSheetCopy = {
  type: 'sheet',
  drawerSide: 'right',
  drawerSize: 'md',
  navigation: { siblings: true },
} as const

/** A console record drawer: the installed copy with this drawer's bindings. */
export const recordSheet = (bindings: Readonly<Record<string, unknown>>): PageComponent =>
  ({ ...recordSheetCopy, ...bindings }) as PageComponent

/**
 * The design-system pages' read-only ledgers, INSTALLED from the library's
 * `data-table` block: shadcn's table anatomy with labelled columns that sort
 * from their header. Re-install with `sovrium library add block/data-table --update`.
 *
 * What the copy keeps is the grid itself and nothing the block layers on top
 * of it. A ledger here reads a design-system endpoint the operator's config
 * bounds, so it holds every row (no pager), it is read-only (no selection, no
 * bulk delete: the section has no write verb), and it is a handful of rows (no
 * search box: a textbox in this section is the edit affordance it refuses).
 * Each ledger binds its read, its columns and their labels, and its empty line.
 */
export const dataTableCopy = {
  type: 'table',
} as const

/** A design-system ledger: the installed copy with this ledger's bindings. */
export const ledgerTable = (bindings: Readonly<Record<string, unknown>>): PageComponent =>
  ({ ...dataTableCopy, ...bindings }) as PageComponent
