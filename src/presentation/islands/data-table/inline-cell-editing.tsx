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
import { optionValue } from '@/domain/models/app/tables/select-option'
import { lockedOnRecord, nextValuesOf } from '@/presentation/design/locks-verdict'
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
  record,
  ctx,
}: {
  readonly value: unknown
  readonly field: string
  readonly rowId: string | number | undefined
  /** The row's record, whose `_locks` narrows a transition field's choices. */
  readonly record: Readonly<Record<string, unknown>>
  readonly ctx: DataRowContext
}): ReactElement {
  const { autoSave } = ctx
  return (
    <div className="flex items-center gap-1">
      <EditableCell
        value={value}
        fieldMeta={offeredMeta(ctx.fieldMeta?.[field], record, field)}
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

/**
 * The field's meta with its options narrowed, when a transition rule moves it,
 * to the value the record holds and the values it may move to (`_locks.next`).
 */
function offeredMeta(
  meta: FieldMeta | undefined,
  record: Readonly<Record<string, unknown>>,
  field: string
): FieldMeta | undefined {
  const next = nextValuesOf(record, field)
  if (meta?.options === undefined || next === undefined) return meta
  const current = String(record[field] ?? '')
  const options = meta.options.filter((option) => {
    const value = optionValue(option)
    return value === current || next.includes(value)
  })
  return { ...meta, options }
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
  if (writableField(cell, meta) === undefined) return undefined
  if (field === undefined || rowId === undefined || !onCellDoubleClick) return undefined
  return () => onCellDoubleClick(rowId, field, cell.getValue())
}

/**
 * The field of a declared-editable cell its record lets change — `undefined`
 * when the column is not editable, or a lock rule holds the field on the
 * record (`_locks`).
 */
function writableField(cell: DataTableCell, meta: CellMeta): string | undefined {
  const field = meta?.field
  if (meta?.editable !== true || field === undefined) return undefined
  const record = cell.row.original as Record<string, unknown>
  return lockedOnRecord(record, field) === undefined ? field : undefined
}

/**
 * Whether a lock rule keeps this editable cell's field from changing on its
 * record (`_locks`): the cell then opens no editor and reads as read-only.
 */
export function cellLocked(cell: DataTableCell, meta: CellMeta): boolean {
  return meta?.editable === true && meta.field !== undefined && !writableField(cell, meta)
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
  const field = writableField(cell, meta)
  const rowId = cell.row.original.id as string | number | undefined
  const fieldMeta = field ? ctx.fieldMeta?.[field] : undefined
  if (!field || rowId === undefined || !ctx.onCellCommit) return undefined
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
