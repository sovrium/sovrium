/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeTableBodyClasses,
  computeTableEmptyStateClasses,
} from '@/presentation/design/table-default-classes'
import { AddRow } from './add-row'
import { DataRow, type DataRowContext } from './data-row'
import { GroupedTableBodyRows } from './group-body'
import { rowIdOf } from './row-identity'
import { SkeletonRows } from './skeleton-rows'
import type { TableBodyRowsProps } from './body-rows-props'
import type { ReactElement } from 'react'

// Re-export the table header (now in body-header.tsx) so the existing
// `import { TableHeader } from '../body'` path in table-content.tsx stays stable.
export { TableHeader } from './body-header'

// Re-export the row-level public types (now in data-row.tsx, alongside the
// single row renderer that owns them) so the existing
// `import type { DataTableRowClickAction, InlineAutoSave } from '../body'`
// path in table-content.tsx stays stable.
export type { CellCommit, DataTableRowClickAction, InlineAutoSave } from './data-row'

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
