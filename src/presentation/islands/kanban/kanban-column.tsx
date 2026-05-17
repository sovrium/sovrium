/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { columnDropId } from './collision-detection'
import { KanbanCardView } from './kanban-card-view'
import type { KanbanColumnData } from './group-records'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactElement } from 'react'

export function KanbanColumn({
  column,
  emptyMessage,
  card,
  draggableEnabled,
}: {
  readonly column: KanbanColumnData
  readonly emptyMessage?: string
  readonly card?: KanbanCard
  readonly draggableEnabled: boolean
}): ReactElement {
  // Make the column itself a droppable target so dragging onto an empty
  // column (or onto its background, not over a card) still resolves to a
  // valid drop target.
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(column.value) })

  const recordIds = column.records.map((r) => String(r['id'] ?? ''))

  return (
    <div
      ref={setNodeRef}
      data-column={column.value}
      className={`flex w-72 shrink-0 flex-col gap-2 rounded-lg border ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'
      } p-3 transition-colors`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <h3 className="text-sm font-semibold text-gray-700">{column.value}</h3>
        <span
          className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700"
          aria-label={`${column.records.length} records`}
        >
          {column.records.length}
        </span>
      </div>
      <SortableContext
        items={recordIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[2.5rem] flex-col gap-2">
          {column.records.length === 0 ? (
            <div className="rounded border border-dashed border-gray-300 bg-white px-3 py-4 text-center text-xs text-gray-500">
              {emptyMessage ?? 'No records'}
            </div>
          ) : (
            column.records.map((record) => (
              <KanbanCardView
                key={String(record.id ?? JSON.stringify(record))}
                record={record}
                card={card}
                draggableEnabled={draggableEnabled}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}
