/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { coerceFieldValue, isComputedFieldType } from '../../runtime/field-value-coercion'
import { cursorOfCell, rectangleBetween, type GridCursor } from './use-grid-cursor'
import type { DataTableGridColumn, DataTableRow } from './table-features'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'
import type { CellCommit } from '../body'
import type { Dispatch, RefObject, SetStateAction } from 'react'

/**
 * The fill handle: the small square on the cursor's corner that copies its
 * value down (or across) a span of cells in one drag.
 *
 * Three decisions shape it.
 *
 * **Nothing is written until the mouse is released.** While the handle is
 * dragged the span is only MARKED (`data-fill-preview`), so an overshoot costs
 * nothing — the reader drags back, or lets go somewhere harmless. A preview
 * that wrote as it went would make every overshoot a batch of edits to undo.
 *
 * **Every destination cell is coerced by the ONE shared rule**
 * (`shared/field-value-coercion.ts`), per COLUMN. A drag from a text cell
 * across a numeric column is the case that decides whether a filled column
 * can be trusted: the numeric column is REFUSED AND NAMED — "Amount takes a
 * number" — while the text columns in the same drag still land. A silent skip
 * is what the paste import used to do, and a column of numbers that quietly
 * gained a word is precisely why that was not good enough.
 *
 * **A column that cannot take the write gets no handle.** Read-only columns,
 * computed ones, and any grid whose role cannot update — offering a handle
 * there means the reader learns of the refusal after the drag rather than
 * before it.
 *
 * The writes go through the same per-row save queue every inline edit uses,
 * so a fill declares the record version it read like any other write and is
 * refused, not merged, over someone else's concurrent change.
 */

/** A drag in progress: where it started and the cell the pointer is over. */
interface FillDrag {
  readonly source: GridCursor
  readonly focus: GridCursor
}

export interface FillHandleParams {
  readonly enabled: boolean
  readonly rows: readonly DataTableRow[]
  readonly leafColumns: readonly DataTableGridColumn[]
  /** Row identities in render order — the axis a drag travels along. */
  readonly rowIds: readonly string[]
  /** Visible column identities in render order. */
  readonly columnIds: readonly string[]
  readonly fieldMeta: FieldMetaMap | undefined
  /** The display name a refusal names the column by. */
  readonly labelOf: (field: string) => string
  readonly onCellCommit: CellCommit | undefined
}

const rowIdOf = (row: DataTableRow): string => String(row.original.id ?? row.id)

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

/**
 * Whether a cell in this column may be the SOURCE of a fill — the condition
 * under which the handle is drawn on it at all.
 */
export function canFillFrom(
  column: DataTableGridColumn | undefined,
  fieldMeta: FieldMetaMap | undefined
): boolean {
  const meta = column?.columnDef.meta
  const field = meta?.field
  if (meta?.editable !== true || field === undefined) return false
  return !isComputedFieldType(fieldMeta?.[field]?.type)
}

/**
 * The rows a double-click fills: from the row under the source down to the
 * last row that has a value in the neighbouring column — the nearest data
 * column to the LEFT, as in a spreadsheet, else the nearest to the right, else
 * the whole column.
 */
function fillDownTargets(source: GridCursor, params: FillHandleParams): readonly string[] {
  const { rows, leafColumns, rowIds, columnIds } = params
  const sourceIndex = rowIds.indexOf(source.rowId)
  if (sourceIndex < 0) return []
  const columnIndex = columnIds.indexOf(source.columnId)
  const dataColumns = leafColumns.filter((column) => column.columnDef.meta?.field !== undefined)
  const neighbour =
    dataColumns.findLast((column) => columnIds.indexOf(column.id) < columnIndex) ??
    dataColumns.find((column) => columnIds.indexOf(column.id) > columnIndex)
  const neighbourField = neighbour?.columnDef.meta?.field
  const lastIndex =
    neighbourField === undefined
      ? rowIds.length - 1
      : rows.reduce(
          (last, row, index) =>
            isBlank((row.original as Record<string, unknown>)[neighbourField]) ? last : index,
          -1
        )
  return rowIds.slice(sourceIndex + 1, lastIndex + 1)
}

