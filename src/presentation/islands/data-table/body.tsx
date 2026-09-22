/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableBodyClasses,
  computeTableEmptyStateClasses,
  computeTableSkeletonBarClasses,
} from '@/presentation/design/table-default-classes'
import { AddRow, type AddRowConfig } from './add-row'
import {
  DataRow,
  type DataRowContext,
  type DataTableRowClickAction,
  type CellCommit,
  type InlineAutoSave,
} from './data-row'
import { GroupedTableBodyRows } from './group-body'
import { rowIdOf } from './row-identity'
import type { FrozenOffsets } from './frozen-columns'
import type { GroupSummaryContext } from './group-summary'
import type { EditingCell, FieldMetaMap, SaveStatus } from '../hooks/use-inline-editing'
import type { DataTableCell, DataTableColumnDef, DataTableRow } from './island/table-features'
import type { CellRange, GridCursor } from './island/use-grid-cursor'
import type { DataTableGroupBy } from '@/domain/models/app/pages/components/component-types/data/table/schema'
import type { ReactElement } from 'react'

// Re-export the table header (now in body-header.tsx) so the existing
// `import { TableHeader } from '../body'` path in table-content.tsx stays stable.
export { TableHeader } from './body-header'

// Re-export the row-level public types (now in data-row.tsx, alongside the
// single row renderer that owns them) so the existing
// `import type { DataTableRowClickAction, InlineAutoSave } from '../body'`
// path in table-content.tsx stays stable.
export type { CellCommit, DataTableRowClickAction, InlineAutoSave } from './data-row'

