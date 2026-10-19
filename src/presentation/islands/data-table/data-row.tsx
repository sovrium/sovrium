/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flexRender } from '@tanstack/react-table'
import { useCallback } from 'react'
import {
  computeTableFillHandleClasses,
  computeTableRowClasses,
} from '@/presentation/design/table-default-classes'
import { AiRefinementMarker } from '../runtime/ai-refinement-marker'
import { useRowMarkers } from './account-sessions'
import { clickLandsOnInnerControl, stopClickPropagation } from './cell-click'
import { cellPresentation } from './column-presentation'
import {
  cellRefinementStatus,
  cellKeyDownHandler,
  cellRowId,
  cursorCellAttributes,
  dataCellAttributes,
} from './data-cell-attributes'
import {
  editorOpener,
  isEditingThisCell,
  singleGestureControl,
  InlineEditor,
} from './inline-cell-editing'
import { useGridString } from './island/grid-strings'
import { performRowAction } from './row-action'
import { useRowPaint } from './row-color'
import type { CellMeta, DataRowContext } from './data-row-types'
import type { GridCursor } from './island/grid-cursor-model'
import type { DataTableCell, DataTableRow } from './island/table-features'
import type { MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from 'react'

export type {
  CellCommit,
  DataRowContext,
  DataTableRowClickAction,
  InlineAutoSave,
} from './data-row-types'

/**
 * THE single data-row renderer. Both the flat body and the grouped body render
 * rows through here.
 *
 * They used to have one renderer each, and the two drifted: the grouped copy
 * called `flexRender` directly instead of going through {@link renderCellContent}
 * (so grouping silently deleted inline editing), carried a `handleRowClick` that
 * only toggled selection (so grouping silently deleted `onRowClick`), and never
 * emitted `data-row-id`. Grouping is a RENDERING STRATEGY, not a feature switch —
 * keeping one renderer is what makes that true by construction rather than by
 * remembering to patch both.
 */

// ---------------------------------------------------------------------------
// Cell content
// ---------------------------------------------------------------------------

function renderCellContent({
  cell,
  meta,
  ctx,
}: {
  readonly cell: DataTableCell
  readonly meta: CellMeta
  readonly ctx: DataRowContext
}): { content: ReactNode; isEditable: boolean; onDoubleClick?: () => void } {
  const field = meta?.field
  const rowId = cell.row.original.id as string | number | undefined
  const { editingCell } = ctx

  // Single-gesture controls are checked FIRST: they own the cell outright, and
  // a double-click on one must not also open a text editor over the top of it.
  const singleGesture = singleGestureControl(cell, meta, ctx)
  if (singleGesture !== undefined) {
    return { content: singleGesture, isEditable: true }
  }

  if (isEditingThisCell(editingCell, field, rowId) && field && ctx.onEditSave && ctx.onEditCancel) {
    return {
      isEditable: true,
      content: (
        <InlineEditor
          value={editingCell!.value}
          field={field}
          rowId={rowId}
          ctx={ctx}
        />
      ),
    }
  }

  const openEditor = editorOpener(cell, meta, ctx)
  return {
    content: flexRender(cell.column.columnDef.cell, cell.getContext()),
    isEditable: openEditor !== undefined,
    ...(openEditor && { onDoubleClick: openEditor }),
  }
}

/**
 * The fill handle: the square on the cursor's bottom-right corner.
 *
 * Its own gestures are stopped from reaching the cell beneath it. A mousedown
 * that bubbled would move the cursor; a double-click that bubbled would open
 * the editor over a fill the reader had just asked for.
 */
function FillHandle({
  rowId,
  columnId,
  onDragStart,
  onFillDown,
}: {
  readonly rowId: string
  readonly columnId: string
  readonly onDragStart: (source: GridCursor) => void
  readonly onFillDown: (source: GridCursor) => void
}): ReactElement {
  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLSpanElement>): void => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      onDragStart({ rowId, columnId })
    },
    [onDragStart, rowId, columnId]
  )
  const handleDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLSpanElement>): void => {
      event.preventDefault()
      event.stopPropagation()
      onFillDown({ rowId, columnId })
    },
    [onFillDown, rowId, columnId]
  )
  return (
    <span
      data-fill-handle="true"
      aria-hidden="true"
      title={useGridString('datatable.fillHandle', 'Drag to fill')}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onClick={stopClickPropagation}
      className={computeTableFillHandleClasses()}
    />
  )
}