/** One drag's outcome: the writes it issued, and the columns it had to refuse. */
function commitFill(
  source: GridCursor,
  targetRowIds: readonly string[],
  targetColumnIds: readonly string[],
  params: FillHandleParams
): readonly string[] {
  const { rows, leafColumns, fieldMeta, labelOf, onCellCommit } = params
  const sourceColumn = leafColumns.find((column) => column.id === source.columnId)
  const sourceField = sourceColumn?.columnDef.meta?.field
  const sourceRow = rows.find((row) => rowIdOf(row) === source.rowId)
  if (sourceField === undefined || sourceRow === undefined || onCellCommit === undefined) return []
  const sourceValue = (sourceRow.original as Record<string, unknown>)[sourceField]

  return targetColumnIds.flatMap((columnId) => {
    const column = leafColumns.find((candidate) => candidate.id === columnId)
    const field = column?.columnDef.meta?.field
    // A read-only or computed column in the middle of a drag is SKIPPED, not
    // refused: the reader did not ask to write it, the drag merely crossed it.
    if (field === undefined || !canFillFrom(column, fieldMeta)) return []
    const coerced = coerceFieldValue(sourceValue, fieldMeta?.[field]?.type, labelOf(field))
    if (!coerced.ok) return [coerced.reason]
    targetRowIds
      .filter((rowId) => rowId !== source.rowId || columnId !== source.columnId)
      .forEach((rowId) => void onCellCommit(rowId, field, coerced.value))
    return []
  })
}

/**
 * The document listeners a drag needs, bound for exactly as long as one is in
 * progress. They read the latest grid and span through refs rather than
 * through the closure they were created in, because the drag outlives it.
 */
function useFillDragListeners(params: {
  readonly active: boolean
  readonly dragRef: RefObject<FillDrag | undefined>
  readonly paramsRef: RefObject<FillHandleParams>
  readonly setDrag: Dispatch<SetStateAction<FillDrag | undefined>>
  readonly finish: (
    source: GridCursor,
    rowIds: readonly string[],
    columnIds: readonly string[]
  ) => void
}): void {
  const { active, dragRef, paramsRef, setDrag, finish } = params
  useEffect(() => {
    if (!active) return undefined
    const handleMove = (event: MouseEvent): void => {
      const cell = (event.target as HTMLElement | null)?.closest<HTMLTableCellElement>(
        'td[data-col-id]'
      )
      const focus = cell ? cursorOfCell(cell) : undefined
      if (focus === undefined) return
      setDrag((current) =>
        current === undefined ||
        (current.focus.rowId === focus.rowId && current.focus.columnId === focus.columnId)
          ? current
          : { ...current, focus }
      )
    }
    const handleUp = (): void => {
      const { current } = dragRef
      setDrag(undefined)
      if (current === undefined) return
      const { rowIds, columnIds } = paramsRef.current
      const span = rectangleBetween(current.source, current.focus, rowIds, columnIds)
      if (span !== undefined) finish(current.source, [...span.rowIds], [...span.columnIds])
    }
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }
  }, [active, dragRef, paramsRef, setDrag, finish])
}

export function useFillHandle(params: FillHandleParams) {
  const [drag, setDrag] = useState<FillDrag | undefined>(undefined)
  const [refusals, setRefusals] = useState<readonly string[]>([])
  const paramsRef = useRef(params)
  // eslint-disable-next-line functional/immutable-data -- ref write: the listeners read the grid of the latest render
  paramsRef.current = params
  const dragRef = useRef<FillDrag | undefined>(drag)
  // eslint-disable-next-line functional/immutable-data -- ref write: mouseup reads the span as of the last move
  dragRef.current = drag

  const finish = useCallback(
    (source: GridCursor, rowIds: readonly string[], columnIds: readonly string[]): void => {
      setRefusals([...new Set(commitFill(source, rowIds, columnIds, paramsRef.current))])
    },
    []
  )

  useFillDragListeners({ active: drag !== undefined, dragRef, paramsRef, setDrag, finish })

  const startDrag = useCallback((source: GridCursor): void => {
    setRefusals([])
    setDrag({ source, focus: source })
  }, [])

  const fillDown = useCallback(
    (source: GridCursor): void => {
      finish(source, fillDownTargets(source, paramsRef.current), [source.columnId])
    },
    [finish]
  )

  const dismissRefusals = useCallback((): void => setRefusals([]), [])

  return {
    enabled: params.enabled && params.onCellCommit !== undefined,
    preview:
      drag === undefined
        ? undefined
        : rectangleBetween(drag.source, drag.focus, params.rowIds, params.columnIds),
    startDrag,
    fillDown,
    refusals,
    dismissRefusals,
  }
}
