/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui table (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * base-nova's `Table` parts, for a table drawn from static rows — a leaf module, so an island that draws a table (the API-key manager) imports
 * these strings alone. `display-default-classes.ts` re-exports it for the
 * server-rendered surfaces.
 */

/** Compute the className for the scrolling container around the table. */
export const computeStaticTableContainerClasses = (): string => 'relative w-full overflow-x-auto'

/**
 * Compute the className for the `<table>` (`data-slot="table"`).
 *
 * base-nova's `w-full caption-bottom text-sm`, with ONE departure: separate
 * borders with no spacing instead of the collapsed model. A collapsed border
 * lends half of each 1px rule to the rows either side of it, so rows land on
 * half pixels (27, 28.5, 28 …); separated, each rule belongs to its cells and
 * every row is a whole number of pixels tall. The rules therefore sit on the
 * cells (`*:border-b` on a row) rather than on the `<tr>`, which a separated
 * table does not draw.
 */
export const computeStaticTableShellClasses = (): string =>
  'w-full caption-bottom border-separate border-spacing-0 text-sm'

/**
 * Compute the className for the `<tbody>` (`data-slot="table-body"`): base-nova
 * drops the last row's rule, here on that row's cells.
 */
export const computeStaticTableBodyClasses = (): string => '[&_tr:last-child>*]:border-0'

/** Compute the className for one `<tr>` (`data-slot="table-row"`). */
export const computeStaticTableRowClasses = (): string =>
  '*:border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted'

/**
 * Static-table cell kind:
 *   - `'header'` — `<th>` (`data-slot="table-head"`)
 *   - `'data'`   — `<td>` (`data-slot="table-cell"`)
 */
export type StaticTableCellKind = 'header' | 'data'

/**
 * base-nova's `TableHead` and `TableCell`, with ONE departure: the vertical
 * padding is `design.density`'s row step (`--sv-density-row-y`, 5px by
 * default) rather than base-nova's `h-10` head and `p-2` cell, because the
 * density ladder is documented to pad a static table's header cells and rows.
 * The horizontal padding is base-nova's `px-2`.
 */
const STATIC_TABLE_HEAD =
  'px-2 py-(--sv-density-row-y) text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0'

const STATIC_TABLE_CELL =
  'px-2 py-(--sv-density-row-y) align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0'

/** Compute the className for a static-table cell, `<th>` or `<td>`. */
export const computeStaticTableCellClasses = ({
  kind,
}: {
  readonly kind: StaticTableCellKind
}): string => (kind === 'header' ? STATIC_TABLE_HEAD : STATIC_TABLE_CELL)

/** Compute the className for the `<caption>` (`data-slot="table-caption"`). */
export const computeStaticTableCaptionClasses = (): string => 'mt-4 text-sm text-muted-foreground'