/**
 * The handle for this cell, or nothing: only the cursor carries one, and only
 * when its column can be written — a read-only or computed column offers no
 * handle rather than a refusal after the drag.
 */
function fillHandleFor(
  cell: DataTableCell,
  ctx: DataRowContext,
  isCursor: boolean
): ReactElement | undefined {
  const { onFillDragStart, onFillDown, canFillFrom, cursorPlaced } = ctx
  if (!isCursor || cursorPlaced !== true) return undefined
  if (!onFillDragStart || !onFillDown || !canFillFrom?.(cell)) return undefined
  return (
    <FillHandle
      rowId={cellRowId(cell)}
      columnId={cell.column.id}
      onDragStart={onFillDragStart}
      onFillDown={onFillDown}
    />
  )
}

/**
 * One data `<td>`.
 *
 * Coexistence of inline editing and a row action is discriminated by TARGET,
 * never by timing: a click that lands in an EDITABLE cell belongs to the cell
 * (R1) and is stopped here, while every other cell keeps whole-row click (R2).
 * A timing discriminator (swallow the first click, wait for a possible second)
 * was rejected — it taxes every row click to serve the minority case and is
 * nondeterministic under test.
 *
 * The ACTION cluster is the same rule one column over (R6), and the worse half
 * of it: those cells are not a place a reader might type, they are buttons, and
 * a row navigation that swallowed them turned every Ban, Archive and Delete
 * into a silent drill-down with no confirm ever armed. A button is a more
 * specific target than the row that contains it, so it claims its own clicks
 * exactly as the editable cell and the selection checkbox already do.
 *
 * `data-col-id` carries the column's identity so the grid-level focus handler
 * can map a focused `<td>` back to a cursor without knowing anything about the
 * React tree it came from. `data-field` cannot serve: the generated columns
 * (selection checkbox, row number, action cluster) have no field, and the
 * cursor has to be able to sit on them.
 *
 * `aria-selected` on the CELL announces the cursor. The identically-named
 * attribute on `<tr>` means the row was ticked — a different axis, and both
 * can be true at once.
 *
 * `suppressRowClick` is true when this row answers a click at all — from a row
 * action OR from single-row selection — and a cell holding its own controls may
 * therefore pre-empt it. It used to be `hasRowAction` alone, while the row was
 * made clickable by `hasRowAction || selectionMode === 'single'`. The two
 * conditions disagreed on exactly one case: a single-selection grid with no
 * `onRowClick`, where a click inside an editable cell still toggled row
 * selection. That was survivable while every editor needed a double-click to
 * open — and stopped being survivable the moment a checkbox committed on one
 * click, because ticking it would also have selected its row.
 */
