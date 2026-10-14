/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CellStyleCondition } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * Per-column metadata the grid attaches to every `ColumnDef` it builds.
 *
 * Declared ONCE here through the `columnMeta` slot rather than re-asserted at
 * each read site: before v9 every reader carried its own `as { frozen?: … }`
 * cast, so a renamed key type-checked at all four of them and failed only at
 * runtime.
 */
export interface DataTableColumnMeta {
  /** Pins the column to the left edge; consumed by `frozen-columns.ts`. */
  readonly frozen?: boolean
  /** Conditional cell styling rules evaluated per row. */
  readonly cellStyle?: readonly CellStyleCondition[]
  /** `truncate` — the cell holds one line, cut at the column's width. */
  readonly truncate?: boolean
  /** The bound record field. Absent on display columns (selection, actions). */
  readonly field?: string
  /** Opts the column into inline double-click editing. */
  readonly editable?: boolean
  /**
   * The width the CONFIG declared for this column, in pixels — absent when the
   * column declared none.
   *
   * It duplicates the column def's `size` on purpose, because `size` cannot
   * answer the only question the header cell asks: was this width AUTHORED?
   * TanStack merges its own default into every column def, so `getSize()`
   * returns 150 for a column nobody sized, indistinguishable from a column
   * someone sized at 150. Painting that default would give every unauthored
   * column a hard 150px and destroy the auto layout the grid is built on.
   */
  readonly authoredWidth?: number
  /** The column's authored text alignment; absent means the default, left. */
  readonly align?: 'left' | 'center' | 'right'
  /**
   * Marks the generated action cluster column, whose cells are BUTTONS.
   *
   * The flag exists because that column binds no field and so had no other
   * identity a cell could be recognised by, and the cell has to be recognised:
   * a click on one of its buttons belongs to that button, never to the row
   * around it.
   */
  readonly actions?: boolean
  /**
   * The column's values are set in tabular figures: a quantity, an instant or a
   * time of day, which a reader scans DOWN the column. Read off the field type
   * (`field-type-presentation-service.ts`), never authored.
   */
  readonly tabular?: boolean
  /** Marks the generated row-selection column, whose cells hold one checkbox. */
  readonly selection?: boolean
}
