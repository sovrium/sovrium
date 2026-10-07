/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { AddRowConfig } from './add-row'
import type { DataTableRowClickAction, CellCommit, InlineAutoSave } from './data-row'
import type { FrozenOffsets } from './frozen-columns'
import type { GroupSummaryContext } from './group-summary'
import type { EditingCell, FieldMetaMap, SaveStatus } from '../hooks/use-inline-editing'
import type { CellRange, GridCursor } from './island/grid-cursor-model'
import type { DataTableCell, DataTableColumnDef, DataTableRow } from './island/table-features'
import type { ViewGroupBy } from '@/domain/models/app/tables/views/group-by'

/**
 * Everything the grid's body rows are handed: the table, its editing and
 * cursor state, grouping, pinning and the row-level callbacks.
 */

export interface TableBodyRowsProps {
  readonly rows: readonly DataTableRow[]
  readonly allColumns: readonly DataTableColumnDef[]
  readonly isLoading: boolean
  readonly cellClass: string
  readonly borderClass: string
  readonly striped: boolean
  readonly emptyMessage: string
  /**
   * Message shown when a search reduced the grid to zero rows — the "no match"
   * state, DISTINCT from `emptyMessage` (the zero-record empty state). Rendered
   * in an `aria-live` `role="status"` region so the result of typing is
   * announced; a `{query}` token is substituted with the active search string so
   * the message echoes what was searched. When undefined, a searched-to-zero
   * grid falls back to `emptyMessage` (fully backward compatible).
   */
  readonly noMatchMessage?: string
  /**
   * Active search string (TanStack `globalFilter`). Echoed into
   * `noMatchMessage`'s `{query}` token and — since search runs server-side, so a
   * no-match returns an empty page rather than a filtered-out one — the SOLE
   * signal distinguishing a no-match from a genuinely empty dataset.
   */
  readonly globalFilter?: string
  readonly selectionMode?: 'none' | 'single' | 'multiple'
  /**
   * When true, the table is rendered as an ARIA grid (`role="grid"`), so each
   * data `<td>` carries `role="gridcell"`.
   * Defaults to false — the native `<table>` / `cell` semantics are preserved.
   */
  readonly gridRole?: boolean
  /**
   * Whether this grid answers the keyboard with a cell cursor. SEPARATE from
   * {@link gridRole}: the ARIA role decides what a cell reports itself as, and
   * this decides whether the keyboard can move between cells. Tying them
   * together turned every editable table into an ARIA grid, which unhooked
   * every assertion looking a cell up by its native role.
   */
  readonly navigable?: boolean
  /**
   * The cell CURSOR, as `(rowId, columnId)` — which single cell the keyboard
   * points at. Forwarded verbatim to the row context; see `grid-cursor.ts` for
   * why it is an id pair rather than a pair of indices.
   */
  readonly cursorRowId?: string
  readonly cursorColumnId?: string
  /** Whether the reader placed the cursor, or the grid merely holds its default tab stop. */
  readonly cursorPlaced?: boolean
  /** The cursor's Shift-extended rectangle, and the fill drag's span. See `data-row.tsx`. */
  readonly range?: CellRange
  readonly fillPreview?: CellRange
  readonly onFillDragStart?: (source: GridCursor) => void
  readonly onFillDown?: (source: GridCursor) => void
  readonly canFillFrom?: (cell: DataTableCell) => boolean
  readonly editingCell?: EditingCell
  readonly fieldMeta?: FieldMetaMap
  readonly tableName?: string
  readonly autoSave?: InlineAutoSave
  /** When set, renders the save status indicator inline inside the edited cell. */
  readonly inlineSaveStatus?: SaveStatus
  /** Schema-driven action fired on row click (e.g. navigate to detail). */
  readonly onRowClickAction?: DataTableRowClickAction
  readonly onCellDoubleClick?: (rowId: string | number, field: string, value: unknown) => void
  readonly onEditSave?: (newValue: unknown) => void
  readonly onEditCancel?: () => void
  /** Persists a single-gesture cell (checkbox / rating) without entering edit mode. */
  readonly onCellCommit?: CellCommit
  /**
   * Measured sticky offsets for the pinned (`frozen`) columns. A frozen column
   * pins its BODY cells too — otherwise the values scroll out from under their
   * own heading. See `frozen-columns.ts`.
   */
  readonly frozenOffsets?: FrozenOffsets
  /**
   * Field whose declared option colours fill each row, plus the resolved
   * `optionValue → #RRGGBB` map. Both absent on a grid declaring no
   * `rowColorField`, which leaves every row on today's striping/hover/selection.
   */
  readonly rowColorField?: string
  readonly rowColorFieldColors?: Readonly<Record<string, string>>
  /**
   * Group paths the reader has FLIPPED away from their level's declared fold
   * state, keyed by `groupPathKey`. Only consumed in the
   * grouped-rendering branch. With the usual default of `collapsed: false` the
   * set reads exactly as "collapsed"; see `group-body.ts`'s `isGroupCollapsed`.
   */
  readonly collapsedGroups?: ReadonlyArray<string>
  /**
   * Toggles a single group's fold state by its path key.
   * Only consumed in the grouped-rendering branch.
   */
  readonly onToggleGroupCollapsed?: (pathKey: string) => void
  /**
   * The grid's grouping levels — the primary one and any `thenBy` beneath it.
   * Its presence is what selects the grouped rendering strategy.
   */
  readonly groupBy?: ViewGroupBy
  /**
   * Whole-view record count per group PATH, computed over the same filtered
   * table the page is drawn from and returned by `?groupBy=`.
   *
   * The loaded rows CANNOT witness this: the grid pages server-side, so a group
   * holding 30 records contributes only the 22 of them that fit on the current
   * page. Counting the loaded rows therefore describes the page, never the view
   * — at every level, since a sub-group spans a page boundary exactly as its
   * parent does. Absent for a system source (no records API to ask), which falls
   * back to the loaded-row count.
   */
  readonly groupCounts?: Readonly<Record<string, number>>
  /**
   * The declared `summary` applied per group: the same items the footer renders,
   * answered over each group's whole-view rows. Absent when the grid declares no
   * summary, or when it is not grouped.
   */
  readonly groupSummary?: GroupSummaryContext
  /**
   * The trailing add-row's wiring — present exactly when the role may create
   * records here. It rides the SAME gate as the toolbar's create button, so a
   * role that cannot create sees neither: absent, not disabled.
   */
  readonly addRow?: AddRowConfig
}
