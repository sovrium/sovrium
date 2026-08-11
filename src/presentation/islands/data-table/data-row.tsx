/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { flexRender, type Cell, type Row } from '@tanstack/react-table'
import { useCallback } from 'react'
import { substituteRecordVars } from '@/domain/utils/substitute-record-vars'
import { dispatch as dispatchIslandEvent } from '../_shared/event-bus'
import { AiRefinementMarker } from '../shared/ai-refinement-marker'
import { readAiRefinementStatus } from '../shared/ai-refinement-status'
import { stopClickPropagation } from './cell-click'
import { EditableCell } from './editable-cell'
import { isSingleGestureWidget } from './editors/editor-contract'
import { CheckboxCellControl, RatingCellControl } from './editors/single-gesture-cells'
import { evaluateCellStyle } from './formatting'
import { frozenCellStyle, type FrozenOffsets } from './frozen-columns'
import { useRowPaint } from './row-color'
import { SaveStatusIndicator } from './save-status-indicator'
import type {
  EditingCell,
  FieldMeta,
  FieldMetaMap,
  FieldWriteValue,
  SaveStatus,
} from '../hooks/use-inline-editing'
import type { AiFieldRefinementStatus } from '../shared/ai-refinement-status'
import type { TableRecord } from '../shared/types'
import type { CellStyleCondition } from '@/domain/models/app/pages/components/component-types/data/data-table/schema'
import type { CSSProperties, ReactElement, ReactNode } from 'react'

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
  readonly onTabNext: (rowId: string | number, currentField: string, newValue: unknown) => void
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

type CellMeta =
  | {
      field?: string
      editable?: boolean
      frozen?: boolean
      cellStyle?: readonly CellStyleCondition[]
    }
  | undefined

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

// ---------------------------------------------------------------------------
// Cell content
// ---------------------------------------------------------------------------

function isEditingThisCell(
  editingCell: EditingCell | undefined,
  field: string | undefined,
  rowId: string | number | undefined
): boolean {
  return Boolean(
    editingCell &&
    field &&
    rowId !== undefined &&
    editingCell.rowId === rowId &&
    editingCell.field === field
  )
}

/** The open inline editor, plus its optional save-status companion. */
function InlineEditor({
  value,
  field,
  rowId,
  ctx,
}: {
  readonly value: unknown
  readonly field: string
  readonly rowId: string | number | undefined
  readonly ctx: DataRowContext
}): ReactElement {
  const { autoSave } = ctx
  return (
    <div className="flex items-center gap-1">
      <EditableCell
        value={value}
        fieldMeta={ctx.fieldMeta?.[field]}
        onSave={ctx.onEditSave!}
        onCancel={ctx.onEditCancel!}
        tableName={ctx.tableName}
        recordId={rowId}
        fieldName={field}
        autoSave={Boolean(autoSave?.enabled)}
        autoSaveDebounceMs={autoSave?.debounceMs}
        saveOnBlur={autoSave?.saveOnBlur === true}
        {...(autoSave && {
          onAutoSave: autoSave.onAutoSave,
          onTrackValue: autoSave.onTrackValue,
          onTabNext: (newValue: unknown) =>
            rowId !== undefined && autoSave.onTabNext(rowId, field, newValue),
        })}
      />
      {ctx.inlineSaveStatus && <SaveStatusIndicator status={ctx.inlineSaveStatus} />}
    </div>
  )
}

/**
 * The callback that puts this cell into edit mode, or `undefined` when the cell
 * cannot be edited at all (not declared editable, no addressable row, or no
 * editing wiring supplied).
 */
function editorOpener(
  cell: Cell<TableRecord, unknown>,
  meta: CellMeta,
  ctx: DataRowContext
): (() => void) | undefined {
  const field = meta?.field
  const rowId = cell.row.original.id as string | number | undefined
  const { onCellDoubleClick } = ctx
  if (meta?.editable !== true) return undefined
  if (field === undefined || rowId === undefined || !onCellDoubleClick) return undefined
  return () => onCellDoubleClick(rowId, field, cell.getValue())
}

/**
 * Resolves what a `<td>` renders, plus the two facts its container needs:
 *
 * - `isEditable` — whether the cell OWNS pointer/keyboard interaction. True for
 *   a declared-editable cell AND for one already in edit mode, so a click
 *   landing inside an open editor cannot fall through to the row action.
 * - `onDoubleClick` — present only when the editor can still be OPENED, so a
 *   cell already editing does not re-enter edit mode.
 */
/**
 * The live control an editable `checkbox` / `rating` cell renders INSTEAD of a
 * picture of its value, or `undefined` when this cell is not one of them.
 *
 * These commit on a single click, so the cell never enters edit mode: there is
 * no editor to open, and therefore no double-click to open it with. Returning
 * `undefined` for everything else keeps the read path unchanged for every other
 * field type.
 */
