/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flexRender } from '@tanstack/react-table'
import { useCallback } from 'react'
import { substituteRecordVars } from '@/domain/models/app/pages/substitute-record-vars'
import {
  computeTableCellCursorClasses,
  computeTableFillHandleClasses,
  computeTableFillPreviewClasses,
  computeTableRowClasses,
} from '@/presentation/design/table-default-classes'
import { AiRefinementMarker } from '../runtime/ai-refinement-marker'
import { readAiRefinementStatus } from '../runtime/ai-refinement-status'
import { dispatch as dispatchIslandEvent } from '../runtime/event-bus'
import { stopClickPropagation } from './cell-click'
import { evaluateCellStyle } from './formatting'
import { FROZEN_CELL_CLASS, frozenCellStyle, type FrozenOffsets } from './frozen-columns'
import {
  editorOpener,
  isEditingThisCell,
  singleGestureControl,
  InlineEditor,
} from './inline-cell-editing'
import { useRowPaint } from './row-color'
import { rowIdOf } from './row-identity'
import type { CellMeta, DataRowContext } from './data-row-types'
import type { AiFieldRefinementStatus } from '../runtime/ai-refinement-status'
import type { DataTableCell, DataTableRow } from './island/table-features'
import type { CellRange, GridCursor } from './island/use-grid-cursor'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactElement, ReactNode } from 'react'

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

// ---------------------------------------------------------------------------
// Cell
// ---------------------------------------------------------------------------

/**
 * A frozen column pins its VALUES, not just its heading: the body cell takes the
 * same sticky offset its header wears, so the column still reads as ONE column
 * after a horizontal scroll. `undefined` for every unfrozen cell.
 */
function frozenPinStyle(
  meta: CellMeta,
  frozenOffsets: FrozenOffsets | undefined
): CSSProperties | undefined {
  if (meta?.frozen !== true) return undefined
  return frozenCellStyle(frozenOffsets?.[meta.field ?? ''] ?? 0)
}

/**
 * [internal ref] Phase 2: this cell's AI refinement status, or `undefined`.
 *
 * An AI-computed value whose refinement failed or is still running is otherwise
 * byte-identical to a refined one. The status is read off the ROW's `_aiCompute`
 * block, which only ever holds entries for AI-compute fields — so every other
 * cell in the grid pays a single property lookup and nothing more.
 */
const cellRefinementStatus = (
  cell: DataTableCell,
  meta: CellMeta
): AiFieldRefinementStatus | undefined =>
  meta?.field === undefined ? undefined : readAiRefinementStatus(cell.row.original, meta.field)

/**
 * R4: Enter / F2 open the editor from the keyboard, and must NOT also fire the
 * row action. The `target !== currentTarget` guard is what keeps an Enter
 * pressed INSIDE the open editor from re-entering edit mode.
 */
const cellKeyDownHandler =
  (openEditor: () => void) =>
  (e: React.KeyboardEvent<HTMLTableCellElement>): void => {
    if (e.target !== e.currentTarget) return
    if (e.key !== 'Enter' && e.key !== 'F2') return
    e.preventDefault()
    e.stopPropagation()
    openEditor()
  }

/**
 * The identity a cell's row answers to — the same expression the `<tr>` writes
 * into `data-row-id`, so the cursor and the DOM cannot disagree about which
 * row a cell belongs to.
 */
const cellRowId = (cell: DataTableCell): string => rowIdOf(cell.row)

/**
 * This cell's place in the roving tabindex, or `undefined` when the table is
 * not a grid and keeps its native focus behaviour.
 *
 * Every cell of a grid carries a tabindex: `0` for the cursor, `-1` for the
 * rest. That is what makes the whole grid ONE tab stop. Before this, every
 * editable cell carried `tabIndex: 0`, so a reader tabbing past a modest
 * twelve-by-six grid crossed seventy-odd stops to get to whatever followed it.
 *
 * `-1` rather than no attribute at all is the load-bearing half: it keeps each
 * cell focusable PROGRAMMATICALLY, which is how an arrow key moves the cursor.
 * Simply deleting the attribute would make the grid a single tab stop too, and
 * an unnavigable one.
 */
