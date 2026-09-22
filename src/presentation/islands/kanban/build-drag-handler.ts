/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { arrayMove } from '@dnd-kit/sortable'
import {
  decodeCellDropId,
  decodeColumnDropId,
  isCellDropId,
  isColumnDropId,
} from './collision-detection'
import { persistKanbanDrop, showErrorToast } from './persist-drop'
import type { TableRecord } from '../runtime/types'
import type { KanbanDrag } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { DragEndEvent, UniqueIdentifier } from '@dnd-kit/core'

export interface KanbanDragHandlerParams {
  readonly localRecords: readonly TableRecord[]
  readonly setLocalRecords: (records: readonly TableRecord[]) => void
  readonly groupByField: string
  /**
   * The lane field, on a board declaring `swimlanes`. Absent on a single-axis
   * board, which is what keeps every drop there a one-field write.
   */
  readonly laneField: string | undefined
  readonly drag: KanbanDrag | undefined
  readonly tableName: string | undefined
  /**
   * Whether a settled drop may be WRITTEN BACK.
   *
   * `false` on a board bound to a read-only system source, where the move is
   * the reader's own view of the board and survives nothing. The optimistic
   * paint is the whole of the operation there — there is no request to revert
   * it, so there is no revert either.
   */
  readonly persist: boolean
}

/** Where a drop landed, read back as the field values that cell stands for. */
interface DropTarget {
  readonly column: string
  /** `undefined` on a single-axis board, and only there. */
  readonly lane: string | undefined
}

/** Two cells are the same when BOTH axes agree — one axis is not enough. */
function sameCell(a: DropTarget, b: DropTarget): boolean {
  return a.column === b.column && a.lane === b.lane
}

/** The record's own cell — the origin a drop is compared against. */
function cellOf(
  record: TableRecord,
  groupByField: string,
  laneField: string | undefined
): DropTarget {
  return {
    column: String(record[groupByField] ?? ''),
    lane: laneField === undefined ? undefined : String(record[laneField] ?? ''),
  }
}

/**
 * Compute the next records array for a within-cell reorder.
 *
 * Visual-only reorder. The collision detector resolves to the cell droppable
 * (not a card), so `over.id` doesn't carry a target card index — we infer
 * direction from `event.delta.y` (downward → end, upward → start). Coarse but
 * matches the spec contract (KANBAN-007 only asserts first/last swap when the
 * user drags from first onto last) and avoids tracking per-card rects.
 *
 * Returns `undefined` when no reorder should happen (movement too small,
 * record not found, or already in target position).
 */
interface ReorderInput {
  readonly localRecords: readonly TableRecord[]
  readonly inCell: (record: TableRecord) => boolean
  readonly activeId: string
  readonly deltaY: number
}

function reorderWithinCell(input: ReorderInput): readonly TableRecord[] | undefined {
  const { localRecords, inCell, activeId, deltaY } = input
  if (Math.abs(deltaY) < 4) return undefined
  const ids = localRecords.filter(inCell).map((r) => String(r['id'] ?? ''))
  const oldIndex = ids.indexOf(activeId)
  if (oldIndex < 0) return undefined
  const newIndex = deltaY > 0 ? ids.length - 1 : 0
  if (newIndex === oldIndex) return undefined
  const reorderedIds = arrayMove(ids, oldIndex, newIndex)
  const inCellRecords = reorderedIds
    .map((id) => localRecords.find((r) => String(r['id'] ?? '') === id))
    .filter((r): r is TableRecord => Boolean(r))
  const others = localRecords.filter((r) => !inCell(r))
  return [...inCellRecords, ...others]
}

/**
 * Optimistically apply a move across cells, write it back, and revert the local
 * state when the write fails.
 *
 * The write is unconditional: it used to be skipped outright whenever the board
 * declared no `drag` block, which — together with the `persistAction` gate that
 * used to sit inside `persistKanbanDrop` — is what made a drop paint and then
 * silently vanish on reload. `drag` now only supplies the override and the
 * failure toast, so it is passed through rather than gating.
 *
 * `updates` carries every axis the drop crossed and no more, so a lane move
 * leaves the column field alone and a diagonal move writes both in ONE request
 * — not a lane write that discards the column change, which is what a drop
 * handler built for one axis does when a second one is added under it.
 *
 * On a board that cannot persist, the local paint IS the move: the function
 * returns before the request rather than issuing one it would have to ignore.
 */
