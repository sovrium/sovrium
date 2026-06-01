/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { buildCsvExportHref, buildJsonExportHref, type ActiveFilter } from './export-helpers'
import type { TableRecord } from '../../shared/types'
import type { Column, useReactTable } from '@tanstack/react-table'
import type { CSSProperties } from 'react'

function toSortableStyle(
  transform: Parameters<typeof CSS.Transform.toString>[0],
  transition: string | undefined,
  isDragging: boolean
): CSSProperties {
  return {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
}

function makeColumnDragEndHandler(
  items: readonly string[],
  table: ReturnType<typeof useReactTable<TableRecord>>
): (event: DragEndEvent) => void {
  return (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.indexOf(String(active.id))
    const newIndex = items.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    table.setColumnOrder(arrayMove([...items], oldIndex, newIndex))
  }
}

function toMutableIds(ids: readonly string[]): string[] {
  return [...ids]
}


function SortableColumnRow({ column }: { readonly column: Column<TableRecord, unknown> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  })

  const style = toSortableStyle(transform, transition, isDragging)

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-field={column.id}
      data-testid={`column-item-${column.id}`}
      className="hover:bg-background-subtle flex items-center gap-2 px-2 py-1 text-sm"
    >
      <span
        {...attributes}
        {...listeners}
        data-drag-handle
        data-testid={`drag-handle-${column.id}`}
        className="text-text-muted cursor-grab px-1 select-none active:cursor-grabbing"
        aria-label={`Reorder ${column.id}`}
        role="button"
        tabIndex={0}
      >
        ::
      </span>
      <label className="flex flex-1 cursor-pointer items-center gap-2">
        {}
        <input
          type="checkbox"
          role="switch"
          checked={column.getIsVisible()}
          onChange={column.getToggleVisibilityHandler()}
          aria-label={column.id}
          aria-checked={column.getIsVisible()}
        />
        {column.id}
      </label>
    </div>
  )
}

function resolveOrderedColumns(table: ReturnType<typeof useReactTable<TableRecord>>): {
  readonly orderedIds: readonly string[]
  readonly orderedColumns: ReadonlyArray<Column<TableRecord, unknown>>
} {
  const allColumns = table.getAllColumns().filter((col) => col.id !== 'select')
  const declaredIds = allColumns.map((col) => col.id)
  const currentOrder = table.getState().columnOrder
  const orderedIds =
    currentOrder.length > 0
      ? [
          ...currentOrder.filter((id) => declaredIds.includes(id)),
          ...declaredIds.filter((id) => !currentOrder.includes(id)),
        ]
      : declaredIds
  const columnById = new Map(allColumns.map((col) => [col.id, col]))
  const orderedColumns = orderedIds
    .map((id) => columnById.get(id))
    .filter((col): col is (typeof allColumns)[number] => col !== undefined)
  return { orderedIds, orderedColumns }
}

export function ColumnsMenu({
  table,
}: {
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
}) {
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const { orderedIds, orderedColumns } = resolveOrderedColumns(table)
  const handleDragEnd = makeColumnDragEndHandler(orderedIds, table)
  const sortableItems = toMutableIds(orderedIds)

  return (
    <div
      role="menu"
      data-testid="column-toggle-panel"
      aria-label="Columns"
      className="border-border bg-background-overlay absolute top-full right-0 z-10 mt-1 min-w-max rounded border p-2 shadow-lg"
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortableItems}
          strategy={verticalListSortingStrategy}
        >
          {orderedColumns.map((col) => (
            <SortableColumnRow
              key={col.id}
              column={col}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}


export function ExportMenu({
  tableName,
  table,
  activeFilter,
  onClose,
}: {
  readonly tableName: string
  readonly table: ReturnType<typeof useReactTable<TableRecord>>
  readonly activeFilter: ActiveFilter | undefined
  readonly onClose: () => void
}) {
  return (
    <div
      role="menu"
      className="border-border bg-background-overlay absolute top-full right-0 z-10 mt-1 rounded border shadow-lg"
    >
      <a
        href={buildCsvExportHref(tableName, table, activeFilter)}
        download
        role="menuitem"
        className="hover:bg-background-subtle block w-full px-4 py-2 text-left text-sm"
        onClick={onClose}
      >
        Export as CSV
      </a>
      <a
        href={buildJsonExportHref(tableName, activeFilter)}
        download
        role="menuitem"
        className="hover:bg-background-subtle block w-full px-4 py-2 text-left text-sm"
        onClick={onClose}
      >
        Export as JSON
      </a>
    </div>
  )
}
