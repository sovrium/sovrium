/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { arrayMove } from '@dnd-kit/sortable'
import { decodeColumnDropId, isColumnDropId } from './collision-detection'
import { persistKanbanDrop, showErrorToast } from './persist-drop'
import type { TableRecord } from '../shared/types'
import type { KanbanDrag } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { DragEndEvent } from '@dnd-kit/core'

export interface KanbanDragHandlerParams {
  readonly localRecords: readonly TableRecord[]
  readonly setLocalRecords: (records: readonly TableRecord[]) => void
  readonly groupByField: string
  readonly drag: KanbanDrag | undefined
  readonly tableName: string | undefined
}

interface ReorderInput {
  readonly localRecords: readonly TableRecord[]
  readonly groupByField: string
  readonly activeId: string
  readonly sourceColumn: string
  readonly deltaY: number
}

function reorderWithinColumn(input: ReorderInput): readonly TableRecord[] | undefined {
  const { localRecords, groupByField, activeId, sourceColumn, deltaY } = input
  if (Math.abs(deltaY) < 4) return undefined
  const ids = localRecords
    .filter((r) => String(r[groupByField] ?? '') === sourceColumn)
    .map((r) => String(r['id'] ?? ''))
  const oldIndex = ids.indexOf(activeId)
  if (oldIndex < 0) return undefined
  const newIndex = deltaY > 0 ? ids.length - 1 : 0
  if (newIndex === oldIndex) return undefined
  const reorderedIds = arrayMove(ids, oldIndex, newIndex)
  const inColumnRecords = reorderedIds
    .map((id) => localRecords.find((r) => String(r['id'] ?? '') === id))
    .filter((r): r is TableRecord => Boolean(r))
  const others = localRecords.filter((r) => String(r[groupByField] ?? '') !== sourceColumn)
  return [...inColumnRecords, ...others]
}

function moveAcrossColumns(
  params: KanbanDragHandlerParams,
  activeId: string,
  targetColumn: string
): void {
  const { localRecords, setLocalRecords, groupByField, drag, tableName } = params
  const previous = localRecords
  const next = localRecords.map((r) =>
    String(r['id'] ?? '') === activeId ? { ...r, [groupByField]: targetColumn } : r
  )
  setLocalRecords(next)
  if (!drag) return
  void persistKanbanDrop(
    { drag, groupByField, tableName: tableName ?? '' },
    activeId,
    targetColumn
  ).then((result) => {
    if (!result.ok) {
      setLocalRecords(previous)
      showErrorToast(drag)
    }
  })
}

function resolveTargetColumn(
  localRecords: readonly TableRecord[],
  groupByField: string,
  overId: string
): string {
  if (isColumnDropId(overId)) return decodeColumnDropId(overId)
  const found = localRecords.find((r) => String(r['id'] ?? '') === overId)
  return String(found?.[groupByField] ?? '')
}

export function buildKanbanDragHandler(
  params: KanbanDragHandlerParams
): (event: DragEndEvent) => void {
  const { localRecords, setLocalRecords, groupByField } = params
  return (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const activeRecord = localRecords.find((r) => String(r['id'] ?? '') === activeId)
    if (!activeRecord) return
    const sourceColumn = String(activeRecord[groupByField] ?? '')
    const targetColumn = resolveTargetColumn(localRecords, groupByField, String(over.id))
    if (!targetColumn) return
    if (sourceColumn === targetColumn) {
      const next = reorderWithinColumn({
        localRecords,
        groupByField,
        activeId,
        sourceColumn,
        deltaY: event.delta?.y ?? 0,
      })
      if (next) setLocalRecords(next)
    } else {
      moveAcrossColumns(params, activeId, targetColumn)
    }
  }
}
