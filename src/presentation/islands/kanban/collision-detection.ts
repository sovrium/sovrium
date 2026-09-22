/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core'

/** Column droppable id prefix to disambiguate from card IDs in onDragEnd. */
export const COLUMN_DROP_PREFIX = 'kanban-column:'

/**
 * Cell droppable id prefix — a two-axis board's (lane, column) intersection.
 *
 * A SEPARATE prefix rather than a longer column id, because the two boards drop
 * into different shapes and the handler has to tell them apart: a column id
 * names one field to write, a cell id names two. A single-axis board keeps
 * emitting {@link COLUMN_DROP_PREFIX} untouched.
 */
export const CELL_DROP_PREFIX = 'kanban-cell:'

export function isColumnDropId(id: string | number): boolean {
  return typeof id === 'string' && id.startsWith(COLUMN_DROP_PREFIX)
}

export function isCellDropId(id: string | number): boolean {
  return typeof id === 'string' && id.startsWith(CELL_DROP_PREFIX)
}

/** Every droppable the board registers — a column on one axis, a cell on two. */
export function isKanbanDropId(id: string | number): boolean {
  return isColumnDropId(id) || isCellDropId(id)
}

export function columnDropId(value: string): string {
  return `${COLUMN_DROP_PREFIX}${value}`
}

export function decodeColumnDropId(id: string): string {
  return id.slice(COLUMN_DROP_PREFIX.length)
}

export interface KanbanCellTarget {
  readonly lane: string
  readonly column: string
}

/**
 * Encode a cell's two field values into one droppable id.
 *
 * JSON rather than a `lane::column` join: both halves are AUTHOR data — a
 * select option's label, which may legitimately contain any separator anyone
 * would pick — so a delimiter scheme is a bug waiting for the option named
 * `Done::Archived`. `JSON.stringify` of a pair round-trips every string there
 * is, and the ids are internal to the drag, never asserted on.
 */
export function cellDropId(target: KanbanCellTarget): string {
  return `${CELL_DROP_PREFIX}${JSON.stringify([target.lane, target.column])}`
}

export function decodeCellDropId(id: string): KanbanCellTarget | undefined {
  try {
    const parsed: unknown = JSON.parse(id.slice(CELL_DROP_PREFIX.length))
    if (!Array.isArray(parsed) || parsed.length !== 2) return undefined
    const [lane, column] = parsed as readonly unknown[]
    if (typeof lane !== 'string' || typeof column !== 'string') return undefined
    return { lane, column }
  } catch {
    return undefined
  }
}

/**
 * Custom collision detection — board drop targets only (columns, or the
 * (lane, column) cells of a two-axis board).
 *
 * `useSortable` registers each card as a droppable, but if cards are in
 * the candidate set @dnd-kit's pointer-down on a clickable card can
 * register an over-target during the synchronous click sequence, which
 * suppresses the card's `onClick` navigation contract
 *. Restricting candidates to column droppables
 * keeps `over.id` as a column ID in every case; within-column reorder
 * computes the target index from `event.delta.y`
 * in the drag-end handler instead of relying on a card-level over target.
 */
export const kanbanCollisionDetection: CollisionDetection = (args) => {
  const { active, droppableContainers } = args
  const columnsOnly = droppableContainers.filter((c) => c.id !== active.id && isKanbanDropId(c.id))
  const columnArgs = { ...args, droppableContainers: columnsOnly }

  const pointer = pointerWithin(columnArgs)
  if (pointer.length) return pointer

  const intersection = rectIntersection(columnArgs)
  if (intersection.length) return intersection

  return closestCenter(columnArgs)
}
