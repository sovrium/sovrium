/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type FrozenOffsets } from './frozen-columns'
import type {
  EditingCell,
  FieldMetaMap,
  FieldWriteValue,
  SaveStatus,
} from '../hooks/use-inline-editing'
import type { TabDirection } from './island/tab-target'
import type { DataTableCell, DataTableColumnMeta } from './island/table-features'
import type { CellRange, GridCursor } from './island/use-grid-cursor'

/**
 * Auto-save wiring for inline cell editing. When present, cells in the
 * data-table persist edits automatically (debounced) without an Enter keypress.
 */
export interface InlineAutoSave {
  readonly enabled: boolean
  readonly debounceMs: number
  /**
   * When true, edits persist only when the field loses focus (Notion-like),
   * not on every debounced keystroke (Airtable-like).
   */
  readonly saveOnBlur?: boolean
  /** Persists the in-progress edit without exiting edit mode. */
  readonly onAutoSave: (newValue: unknown) => void | Promise<void>
  /** Records the latest un-persisted value so a cell switch can flush it. */
  readonly onTrackValue: (newValue: unknown) => void
  /** Saves the current value and moves the editor to the next editable cell. */
  readonly onTabNext: (
    rowId: string | number,
    currentField: string,
    newValue: unknown,
    direction: TabDirection
  ) => void
}

/**
 * Action triggered when a user clicks a row in the data-table.
 *
 * Two variants are supported in the foundation tier:
 * - `navigate` — the `path` template can contain `$record.<field>` tokens that
 *   are replaced with the clicked row's field values at click time
 *   (e.g. `/deals/$record.id` → `/deals/42`).
 * - `openDrawer` — PG-04 quick-edit drawer dispatch. Fires a
 *   `sovrium:open-drawer` CustomEvent with `detail: { id, record }` so the
 *   matching drawer island (`{ type: 'drawer', id: <component> }`) toggles
 *   open. The clicked row's record is attached to `detail.record` for the
 *   future form-population tier.
 *
 * These two are now the ONLY variants the schema accepts: `onRowClick` is
 * typed as `RowClickActionSchema`, not the full `ActionSchema`. The remaining
 * six variants (auth / crud / automation / filter / toast / fetch) are
 * rejected at config-validation time rather than accepted and then ignored
 * here. Richer behaviour on a row click belongs on the referenced drawer
 * component's footer `actions`, where the full `ActionSchema` is honoured.
 */
export type DataTableRowClickAction =
  | { readonly type: 'navigate'; readonly path: string }
  | { readonly type: 'openDrawer'; readonly component: string }

/**
 * Persists ONE cell without first entering edit mode.
 *
 * The single-gesture controls (`checkbox`, `rating`) commit on one click, so
 * there is no editor to open and close around the write — and they cannot go
 * through the edit-mode save, which reads the editing cell from its own closure
 * and would drop a toggle fired in the same tick.
 */
export type CellCommit = (
  rowId: string | number,
  field: string,
  value: FieldWriteValue
) => void | Promise<unknown>

/**
 * Per-cell metadata as a row renderer sees it: the table-wide
 * {@link DataTableColumnMeta}, plus the `undefined` a display column (selection
 * checkbox, row number, action cluster) carries because it declares no meta.
 */
export type CellMeta = DataTableColumnMeta | undefined

/**
 * Everything a data row needs beyond the row itself and its stripe index.
 * Assembled ONCE per body render and handed to every row — flat and grouped
 * alike, which is what keeps the two paths from drifting again.
 */
export interface DataRowContext {
  readonly cellClass: string
  readonly borderClass: string
  readonly striped: boolean
  readonly selectionMode?: 'none' | 'single' | 'multiple'
  readonly gridRole?: boolean
  /**
   * Whether the keyboard can move a cursor between this grid's cells —
   * SEPARATE from {@link gridRole}, which only decides what a cell reports
   * itself as to a screen reader.
   */
  readonly navigable?: boolean
  /**
   * The cell CURSOR — which single cell the keyboard points at, as
   * `(rowId, columnId)`. Present only on a grid (`gridRole`), because only a
   * grid navigates by cell; a read-only table keeps its native semantics and
   * its native focus behaviour untouched.
   *
   * This is a different axis from the row `aria-selected` on `<tr>`, which
   * means the reader TICKED that row. A reader can be reading down column
   * three while three unrelated rows stay ticked, so the two cannot share a
   * marker. See `grid-cursor.ts`.
   */
  readonly cursorRowId?: string
  readonly cursorColumnId?: string
  /**
   * Whether the reader PLACED the cursor. A grid nobody has touched still
   * resolves a cursor — its first cell, the default tab stop — and nothing that
   * looks like an offer to act should hang off that.
   */
  readonly cursorPlaced?: boolean
  /**
   * The rectangle of cells a Shift-click or Shift-Arrow gathered around the
   * cursor. Every cell inside it carries `aria-selected`, exactly as the cursor
   * does — a range is the cursor's extent, not a second kind of marker.
   */
  readonly range?: CellRange
  /**
   * The span a fill-handle drag currently covers, before anything is written.
   * Cells inside it (other than the cursor itself) carry `data-fill-preview`.
   */
  readonly fillPreview?: CellRange
  /** Starts a fill drag from the cursor. Absent when the grid cannot fill. */
  readonly onFillDragStart?: (source: GridCursor) => void
  /** Fills the cursor's column to the end of its neighbour, on a double-click. */
  readonly onFillDown?: (source: GridCursor) => void
  /** Whether a cell in this column may be the source of a fill. */
  readonly canFillFrom?: (cell: DataTableCell) => boolean
  readonly editingCell?: EditingCell
  readonly fieldMeta?: FieldMetaMap
  readonly tableName?: string
  readonly autoSave?: InlineAutoSave
  readonly inlineSaveStatus?: SaveStatus
  readonly onRowClickAction?: DataTableRowClickAction
  readonly onCellDoubleClick?: (rowId: string | number, field: string, value: unknown) => void
  readonly onEditSave?: (newValue: unknown) => void
  readonly onEditCancel?: () => void
  /** Persists a single-gesture cell (checkbox / rating) — see {@link CellCommit}. */
  readonly onCellCommit?: CellCommit
  /** Measured sticky offsets for the pinned (`frozen`) columns, keyed by field. */
  readonly frozenOffsets?: FrozenOffsets
  /**
   * Field whose declared option colours fill each row — the grid's spelling of
   * the `colorField` the record views already read. Absent on every grid that
   * declares none, which is every grid shipped before this existed.
   */
  readonly rowColorField?: string
  /**
   * `optionValue → #RRGGBB` for the field {@link rowColorField} names, resolved
   * server-side from `app.tables` (the island only ever sees records).
   */
  readonly rowColorFieldColors?: Readonly<Record<string, string>>
}
