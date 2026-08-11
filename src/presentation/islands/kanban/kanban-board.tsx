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
  /** `optionValue → #RRGGBB` declared on the field `card.colorField` names. */
  readonly colorFieldColors: Readonly<Record<string, string>> | undefined
}

/**
 * Renders the kanban board's `<DndContext>` shell and column list.
 *
 * Extracted from `KanbanIsland` so the composition root stays a thin
 * wrapper around state hooks; this component owns the dnd-kit sensors
 * and the column iteration only.
 */
export function KanbanBoard({
  columns,
  card,
  emptyColumnMessage,
  draggableEnabled,
  onDragEnd,
  colorFieldColors,
}: KanbanBoardProps): ReactElement {
  const sensors = useKanbanSensors()
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragEnd={onDragEnd}
    >
      {/*
       * The `data-component="kanban"` marker lives on the SSR island wrapper
       * (island-data-components.tsx) — the single, always-present component
       * element. The mounted board must NOT duplicate it, or `[data-component=
       * "kanban"]` resolves to two nodes and any non-`.first()` board-level
       * assertion (e.g. toContainText) trips Playwright's strict mode.
       */}
      <div className="flex w-full gap-4 overflow-x-auto p-2">
        {columns.map((column) => (
          <KanbanColumn
            key={column.value}
            column={column}
            emptyMessage={emptyColumnMessage}
            card={card}
            draggableEnabled={draggableEnabled}
            colorFieldColors={colorFieldColors}
          />
        ))}
      </div>
    </DndContext>
  )
}
