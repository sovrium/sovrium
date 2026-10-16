/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { DataTableGridColumn, DataTableInstance } from './table-features'
import type { DataTableColumnMeta } from '../table/column-meta'
import type { CSSProperties } from 'react'

/**
 * A `fill` grid's column widths, decided by its COLUMN DEFINITIONS rather than
 * by whatever its cells happen to hold.
 *
 * On the auto table layout, a grid that IS the page sized its columns by content,
 * so the frame moved three times on the way in: once for the skeleton's bars,
 * once more if the read failed, and again when the rows landed — each column
 * re-measured against content of a different length. A fixed layout read off
 * the definitions answers all three states the same way:
 *
 *  - the selection and row-number columns keep their own narrow width;
 *  - a column whose config declares a `width` (or that the reader resized)
 *    keeps that width;
 *  - every other column takes an equal share of what is left, with a floor of
 *    {@link MIN_SHARED_COLUMN_PX} so a wide table still scrolls sideways rather
 *    than crushing its columns.
 *
 * Only `layout: 'fill'` takes it. A flowing grid sits among other content and
 * keeps the auto layout, whose content-fitting widths it was designed with.
 */

/** The narrowest an unsized column may be squeezed before the table scrolls instead. */
const MIN_SHARED_COLUMN_PX = 160

/** The selection column's width: one checkbox and its padding. */
const SELECTION_COLUMN_PX = 32

/** A column's fixed width, or `undefined` for one that takes an equal share. */
function fixedWidthOf(
  column: DataTableGridColumn,
  resized: Readonly<Record<string, number>>
): number | undefined {
  const meta = column.columnDef.meta as DataTableColumnMeta | undefined
  if (meta?.selection === true) return SELECTION_COLUMN_PX
  if (column.id === '__row_number' || resized[column.id] !== undefined) return column.getSize()
  return meta?.authoredWidth
}

/** The widths the reader has dragged, read the way the header cells read them. */
const resizedWidths = (table: DataTableInstance): Readonly<Record<string, number>> =>
  table.atoms.columnSizing.get()

/** Each visible column's fixed width, in order — `undefined` for a shared one. */
export function fillColumnWidths(
  table: DataTableInstance
): ReadonlyArray<{ readonly id: string; readonly width: number | undefined }> {
  const resized = resizedWidths(table)
  return table
    .getVisibleLeafColumns()
    .map((column) => ({ id: column.id, width: fixedWidthOf(column, resized) }))
}

/**
 * The `fill` table's own width rule: the full frame, never narrower than its
 * fixed columns plus the floor of each shared one.
 */
export function fillTableStyle(table: DataTableInstance): CSSProperties {
  const resized = resizedWidths(table)
  const minWidth = table
    .getVisibleLeafColumns()
    .reduce((sum, column) => sum + (fixedWidthOf(column, resized) ?? MIN_SHARED_COLUMN_PX), 0)
  return { width: '100%', minWidth, tableLayout: 'fixed' }
}

/**
 * The `<table>`'s frame attributes: the fixed-width rule on a `fill` grid, and
 * `aria-busy` while its records read is in flight, so assistive technology
 * waits for the rows rather than reading the skeleton.
 */
export function tableFrameAttributes(
  table: DataTableInstance,
  state: { readonly fills: boolean; readonly loading: boolean }
): { readonly style?: CSSProperties; readonly 'aria-busy'?: true } {
  return {
    ...(state.fills && { style: fillTableStyle(table) }),
    ...(state.loading && { 'aria-busy': true as const }),
  }
}