function cellTabIndex(
  navigable: boolean,
  isCursor: boolean,
  canOpenEditor: boolean
): number | undefined {
  if (navigable) return isCursor ? 0 : -1
  // Not a grid: preserve exactly what shipped before — an editable cell is
  // reachable by Tab, everything else is inert.
  return canOpenEditor ? 0 : undefined
}

/**
 * The cursor-related attributes of one `<td>`: its place in the roving
 * tabindex, whether it carries the cursor marker, and the column identity the
 * grid-level focus handler reads back.
 *
 * Assembled here rather than inline so `DataCell` stays a renderer. Returns an
 * empty object for a read-only table, which is what leaves the native `<table>`
 * semantics — and the focus behaviour that shipped before any of this — exactly
 * as they were.
 */
function cursorCellAttributes(
  cell: DataTableCell,
  ctx: DataRowContext,
  canOpenEditor: boolean
): { readonly attrs: Record<string, unknown>; readonly isCursor: boolean } {
  const navigable = ctx.navigable === true
  if (!navigable) {
    const tabIndex = cellTabIndex(false, false, canOpenEditor)
    return { isCursor: false, attrs: tabIndex === undefined ? {} : { tabIndex } }
  }
  const rowId = cellRowId(cell)
  const columnId = cell.column.id
  const isCursor = ctx.cursorRowId === rowId && ctx.cursorColumnId === columnId
  return {
    isCursor,
    attrs: {
      'data-col-id': columnId,
      tabIndex: cellTabIndex(true, isCursor, canOpenEditor),
      ...selectionMarkers(ctx, rowId, columnId, isCursor),
    },
  }
}

const rangeHas = (range: CellRange | undefined, rowId: string, columnId: string): boolean =>
  range !== undefined && range.rowIds.has(rowId) && range.columnIds.has(columnId)

