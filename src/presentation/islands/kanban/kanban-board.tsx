/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DndContext, type DragEndEvent, type UniqueIdentifier } from '@dnd-kit/core'
import { useId } from 'react'
import { computeKanbanBoardClasses } from '@/presentation/design/kanban-default-classes'
import { kanbanCollisionDetection } from './collision-detection'
import { KanbanColumn } from './kanban-column'
import { KanbanSwimlaneGrid } from './kanban-swimlane-grid'
import { SettledDropTarget } from './settled-drop-target'
import { useFoldedValues } from './use-folded-values'
import { useKanbanSensors } from './use-kanban-sensors'
import { useSettledDrop } from './use-settled-drop'
import type { KanbanGrid } from './group-lanes'
import type { KanbanColumnData } from './group-records'
import type {
  KanbanCard,
  KanbanSwimlanes,
} from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactElement } from 'react'

interface KanbanBoardProps {
  readonly columns: readonly KanbanColumnData[]
  /**
   * The (lane, column) grid, present ONLY when the board declares `swimlanes`.
   *
   * Its absence is what selects the single-axis render below, so a board with
   * no second axis draws exactly the row of columns it drew before swimlanes
   * existed — the control [internal ref] pins.
   */
  readonly grid: KanbanGrid | undefined
  readonly swimlanes: KanbanSwimlanes | undefined
  /**
   * `kanbanGroupBy.collapsed` — the column values that start folded. Declaring
   * it is what makes every column of a single-axis board foldable; a board that
   * declares none keeps plain headings, exactly as before.
   */
  readonly collapsedColumns: readonly string[] | undefined
  readonly card: KanbanCard | undefined
  readonly emptyColumnMessage: string | undefined
  readonly draggableEnabled: boolean
  /**
   * Applies a settled drop. `overId` is dnd-kit's own drop target read after it
   * has caught up with the pointer — see {@link SettledDropTarget} for why the
   * one on the event cannot be trusted.
   */
  readonly onDragEnd: (event: DragEndEvent, overId: UniqueIdentifier | undefined) => void
  /** `optionValue → #RRGGBB` declared on the field `card.colorField` names. */
  readonly colorFieldColors: Readonly<Record<string, string>> | undefined
}

/**
 * The single-axis board: a horizontal row of columns, each with its own header.
 *
 * Unchanged from the board that shipped before swimlanes existed, down to the
 * class list — the control `[internal ref]` is there to catch a
 * second axis that quietly re-shapes the first.
 */
function KanbanColumnRow({
  columns,
  card,
  emptyColumnMessage,
  draggableEnabled,
  colorFieldColors,
  collapsedColumns,
  idPrefix,
}: {
  readonly columns: readonly KanbanColumnData[]
  readonly card: KanbanCard | undefined
  readonly emptyColumnMessage: string | undefined
  readonly draggableEnabled: boolean
  readonly colorFieldColors: Readonly<Record<string, string>> | undefined
  readonly collapsedColumns: readonly string[] | undefined
  readonly idPrefix: string
}): ReactElement {
  const [folded, toggle] = useFoldedValues(collapsedColumns)
  const foldable = collapsedColumns !== undefined
  return (
    <div className={computeKanbanBoardClasses()}>
      {columns.map((column) => (
        <KanbanColumn
          key={column.value}
          column={column}
          emptyMessage={emptyColumnMessage}
          card={card}
          draggableEnabled={draggableEnabled}
          colorFieldColors={colorFieldColors}
          expanded={foldable ? !folded.has(column.value) : undefined}
          onToggle={foldable ? toggle : undefined}
          idPrefix={idPrefix}
        />
      ))}
    </div>
  )
}

/**
 * Renders the kanban board's `<DndContext>` shell and column list.
 *
 * Extracted from `KanbanIsland` so the composition root stays a thin
 * wrapper around state hooks; this component owns the dnd-kit sensors
 * and the choice between the board's two shapes.
 *
 * ONE `<DndContext>` either way, and that is deliberate: a drag must be able to
 * cross a lane boundary as freely as a column one, and a context per lane would
 * make the vertical axis undraggable while every horizontal move kept working.
 */
export function KanbanBoard({
  columns,
  grid,
  swimlanes,
  collapsedColumns,
  card,
  emptyColumnMessage,
  draggableEnabled,
  onDragEnd,
  colorFieldColors,
}: KanbanBoardProps): ReactElement {
  const sensors = useKanbanSensors()
  const settleDrop = grid !== undefined
  const { overIdRef, cancelDrop, handleDragEnd } = useSettledDrop(settleDrop, onDragEnd)
  // Scopes every disclosure's `aria-controls` target to THIS board: two boards
  // on one page that share a column or lane value must not share an id.
  const idPrefix = `kanban-${useId()}`

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      cancelDrop={cancelDrop}
      onDragEnd={handleDragEnd}
    >
      {settleDrop ? <SettledDropTarget overIdRef={overIdRef} /> : undefined}
      {/*
       * The `data-component="kanban"` marker lives on the SSR island wrapper
       * (island-data-components.tsx) — the single, always-present component
       * element. The mounted board must NOT duplicate it, or `[data-component=
       * "kanban"]` resolves to two nodes and any non-`.first()` board-level
       * assertion (e.g. toContainText) trips Playwright's strict mode.
       */}
      {grid ? (
        <KanbanSwimlaneGrid
          grid={grid}
          card={card}
          emptyColumnMessage={emptyColumnMessage}
          draggableEnabled={draggableEnabled}
          colorFieldColors={colorFieldColors}
          initiallyCollapsed={swimlanes?.collapsed}
          idPrefix={idPrefix}
        />
      ) : (
        <KanbanColumnRow
          columns={columns}
          card={card}
          emptyColumnMessage={emptyColumnMessage}
          draggableEnabled={draggableEnabled}
          colorFieldColors={colorFieldColors}
          collapsedColumns={collapsedColumns}
          idPrefix={idPrefix}
        />
      )}
    </DndContext>
  )
}
