/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, type RefObject } from 'react'
import { resolveEditableFields } from './island-setup-helpers'
import { resolveTabTarget } from './tab-target'
import { resolveAddRow } from './table-add-row-columns'
import { canFillFrom, useFillHandle } from './use-fill-handle'
import { useGridCursor } from './use-grid-cursor'
import type { EditingCell, FieldMetaMap } from '../../hooks/use-inline-editing'
import type { InlineAutoSave } from '../body'
import type { TableContentProps } from './table-content-types'
import type { DataTableCell, DataTableGridColumn, DataTableRow } from './table-features'
import type { DataTableColumn } from '@/domain/models/app/pages/components/component-types/data/table/schema'

/**
 * How the grid answers the keyboard and the pointer: its ARIA role, whether
 * it is navigable, the cursor-aware edit and tab handlers, the column labels
 * its announcements read, and the attributes the `<table>` carries for them.
 */

/**
 * The `<table>` body of the data-table island: header + rows + (optional)
 * summary footer. Extracted from the orchestrator to keep its statement
 * count under the size-limits cap; renders unchanged from the inline form.
 */
/**
 * Resolve the table's ARIA semantics.
 *
 * A table is a GRID when it is an interactive widget — when the author
 * declared a column editable, so the keyboard moves a cell cursor through it
 * — or when it was given an accessible name (the dashboard record-drawer
 * surface, which relies on `getByRole('grid', { name })`). Either way a
 * read-only system-source directory opts out with `useGridRole: false` and
 * keeps the native `<table>` role plus its accessible name.
 *
 * The role does not hang on the accessible name: having a name says nothing
 * about being an interactive widget, and an editable grid nobody named is
 * still a grid. `aria-label` is emitted only when one is configured.
 *
 * A `<td>` inside a `role="grid"` computes as `gridcell`, and the table itself
 * no longer answers to `table`, so surfaces look a cell up by the `data-*`
 * attributes the grid emits rather than by its native role. Gating on the
 * AUTHORED `editable: true` rather than the permission-derived default keeps
 * every grid that merely permits updates reporting its native roles.
 */
export function resolveTableAria(
  ariaLabel: string | undefined,
  useGridRole: boolean | undefined,
  navigable: boolean
): { readonly hasAriaLabel: boolean; readonly gridRole: boolean } {
  const hasAriaLabel = ariaLabel !== undefined && ariaLabel.length > 0
  return { hasAriaLabel, gridRole: (hasAriaLabel || navigable) && useGridRole !== false }
}

/**
 * Whether this grid answers the keyboard with a cell CURSOR: the author
 * declared at least one column editable, and it is not a read-only
 * system-source directory.
 *
 * It does not require a configured `ariaLabel`: an accessible NAME says
 * nothing about being an interactive widget, and an editable grid nobody named
 * still gets its cell cursor.
 *
 * It reads the authored `columns[]`, NOT the resolved column meta, and the
 * distinction is the whole reason this function exists rather than being one
 * line at the call site. `editable` defaults "from table permissions", so the
 * RESOLVED flag is true for any grid whose table merely permits updates —
 * which is most of them. Keying on it turned tables into grids wholesale, and
 * `role="grid"` makes every `<td>` compute as `gridcell` rather than `cell`:
 * two shipped specs went looking for `getByRole('cell')` and `getByRole('table')`
 * and found neither. An explicit `editable: true` is a statement that this
 * grid is for editing in; a permission is not.
 */
export const isNavigableGrid = (
  columns: readonly DataTableColumn[] | undefined,
  useGridRole: boolean | undefined
): boolean =>
  useGridRole !== false &&
  // `in` rather than a property read: an action column is part of the same
  // union and carries no `editable` at all.
  columns?.some((column) => 'editable' in column && column.editable === true) === true

/**
 * The edit handlers, wrapped so that leaving an editor leaves the CURSOR
 * somewhere sensible.
 *
 * Enter commits and drops the cursor one row, ready for the next value in the
 * same column; Escape cancels and leaves it exactly where the reader left it.
 * Neither leaves focus on `document.body`, where the next keystroke would
 * scroll the document instead of moving the cursor.
 */
function useCursorAwareEditHandlers(
  onEditSave: (newValue: unknown) => Promise<void>,
  onEditCancel: () => void,
  cursor: ReturnType<typeof useGridCursor>,
  editingCell: EditingCell | undefined
) {
  const { advanceCursorRow, returnFocusToCursor } = cursor
  const editingRowId = editingCell === undefined ? undefined : String(editingCell.rowId)
  const handleEditSave = useCallback(
    async (newValue: unknown): Promise<void> => {
      // The cursor moves FIRST, before the write is awaited.
      //
      // Waiting for the round trip would make every Enter cost a network
      // latency before the next cell could be typed into — which is the whole
      // gesture this exists to make fast, and on a slow link it reads as the
      // grid having ignored the keystroke. The write still happens, and still
      // reports its own failure through the save indicator and the error
      // banner; what does not happen is the cursor holding still while it
      // completes.
      //
      // Anchored on the row being EDITED, not on the current cursor, so the
      // move is idempotent — see `advanceCursorRow`.
      if (editingRowId !== undefined) advanceCursorRow(editingRowId)
      await onEditSave(newValue)
    },
    [onEditSave, advanceCursorRow, editingRowId]
  )
  const handleEditCancel = useCallback((): void => {
    onEditCancel()
    returnFocusToCursor()
  }, [onEditCancel, returnFocusToCursor])
  return { handleEditSave, handleEditCancel }
}

