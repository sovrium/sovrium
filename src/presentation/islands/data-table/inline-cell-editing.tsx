/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-refresh/only-export-components -- InlineEditor and
   SingleGestureCell are SSR/island-internal React components co-located with
   the three predicates that decide WHEN each is rendered
   (`isEditingThisCell`, `editorOpener`, `singleGestureControl`). The last two
   return JSX, so they cannot move to a `.ts` sibling, and separating a
   predicate from the component it selects would split one decision across two
   files. These never participate in client-side HMR. Mirrors the same
   directive in `render/forms/form-renderer.tsx`. */

import { useCallback } from 'react'
import { EditableCell } from './editable-cell'
import { isSingleGestureWidget } from './editors/editor-contract'
import { CheckboxCellControl, RatingCellControl } from './editors/single-gesture-cells'
import { SaveStatusIndicator } from './save-status-indicator'
import type { CellCommit, CellMeta, DataRowContext } from './data-row-types'
import type { EditingCell, FieldMeta, FieldWriteValue } from '../hooks/use-inline-editing'
import type { TabDirection } from './island/tab-target'
import type { DataTableCell } from './island/table-features'
import type { ReactElement, ReactNode } from 'react'

/** The open inline editor, plus its optional save-status companion. */
export function InlineEditor({
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
          onTabNext: (newValue: unknown, direction: TabDirection) =>
            rowId !== undefined && autoSave.onTabNext(rowId, field, newValue, direction),
        })}
      />
      {ctx.inlineSaveStatus && <SaveStatusIndicator status={ctx.inlineSaveStatus} />}
    </div>
  )
}

/** The live control itself, so the resolver above stays a resolver. */
export function SingleGestureCell({
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

export function isEditingThisCell(
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

/**
 * The callback that puts this cell into edit mode, or `undefined` when the cell
 * cannot be edited at all (not declared editable, no addressable row, or no
 * editing wiring supplied).
 */
export function editorOpener(
  cell: DataTableCell,
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
export function singleGestureControl(
  cell: DataTableCell,
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
