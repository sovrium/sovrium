/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import { kanbanCollisionDetection } from './collision-detection'
import { KanbanColumn } from './kanban-column'
import { useKanbanSensors } from './use-kanban-sensors'
import type { KanbanColumnData } from './group-records'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactElement } from 'react'

interface KanbanBoardProps {
  readonly columns: readonly KanbanColumnData[]
  readonly card: KanbanCard | undefined
  readonly emptyColumnMessage: string | undefined
  readonly draggableEnabled: boolean
  readonly onDragEnd: (event: DragEndEvent) => void
}

export function KanbanBoard({
  columns,
  card,
  emptyColumnMessage,
  draggableEnabled,
  onDragEnd,
}: KanbanBoardProps): ReactElement {
  const sensors = useKanbanSensors()
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragEnd={onDragEnd}
    >
      <div
        data-component="kanban"
        className="flex w-full gap-4 overflow-x-auto p-2"
      >
        {columns.map((column) => (
          <KanbanColumn
            key={column.value}
            column={column}
            emptyMessage={emptyColumnMessage}
            card={card}
            draggableEnabled={draggableEnabled}
          />
        ))}
      </div>
    </DndContext>
  )
}