function DataCell({
  cell,
  ctx,
  suppressRowClick,
}: {
  readonly cell: DataTableCell
  readonly ctx: DataRowContext
  readonly suppressRowClick: boolean
}): ReactElement {
  const { meta } = cell.column.columnDef
  const presentation = cellPresentation(meta, cell.getValue())
  const { content, isEditable, onDoubleClick } = renderCellContent({ cell, meta, ctx })
  const refinement = cellRefinementStatus(cell, meta)

  const { attrs: cursorAttrs, isCursor } = cursorCellAttributes(
    cell,
    ctx,
    onDoubleClick !== undefined
  )
  const fillHandle = fillHandleFor(cell, ctx, isCursor)
  // An open text editor is laid OVER the cell, so the cell is its containing block.
  const rowId = cell.row.original.id as string | number | undefined
  const editing = isEditingThisCell(ctx.editingCell, meta?.field, rowId)

  return (
    <td
      data-slot="table-cell"
      {...dataCellAttributes({
        ctx,
        meta,
        presentation,
        cursorAttrs,
        positioned: fillHandle !== undefined || editing,
        isCursor,
      })}
      {...(suppressRowClick &&
        (isEditable || meta?.actions === true) && { onClick: stopClickPropagation })}
      {...(onDoubleClick && {
        onDoubleClick,
        onKeyDown: cellKeyDownHandler(onDoubleClick),
      })}
    >
      {content}
      <AiRefinementMarker
        status={refinement}
        placement="tooltip"
      />
      {fillHandle}
    </td>
  )
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

/**
 * The row's background utilities.
 *
 * Striping, hover and selection have always been ONE channel here — three plain
 * background utilities on the same element, with no ordering guarantee between
 * them. That is survivable while the row has no other claim on its background,
 * and stops being survivable the moment an app author fills it.
 *
 * So a FILLED row keeps only the transition: its background is the author's
 * datum (A7 ruling 1 — record data may carry colour, chrome stays out of its
 * way), its chrome moves to the `box-shadow` channel in {@link buildRowStyle},
 * and `striped` is suppressed because two competing fills on one row are
 * unreadable.
 *
 * An UNFILLED row — including an empty-valued row inside a grid that declares
 * `rowColorField`, and every grid that declares none — returns the exact string
 * it has always returned. The scoping is per ROW, not per grid.
 */
function rowBackgroundClass(
  ctx: DataRowContext,
  rowIndex: number,
  selected: boolean,
  filled: boolean
): string {
  // ONE axis, with a stated precedence, where three utilities used to compete
  // on the same element with no ordering guarantee between them: the author's
  // own hue outranks everything, then selection (which the reader just
  // performed and needs to see), then striping (a passive reading aid).
  if (filled) return computeTableRowClasses({ state: 'filled' })
  if (selected) return computeTableRowClasses({ state: 'selected' })
  const striped = ctx.striped && rowIndex % 2 === 1
  return computeTableRowClasses({ state: striped ? 'striped' : 'default' })
}

export function DataRow({
  row,
  rowIndex,
  ctx,
}: {
  readonly row: DataTableRow
  readonly rowIndex: number
  readonly ctx: DataRowContext
}): ReactElement {
  const hasRowAction = ctx.onRowClickAction !== undefined
  const rowIsClickable = hasRowAction || ctx.selectionMode === 'single'
  const activate = (target?: Element) => performRowAction(row, ctx, target)

  // R3: a row carrying a row action is focusable and answers Enter (a bare
  // `<tr onClick>` has no keyboard route). The `target !== currentTarget` guard
  // keeps an Enter inside a cell (or its open editor) from firing it too.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.target !== e.currentTarget || e.key !== 'Enter') return
    e.preventDefault()
    activate(e.currentTarget)
  }

  const selected = row.getIsSelected()
  const markers = useRowMarkers(row)
  const paint = useRowPaint(row.original, ctx.rowColorField, ctx.rowColorFieldColors, {
    selected,
    clickable: rowIsClickable,
  })

  return (
    <tr
      data-slot="table-row"
      {...markers}
      className={rowBackgroundClass(ctx, rowIndex, selected, paint.filled)}
      {...(selected && { 'aria-selected': 'true' as const })}
      {...(paint.style && { style: paint.style })}
      {...(rowIsClickable && {
        onClick: (e) => {
          if (!clickLandsOnInnerControl(e)) activate(e.currentTarget)
        },
      })}
      {...(paint.filled && {
        onMouseEnter: paint.onMouseEnter,
        onMouseLeave: paint.onMouseLeave,
      })}
      {...(hasRowAction && { tabIndex: 0, onKeyDown: handleKeyDown })}
    >
      {/* By column: `cell.id` holds the row INDEX, so a moved record remounted its cells. */}
      {row.getVisibleCells().map((cell) => (
        <DataCell
          key={cell.column.id}
          cell={cell}
          ctx={ctx}
          suppressRowClick={rowIsClickable}
        />
      ))}
    </tr>
  )
}