/** The range and fill-preview markers of one cell in a navigable grid. */
function selectionMarkers(
  ctx: DataRowContext,
  rowId: string,
  columnId: string,
  isCursor: boolean
): Record<string, 'true'> {
  const inRange = isCursor || rangeHas(ctx.range, rowId, columnId)
  const inFillPreview = !isCursor && rangeHas(ctx.fillPreview, rowId, columnId)
  return {
    ...(inRange && { 'aria-selected': 'true' as const }),
    ...(inFillPreview && { 'data-fill-preview': 'true' as const }),
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
      title="Drag to fill"
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
 * The attributes of one `<td>` that do not depend on what it renders: its
 * ARIA role, its class, its pin, its field, and its cursor markers.
 */
function dataCellAttributes(params: {
  readonly ctx: DataRowContext
  readonly meta: CellMeta
  readonly conditionalClass: string
  readonly cursorAttrs: Record<string, unknown>
  readonly positioned: boolean
  readonly isCursor: boolean
}): Record<string, unknown> {
  const { ctx, meta, conditionalClass, cursorAttrs, positioned, isCursor } = params
  const pinStyle = frozenPinStyle(meta, ctx.frozenOffsets)
  // The handle is positioned against the cell. A pinned cell is already a
  // containing block (`position: sticky`), so only an unpinned one needs one.
  const positionClass = positioned && !pinStyle ? 'relative' : ''
  return {
    ...(ctx.gridRole && { role: 'gridcell' }),
    className: `${ctx.cellClass} ${ctx.borderClass} whitespace-nowrap ${conditionalClass} ${positionClass} ${pinStyle ? FROZEN_CELL_CLASS : ''} ${cellMarkerClass(cursorAttrs, isCursor)}`,
    ...(pinStyle && { style: pinStyle }),
    ...(meta?.field && { 'data-field': meta.field }),
    ...cursorAttrs,
  }
}

/**
 * The paint for the two cell states the keyboard grid MARKS.
 *
 * Both markers shipped without one: `aria-selected` and `data-fill-preview`
 * were set on the `<td>` and no rule in the compiled stylesheet answered
 * either, so a measured cursor cell computed `box-shadow: none`. The behaviour
 * landed without its affordance, and this is where the two meet again.
 *
 * They are mutually exclusive by construction — `selectionMarkers` never marks
 * the cursor as preview — so the two rings never compose into a 3px edge.
 */
function cellMarkerClass(cursorAttrs: Record<string, unknown>, isCursor: boolean): string {
  if (isCursor) return computeTableCellCursorClasses()
  if (cursorAttrs['data-fill-preview'] === 'true') return computeTableFillPreviewClasses()
  return ''
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
  const conditionalClass = meta?.cellStyle ? evaluateCellStyle(cell.getValue(), meta.cellStyle) : ''
  const { content, isEditable, onDoubleClick } = renderCellContent({ cell, meta, ctx })
  const refinement = cellRefinementStatus(cell, meta)

  const { attrs: cursorAttrs, isCursor } = cursorCellAttributes(
    cell,
    ctx,
    onDoubleClick !== undefined
  )
  const fillHandle = fillHandleFor(cell, ctx, isCursor)

  return (
    <td
      {...dataCellAttributes({
        ctx,
        meta,
        conditionalClass,
        cursorAttrs,
        positioned: fillHandle !== undefined,
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
 * Row-click `path` interpolation: `$record.<field>` tokens in the configured
 * path are substituted against the clicked row's data via the shared
 * `substituteRecordVars` helper (unknown / null fields collapse to an empty
 * string so a misconfigured path is still navigable rather than silently
 * retaining the literal `$record.id` token).
 */
function performRowAction(row: DataTableRow, ctx: DataRowContext): void {
  const action = ctx.onRowClickAction
  // Schema-driven onRowClick wins over single-select toggle when both are
  // configured; selection still works through the row checkbox column.
  if (action?.type === 'navigate') {
    const resolved = substituteRecordVars(action.path, row.original)
    if (typeof window !== 'undefined') window.location.assign(resolved)
    return
  }
  // PG-04: openDrawer dispatch — fire a `sovrium:open-drawer` CustomEvent for
  // the named drawer component. The drawer island listens for this event and
  // toggles its `open` state; the clicked row's record rides on
  // `detail.record` so future tiers can populate the drawer's child form.
  if (action?.type === 'openDrawer') {
    dispatchIslandEvent('sovrium:open-drawer', { id: action.component, record: row.original })
    return
  }
  if (ctx.selectionMode !== 'single') return
  // For single selection, deselect all others and toggle this row
  row.toggleSelected(!row.getIsSelected())
}

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
  const activate = () => performRowAction(row, ctx)

  // R3: a row carrying a row action is focusable and answers Enter. A
  // `<tr onClick>` is not focusable, so this affordance had NO keyboard route
  // at all before. The `target !== currentTarget` guard keeps an Enter pressed
  // inside a cell (or its open editor) from bubbling up and firing it too.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.target !== e.currentTarget || e.key !== 'Enter') return
    e.preventDefault()
    activate()
  }

  const selected = row.getIsSelected()
  const paint = useRowPaint(row.original, ctx.rowColorField, ctx.rowColorFieldColors, {
    selected,
    clickable: rowIsClickable,
  })

  return (
    <tr
      data-row-id={rowIdOf(row)}
      className={rowBackgroundClass(ctx, rowIndex, selected, paint.filled)}
      {...(selected && { 'aria-selected': 'true' as const })}
      {...(paint.style && { style: paint.style })}
      {...(rowIsClickable && { onClick: activate })}
      {...(paint.filled && {
        onMouseEnter: paint.onMouseEnter,
        onMouseLeave: paint.onMouseLeave,
      })}
      {...(hasRowAction && { tabIndex: 0, onKeyDown: handleKeyDown })}
    >
      {row.getVisibleCells().map((cell) => (
        <DataCell
          key={cell.id}
          cell={cell}
          ctx={ctx}
          suppressRowClick={rowIsClickable}
        />
      ))}
    </tr>
  )
}