function moveToCell(
  params: KanbanDragHandlerParams,
  activeId: string,
  updates: Readonly<Record<string, string>>
): void {
  const { localRecords, setLocalRecords, drag, tableName, persist } = params
  const previous = localRecords
  const next = localRecords.map((r) =>
    String(r['id'] ?? '') === activeId ? { ...r, ...updates } : r
  )
  setLocalRecords(next)
  if (!persist) return
  void persistKanbanDrop({ drag, tableName: tableName ?? '' }, activeId, updates).then((result) => {
    if (!result.ok) {
      setLocalRecords(previous)
      showErrorToast(drag)
    }
  })
}

/**
 * Read a drop target off the droppable the pointer (or the keyboard) settled on.
 *
 * Three shapes reach here, and the third is why this is not a switch on the
 * prefix alone: a cell id names both axes, a column id names one and inherits
 * the other from where the card started, and a bare card id names neither — it
 * is read back off the record under the cursor, which is what makes a drop onto
 * another card equivalent to a drop onto the well around it.
 */
function resolveDropTarget(
  params: KanbanDragHandlerParams,
  overId: string,
  origin: DropTarget
): DropTarget | undefined {
  if (isCellDropId(overId)) {
    const cell = decodeCellDropId(overId)
    return cell ? { column: cell.column, lane: cell.lane } : undefined
  }
  if (isColumnDropId(overId)) {
    return { column: decodeColumnDropId(overId), lane: origin.lane }
  }
  const found = params.localRecords.find((r) => String(r['id'] ?? '') === overId)
  if (!found) return undefined
  return cellOf(found, params.groupByField, params.laneField)
}

/**
 * The fields a drop changed — one entry per axis crossed, none when the card
 * landed back in the cell it started from.
 */
function updatesFor(
  params: KanbanDragHandlerParams,
  origin: DropTarget,
  target: DropTarget
): Readonly<Record<string, string>> {
  const columnUpdate =
    target.column === origin.column ? {} : { [params.groupByField]: target.column }
  const { laneField } = params
  const laneUpdate =
    laneField === undefined || target.lane === undefined || target.lane === origin.lane
      ? {}
      : { [laneField]: target.lane }
  return { ...columnUpdate, ...laneUpdate }
}

/**
 * Build the drag-end handler for the kanban board.
 *
 * Extracted so the main island composition root stays small while keeping
 * the closure-captured state (`localRecords`, `setLocalRecords`) accessible
 * to all drag sub-operations (reorder within a cell, move across cells,
 * persist via API).
 *
 * The drop target arrives as a PARAMETER rather than being read off
 * `event.over`, because on a two-axis board the board settles it first — see
 * `settled-drop-target.tsx` for what `event.over` can be wrong about.
 */
export function buildKanbanDragHandler(
  params: KanbanDragHandlerParams
): (event: DragEndEvent, overId: UniqueIdentifier | undefined) => void {
  const { localRecords, setLocalRecords, groupByField, laneField } = params
  return (event: DragEndEvent, overId: UniqueIdentifier | undefined) => {
    const { active } = event
    if (overId === undefined || active.id === overId) return
    const activeId = String(active.id)
    const activeRecord = localRecords.find((r) => String(r['id'] ?? '') === activeId)
    if (!activeRecord) return
    const origin = cellOf(activeRecord, groupByField, laneField)
    const target = resolveDropTarget(params, String(overId), origin)
    if (!target?.column) return

    const updates = updatesFor(params, origin, target)
    if (Object.keys(updates).length > 0) {
      moveToCell(params, activeId, updates)
      return
    }
    const next = reorderWithinCell({
      localRecords,
      inCell: (r) => sameCell(cellOf(r, groupByField, laneField), origin),
      activeId,
      deltaY: event.delta?.y ?? 0,
    })
    if (next) setLocalRecords(next)
  }
}
