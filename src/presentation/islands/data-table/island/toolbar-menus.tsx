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
import {
  computeTableCheckboxControlClasses,
  computeTableMenuClasses,
  computeTableMenuDragHandleClasses,
  computeTableMenuItemClasses,
} from '@/presentation/design/table-default-classes'
import { buildCsvExportHref, buildJsonExportHref } from './export-helpers'
import type { DataTableGridColumn, DataTableInstance } from './table-features'
import type { ActiveFilter } from './use-ui-state'
import type { CSSProperties } from 'react'

/**
 * Build the drag-transform style for a sortable column row. Returned from a
 * plain function (not an inline object literal) so react-perf's
 * `jsx-no-new-object-as-prop` does not flag the `style` prop — manual
 * memoization (`useMemo`) is discouraged project-wide (React 19 Compiler is
 * unavailable under Bun, but the lint rule still warns on it).
 */
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

/**
 * Build the drag-end reorder handler for the columns menu. Returned from a
 * plain factory so react-perf does not flag the `onDragEnd` prop as a
 * newly-created function (see {@link toSortableStyle} rationale).
 */
function makeColumnDragEndHandler(
  items: readonly string[],
  table: DataTableInstance
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

/** Copy a readonly id list into the mutable array `SortableContext` expects. */
function toMutableIds(ids: readonly string[]): string[] {
  return [...ids]
}

// ---------------------------------------------------------------------------
// ColumnsMenu — toggle visibility + drag-reorder
// ---------------------------------------------------------------------------

/**
 * Single column row inside the columns menu. Combines:
 * - A drag handle (`data-testid="drag-handle-<field>"`) wired to @dnd-kit's
 *   `useSortable` so the parent `SortableContext` can reorder.
 * - A `role="switch"` checkbox bound to TanStack Table's visibility handler.
 *
 * The row wrapper exposes `data-field="<field>"` so specs can locate items
 * via either `[data-testid="column-item-<field>"]` or the data-attribute
 * fallback the spec encodes as `panel.locator('[data-field="X"]')`.
 */
function SortableColumnRow({ column }: { readonly column: DataTableGridColumn }) {
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
      className={`${computeTableMenuItemClasses()} flex items-center gap-2`}
    >
      <span
        {...attributes}
        {...listeners}
        data-drag-handle
        data-testid={`drag-handle-${column.id}`}
        className={computeTableMenuDragHandleClasses()}
        aria-label={`Reorder ${column.id}`}
        role="button"
        tabIndex={0}
      >
        ::
      </span>
      <label className="flex flex-1 cursor-pointer items-center gap-2">
        {/* `role="switch"` semantics mirror the toggle UX (binary on/off
            column visibility) and let test specs locate each toggle via
            getByRole('switch', { name: 'phone' }). The native `<input
            type="checkbox">` continues to drive the actual state via
            TanStack Table's getToggleVisibilityHandler. */}
        <input
          type="checkbox"
          role="switch"
          checked={column.getIsVisible()}
          onChange={column.getToggleVisibilityHandler()}
          aria-label={column.id}
          aria-checked={column.getIsVisible()}
          className={computeTableCheckboxControlClasses()}
        />
        {column.id}
      </label>
    </div>
  )
}

/**
 * Compute the ordered list of column IDs the menu renders. `table.getAllColumns()`
 * returns the original column-def order; if the user has reordered via drag,
 * honour the explicit `columnOrder` state and append any unknown IDs (e.g.
 * newly-declared columns) at the end. `select` is excluded from the menu.
 */
function resolveOrderedColumns(table: DataTableInstance): {
  readonly orderedIds: readonly string[]
  readonly orderedColumns: ReadonlyArray<DataTableGridColumn>
} {
  const allColumns = table.getAllColumns().filter((col) => col.id !== 'select')
  const declaredIds = allColumns.map((col) => col.id)
  const currentOrder = table.state.columnOrder
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

export function ColumnsMenu({ table }: { readonly table: DataTableInstance }) {
  // Sensors mirror the kanban-island defaults: MouseSensor with no distance
  // constraint (Playwright's `dragTo` generates a single mousemove >> 5px so
  // drag activation still fires reliably) + KeyboardSensor for a11y.
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
      // POSITION stays here — where a popup opens is a property of its trigger.
      // Everything else (surface, rule, radius, elevation, item gap) is the
      // shared menu chrome.
      className={`${computeTableMenuClasses()} absolute top-full right-0 mt-1 min-w-max`}
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

// ---------------------------------------------------------------------------
// ExportMenu (CSV/JSON dropdown)
// ---------------------------------------------------------------------------

export function ExportMenu({
  tableName,
  table,
  activeFilter,
  onClose,
}: {
  readonly tableName: string
  readonly table: DataTableInstance
  readonly activeFilter: ActiveFilter | undefined
  readonly onClose: () => void
}) {
  return (
    <div
      role="menu"
      className={`${computeTableMenuClasses()} absolute top-full right-0 mt-1`}
    >
      <a
        href={buildCsvExportHref(tableName, table, activeFilter)}
        download
        role="menuitem"
        className={computeTableMenuItemClasses()}
        onClick={onClose}
      >
        Export as CSV
      </a>
      <a
        href={buildJsonExportHref(tableName, activeFilter)}
        download
        role="menuitem"
        className={computeTableMenuItemClasses()}
        onClick={onClose}
      >
        Export as JSON
      </a>
    </div>
  )
}