/**
 * The Tab wiring, wrapped so the CURSOR moves to the destination cell the
 * moment Tab is pressed.
 *
 * The editor itself follows only once the commit has landed (see
 * `use-inline-save-wiring.ts`), which is right for the editor — opening one
 * over a value that has not been written yet is how a Tab-then-Escape loses a
 * keystroke — but wrong for focus: until the round trip returns, focus would
 * sit in the editor of the cell the reader has just LEFT, and a reader who
 * types straight on lands their keystrokes in the old cell. Moving the cursor
 * first is the same decision Enter makes in {@link useCursorAwareEditHandlers}.
 *
 * The destination is resolved with the SAME `resolveTabTarget` the wiring
 * uses, so the cursor and the editor cannot disagree about where Tab went.
 */
function useCursorAwareTabNext(
  autoSave: InlineAutoSave | undefined,
  cursor: ReturnType<typeof useGridCursor>,
  columnConfig: readonly DataTableColumn[] | undefined,
  leafColumns: readonly DataTableGridColumn[]
): InlineAutoSave | undefined {
  const { moveCursorTo, rowIds } = cursor
  const editableFields = useMemo(() => resolveEditableFields(columnConfig), [columnConfig])
  return useMemo(() => {
    if (autoSave === undefined) return undefined
    const onTabNext: InlineAutoSave['onTabNext'] = (rowId, currentField, newValue, direction) => {
      const target = resolveTabTarget({
        rowIds,
        editableFields,
        from: { rowId: String(rowId), field: currentField },
        direction,
      })
      const column = leafColumns.find(
        (candidate) => candidate.columnDef.meta?.field === target?.field
      )
      if (target !== undefined && column !== undefined) {
        moveCursorTo({ rowId: target.rowId, columnId: column.id })
      }
      autoSave.onTabNext(rowId, currentField, newValue, direction)
    }
    return { ...autoSave, onTabNext }
  }, [autoSave, rowIds, editableFields, leafColumns, moveCursorTo])
}

/**
 * The `<table>` element's ARIA and keyboard attributes.
 *
 * A read-only table gets none of them and renders exactly as it always has —
 * which is what keeps `role="grid"` from spreading to surfaces that are not
 * interactive widgets.
 */
export function gridAttributes(params: {
  readonly gridRole: boolean
  readonly navigable: boolean
  readonly hasAriaLabel: boolean
  readonly ariaLabel: string | undefined
  readonly rows: readonly DataTableRow[]
  readonly cursor: ReturnType<typeof useGridCursor>
}): Record<string, unknown> {
  const { gridRole, navigable, hasAriaLabel, ariaLabel, rows, cursor } = params
  return {
    ...(gridRole && { role: 'grid' }),
    ...(hasAriaLabel && { 'aria-label': ariaLabel }),
    // `aria-rowcount` is a grid property, so it rides with the grid ROLE. The
    // header row counts: it describes the whole grid, and a screen reader
    // announces the header as row 1.
    ...(gridRole && { 'aria-rowcount': rows.length + 1 }),
    // The listeners ride with NAVIGABILITY. `data-navigable` is what the
    // DOM-driven clipboard hook reads to know the cursor owns Shift-selection.
    ...(navigable && {
      'data-navigable': 'true',
      onKeyDown: cursor.handleKeyDown,
      onMouseDown: cursor.handleMouseDown,
      onFocus: cursor.handleFocus,
    }),
  }
}

/**
 * The display name a column goes by in a message to the reader — the authored
 * `label`, else the field's declared label, else the field name itself.
 */
function columnLabelResolver(
  columnConfig: readonly DataTableColumn[] | undefined,
  fieldMeta: FieldMetaMap | undefined
): (field: string) => string {
  return (field) => {
    const authored = columnConfig?.find(
      (column): column is Extract<DataTableColumn, { field: string }> =>
        'field' in column && column.field === field
    )
    return authored?.label ?? fieldMeta?.[field]?.label ?? field
  }
}

/**
 * The cursor, the fill handle and the cursor-aware edit handlers of one grid,
 * all of which hang off the same `<table>` ref and the same row model.
 */
export function useGridInteractions(
  props: TableContentProps,
  tableRef: RefObject<HTMLTableElement | null>,
  navigable: boolean
) {
  const { table, fieldMeta } = props
  const { rows } = table.getRowModel()
  const leafColumns = table.getVisibleLeafColumns()
  const labelOf = columnLabelResolver(props.columnConfig, fieldMeta)
  // prettier-ignore
  const cursor = useGridCursor({ tableRef, enabled: navigable, rows, leafColumns, editingCell: props.editingCell })
  // prettier-ignore
  const fill = useFillHandle({ enabled: navigable, rows, leafColumns, rowIds: cursor.rowIds, columnIds: cursor.columnIds, fieldMeta, labelOf, onCellCommit: props.onCellCommit })
  const addRow = resolveAddRow(props, leafColumns, labelOf)
  const canFillFromCell = useCallback(
    (cell: DataTableCell): boolean => canFillFrom(cell.column, fieldMeta),
    [fieldMeta]
  )
  const editHandlers = useCursorAwareEditHandlers(
    props.onEditSave,
    props.onEditCancel,
    cursor,
    props.editingCell
  )
  const autoSave = useCursorAwareTabNext(props.autoSave, cursor, props.columnConfig, leafColumns)
  return { rows, cursor, fill, canFillFromCell, autoSave, addRow, ...editHandlers }
}