function singleGestureControl(
  cell: Cell<TableRecord, unknown>,
  meta: CellMeta,
  ctx: DataRowContext
): ReactNode | undefined {
  const field = meta?.field
  const rowId = cell.row.original.id as string | number | undefined
  const fieldMeta = field ? ctx.fieldMeta?.[field] : undefined
  if (meta?.editable !== true || !field || rowId === undefined || !ctx.onCellCommit)
    return undefined
  if (!isSingleGestureWidget(fieldMeta)) return undefined

  return (
    <SingleGestureCell
      value={cell.getValue()}
      field={field}
      rowId={rowId}
      fieldMeta={fieldMeta}
      onCellCommit={ctx.onCellCommit}
    />
  )
}

/** The live control itself, so the resolver above stays a resolver. */
function SingleGestureCell({
  value,
  field,
  rowId,
  fieldMeta,
  onCellCommit,
}: {
  readonly value: unknown
  readonly field: string
  readonly rowId: string | number
  readonly fieldMeta: FieldMeta | undefined
  readonly onCellCommit: CellCommit
}): ReactElement {
  const commit = useCallback(
    (next: FieldWriteValue): void => void onCellCommit(rowId, field, next),
    [onCellCommit, rowId, field]
  )

  return fieldMeta?.type === 'rating' ? (
    <RatingCellControl
      value={value}
      label={field}
      fieldMeta={fieldMeta}
      commit={commit}
    />
  ) : (
    <CheckboxCellControl
      value={value}
      label={field}
      commit={commit}
    />
  )
}

function renderCellContent({
  cell,
  meta,
  ctx,
}: {
  readonly cell: Cell<TableRecord, unknown>
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
  cell: Cell<TableRecord, unknown>,
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
 * One data `<td>`.
 *
 * Coexistence of inline editing and a row action is discriminated by TARGET,
 * never by timing: a click that lands in an EDITABLE cell belongs to the cell
 * (R1) and is stopped here, while every other cell keeps whole-row click (R2).
 * A timing discriminator (swallow the first click, wait for a possible second)
 * was rejected — it taxes every row click to serve the minority case and is
 * nondeterministic under test.
 */
function DataCell({
  cell,
  ctx,
  suppressRowClick,
}: {
  readonly cell: Cell<TableRecord, unknown>
  readonly ctx: DataRowContext
  /**
   * True when this row answers a click at all — from a row action OR from
   * single-row selection — and an editable cell may therefore pre-empt it.
   *
   * This used to be `hasRowAction` alone, while the row was made clickable by
   * `hasRowAction || selectionMode === 'single'`. The two conditions disagreed
   * on exactly one case: a single-selection grid with no `onRowClick`, where a
   * click inside an editable cell still toggled row selection. That was
   * survivable while every editor needed a double-click to open — and stopped
   * being survivable the moment a checkbox committed on one click, because
   * ticking it would also have selected its row.
   */
  readonly suppressRowClick: boolean
}): ReactElement {
  const meta = cell.column.columnDef.meta as CellMeta
  const conditionalClass = meta?.cellStyle ? evaluateCellStyle(cell.getValue(), meta.cellStyle) : ''
  const { content, isEditable, onDoubleClick } = renderCellContent({ cell, meta, ctx })
  const pinStyle = frozenPinStyle(meta, ctx.frozenOffsets)
  const refinement = cellRefinementStatus(cell, meta)

  return (
    <td
      {...(ctx.gridRole && { role: 'gridcell' })}
      className={`${ctx.cellClass} ${ctx.borderClass} whitespace-nowrap ${conditionalClass}`}
      {...(pinStyle && { style: pinStyle })}
      {...(meta?.field && { 'data-field': meta.field })}
      {...(suppressRowClick && isEditable && { onClick: stopClickPropagation })}
      {...(onDoubleClick && {
        onDoubleClick,
        tabIndex: 0,
        onKeyDown: cellKeyDownHandler(onDoubleClick),
      })}
    >
      {content}
      <AiRefinementMarker
        status={refinement}
        placement="tooltip"
      />
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
function performRowAction(row: Row<TableRecord>, ctx: DataRowContext): void {
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
  if (filled) return 'transition-colors'
  return `hover:bg-background-subtle transition-colors ${
    ctx.striped && rowIndex % 2 === 1 ? 'bg-background-subtle' : ''
  } ${selected ? 'bg-primary-subtle' : ''}`
}

export function DataRow({
  row,
  rowIndex,
  ctx,
}: {
  readonly row: Row<TableRecord>
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
      data-row-id={String(row.original.id ?? row.id)}
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
