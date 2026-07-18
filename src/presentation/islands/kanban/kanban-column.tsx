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

function ColumnHeader({ column }: { readonly column: KanbanColumnData }): ReactElement {
  return (
    <div className="border-border flex items-center justify-between border-b pb-2">
      <div className="flex items-center gap-2">
        {column.color ? (
          <span
            className="inline-block size-3 shrink-0 rounded-full"
            data-column-accent
            style={{ backgroundColor: column.color }}
            aria-hidden="true"
          />
        ) : undefined}
        <h3 className="text-foreground text-sm font-semibold">{column.value}</h3>
      </div>
      <span
        className="bg-background-subtle text-foreground rounded-full px-2 py-0.5 text-xs font-medium"
        aria-label={`${column.records.length} records`}
      >
        {column.records.length}
      </span>
    </div>
  )
}

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
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(column.value) })

  const recordIds = column.records.map((r) => String(r['id'] ?? ''))

  return (
    <div
      ref={setNodeRef}
      data-column={column.value}
      className={`flex w-72 shrink-0 flex-col gap-2 rounded-lg border ${
        isOver ? 'border-primary bg-primary-subtle' : 'border-border bg-background-subtle'
      } p-3 transition-colors`}
    >
      <ColumnHeader column={column} />
      <SortableContext
        items={recordIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[2.5rem] flex-col gap-2">
          {column.records.length === 0 ? (
            <div className="border-border bg-background-raised text-foreground-muted rounded border border-dashed px-3 py-4 text-center text-xs">
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