interface TableBodyRowsProps {
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
  readonly groupBy?: DataTableGroupBy
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

/**
 * The widths a skeleton bar cycles through, column by column.
 *
 * A placeholder has to read as TEXT of differing lengths; a run of identical
 * bars reads as a grid of blocks, which is not what the arriving content will
 * look like. The design calls for 70 / 50 / 40 / 45 %, and these are the
 * nearest fraction utilities (75 / 50 / 40 / 41.7 %) — a rounding worth taking
 * to stay off arbitrary values, since those numbers encode "visibly unequal"
 * rather than any measured relationship.
 */
const SKELETON_BAR_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/5', 'w-5/12'] as const

/**
 * Renders loading skeleton rows
 */
function SkeletonRows({
  allColumns,
  cellClass,
}: {
  readonly allColumns: readonly DataTableColumnDef[]
  readonly cellClass: string
}): ReactElement {
  return (
    <tbody
      className={computeTableBodyClasses()}
      aria-hidden="true"
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <tr
          key={`skeleton-${String(i)}`}
          data-skeleton-row="true"
          // Loading placeholders are inert: marking them `pointer-events: none`
          // keeps a click that lands during the records-fetch window from
          // resolving against a content-less skeleton `<tr>` (which carries no
          // `onRowClick` handler). Without this, a row click fired before the
          // real rows mount was silently dropped — the schema-driven
          // `onRowClick.path` navigation never ran. With pointer events
          // disabled the click waits for a real, clickable data row.
          className="pointer-events-none"
        >
          {allColumns.map((_, j) => (
            <td
              key={`skeleton-cell-${String(j)}`}
              className={cellClass}
            >
              <div
                className={`${computeTableSkeletonBarClasses()} ${SKELETON_BAR_WIDTHS[j % SKELETON_BAR_WIDTHS.length]}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

/**
 * Renders the table body: loading skeletons, data rows, or empty state.
 *
 * Row-click `path` interpolation: `$record.<field>` tokens in the configured
 * path are substituted against the clicked row's data via the shared
 * `substituteRecordVars` helper (unknown / null fields collapse to an empty
 * string so a misconfigured path is still navigable rather than silently
 * retaining the literal `$record.id` token).
 */
export function TableBodyRows({
  rows,
  allColumns,
  isLoading,
  cellClass,
  borderClass,
  striped,
  emptyMessage,
  noMatchMessage,
  globalFilter,
  selectionMode,
  gridRole,
  navigable,
  cursorRowId,
  cursorColumnId,
  cursorPlaced,
  range,
  fillPreview,
  onFillDragStart,
  onFillDown,
  canFillFrom,
  editingCell,
  fieldMeta,
  tableName,
  autoSave,
  inlineSaveStatus,
  onRowClickAction,
  onCellDoubleClick,
  onEditSave,
  onEditCancel,
  onCellCommit,
  frozenOffsets,
  rowColorField,
  rowColorFieldColors,
  collapsedGroups,
  onToggleGroupCollapsed,
  groupBy,
  groupCounts,
  groupSummary,
  addRow,
}: TableBodyRowsProps): ReactElement {
  if (isLoading) {
    return (
      <SkeletonRows
        allColumns={allColumns}
        cellClass={cellClass}
      />
    )
  }

  if (rows.length === 0) {
    // No-match status: a search reduced the grid to zero rows. Render the
    // query-echoing `noMatchMessage` in an `aria-live` `role="status"` region
    // (the correct, dynamic use of a polite live region — the result of typing
    // is announced), DISTINCT from the zero-record empty state. A `{query}`
    // token echoes the active search string.
    //
    // The ACTIVE SEARCH is the whole test, deliberately: search runs server-side,
    // so a non-matching term comes back as an empty page and the loaded rows can
    // no longer witness whether the underlying dataset has records. Of the two
    // messages, only "nothing matched what you typed" is provably true in that
    // state — claiming "there is nothing here yet" would assert something this
    // grid never asked the server. When no search is active (or no
    // `noMatchMessage` is configured), the plain `emptyMessage` cell stands — no
    // `role="status"`, fully backward compatible.
    const query = globalFilter ?? ''
    if (query.trim().length > 0 && noMatchMessage !== undefined) {
      const resolved = noMatchMessage.replace(/\{query\}/g, query)
      return (
        <tbody className={computeTableBodyClasses()}>
          <tr>
            <td
              colSpan={allColumns.length}
              className={computeTableEmptyStateClasses()}
            >
              <div
                role="status"
                aria-live="polite"
              >
                {resolved}
              </div>
            </td>
          </tr>
          {addRow && <AddRow config={addRow} />}
        </tbody>
      )
    }
    // The trailing add-row exists on an EMPTY table too: it is how the first
    // record gets in without opening a dialog.
    return (
      <tbody className={computeTableBodyClasses()}>
        <tr>
          <td
            colSpan={allColumns.length}
            className={computeTableEmptyStateClasses()}
          >
            {emptyMessage}
          </td>
        </tr>
        {addRow && <AddRow config={addRow} />}
      </tbody>
    )
  }

  // Assembled ONCE and shared by both rendering strategies. Grouping is a
  // rendering strategy, not a feature switch: the grouped branch used to get a
  // hand-picked subset of these and silently lost inline editing and the row
  // action as a result.
  const ctx: DataRowContext = {
    cellClass,
    borderClass,
    striped,
    selectionMode,
    gridRole,
    navigable,
    cursorRowId,
    cursorColumnId,
    cursorPlaced,
    range,
    fillPreview,
    onFillDragStart,
    onFillDown,
    canFillFrom,
    editingCell,
    fieldMeta,
    tableName,
    autoSave,
    inlineSaveStatus,
    onRowClickAction,
    onCellDoubleClick,
    onEditSave,
    onEditCancel,
    onCellCommit,
    frozenOffsets,
    rowColorField,
    rowColorFieldColors,
  }

  // A declared (or runtime-selected) `groupBy` switches the rendering strategy.
  if (groupBy) {
    return (
      <GroupedTableBodyRows
        rows={rows}
        groupBy={groupBy}
        allColumns={allColumns}
        borderClass={borderClass}
        ctx={ctx}
        // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- `collapsedGroups ?? []` returns the prop ref unchanged when defined; the empty-fallback path only fires when no group has been collapsed yet
        collapsedGroups={collapsedGroups ?? []}
        {...(onToggleGroupCollapsed && { onToggleGroupCollapsed })}
        {...(groupCounts && { groupCounts })}
        {...(fieldMeta && { fieldMeta })}
        {...(groupSummary && { groupSummary })}
        {...(addRow && { addRow })}
      />
    )
  }

  // Keyed by RECORD identity, not by `row.id`.
  //
  // No `getRowId` is configured, so TanStack's `row.id` is the row's
  // INDEX — and React reconciles by key. A re-read that returns the same
  // records in a different order (the records API moves a just-updated
  // row, so any inline edit does exactly this) therefore left every `<tr>`
  // and `<td>` node where it was and rewrote its CONTENTS. Anything
  // attached to a node rather than to a record went with the position
  // instead of the record: focus most visibly — the cell cursor ended up
  // one row from where it was put — but an open editor the same way.
  // Keying by the record makes React MOVE the node, so the cursor stays
  // on the record the reader was working on.
  return (
    <tbody className={computeTableBodyClasses()}>
      {rows.map((row, rowIndex) => (
        <DataRow
          key={rowIdOf(row)}
          row={row}
          rowIndex={rowIndex}
          ctx={ctx}
        />
      ))}
      {addRow && <AddRow config={addRow} />}
    </tbody>
  )
}

// ---------------------------------------------------------------------------
// Summary footer
// ---------------------------------------------------------------------------

// Re-export the summary footer (now in body-summary.tsx) so the existing
// `import { TableSummaryFooter } from '../body'` path in table-content.tsx
// stays stable.
export { TableSummaryFooter } from './body-summary'
