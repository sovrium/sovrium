/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useDndContext, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  computeKanbanColumnClasses,
  computeKanbanEmptyColumnClasses,
  computeKanbanPlaceholderClasses,
} from '@/presentation/design/kanban-default-classes'
import { KanbanCardView } from './kanban-card-view'
import type { KanbanColumnData } from './group-records'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactElement, ReactNode } from 'react'

/**
 * The reserved drop slot, rendered only while this cell is the active
 * droppable.
 *
 * A dashed outline on a recessed fill: it must read as an ABSENCE — a slot, not
 * a card. It carries no text and is not a `[data-card]`, so it is invisible to
 * the card counts and the `toContainText` assertions the kanban specs run once
 * a drop has settled.
 */
function DropPlaceholder(): ReactElement {
  return (
    <div
      data-role="kanban-placeholder"
      className={computeKanbanPlaceholderClasses()}
      aria-hidden="true"
    />
  )
}

/**
 * The cell's card stack — or, when it holds no records, its empty message.
 *
 * A cell being dragged over swaps its message for the placeholder rather than
 * showing both: the message states a fact that is about to stop being true, and
 * stacking the two makes the cell taller at exactly the moment the user is
 * aiming at it.
 */
function CellBody({
  column,
  emptyMessage,
  card,
  draggableEnabled,
  colorFieldColors,
  isOver,
}: {
  readonly column: KanbanColumnData
  readonly emptyMessage: string | undefined
  readonly card: KanbanCard | undefined
  readonly draggableEnabled: boolean
  readonly colorFieldColors: Readonly<Record<string, string>> | undefined
  readonly isOver: boolean
}): ReactElement {
  if (column.records.length === 0) {
    return isOver ? (
      <DropPlaceholder />
    ) : (
      <div className={computeKanbanEmptyColumnClasses()}>{emptyMessage ?? 'No records'}</div>
    )
  }
  return (
    <>
      {column.records.map((record) => (
        <KanbanCardView
          key={String(record.id ?? JSON.stringify(record))}
          record={record}
          card={card}
          draggableEnabled={draggableEnabled}
          colorFieldColors={colorFieldColors}
        />
      ))}
      {isOver ? <DropPlaceholder /> : undefined}
    </>
  )
}

export interface KanbanCellProps {
  readonly column: KanbanColumnData
  /**
   * The droppable id this cell registers. A single-axis board passes a column
   * id, a two-axis board a (lane, column) cell id — the ONE place the two
   * boards differ, which is why this is a parameter rather than derived here.
   */
  readonly dropId: string
  readonly emptyMessage?: string
  readonly card?: KanbanCard
  readonly draggableEnabled: boolean
  /** `optionValue → #RRGGBB` declared on the field `card.colorField` names. */
  readonly colorFieldColors?: Readonly<Record<string, string>>
  /** The column header, on the single-axis board that draws one per column. */
  readonly header?: ReactNode
}

/**
 * The `data-column` well: a droppable holding one group's cards.
 *
 * Drawn by BOTH boards. A single-axis board renders one per column with its own
 * header; a two-axis board renders one per (lane, column) intersection with no
 * header, because the columns are labelled once above every lane. Splitting it
 * out is what keeps the drop target, the sortable context, the empty message
 * and the over-state from existing twice with two chances to diverge.
 */
/**
 * Whether this cell should reserve a drop slot — it is the drag's target, and
 * it is not already holding the card being dragged.
 *
 * The second clause is not cosmetic. dnd-kit marks a card's own cell `isOver`
 * the instant the pointer goes down, so a placeholder there grew the source
 * cell by its own height — 48px with the gap — and pushed every lane BELOW it
 * down by the same amount, before the pointer had moved at all. The board then
 * sprang back the moment the drag left that cell. On a one-axis board that
 * reflow is invisible: the columns sit side by side and a vertical shift cannot
 * change which one the pointer is over. On a two-axis board vertical position
 * IS a field value, so a drop aimed at the lane below landed two lanes below,
 * and did it consistently rather than flakily. Measured: lanes at y=40/137/233
 * became 40/185/281 on mousedown, so a pointer sent to the middle lane's
 * measured centre arrived in the lane under it.
 *
 * It is also the right thing to draw regardless: a slot marks where the card
 * WOULD land, and in the cell it already occupies it marks nothing.
 */
function usePlaceholderVisible(isOver: boolean, recordIds: readonly string[]): boolean {
  const { active } = useDndContext()
  const holdsActiveCard = active !== null && recordIds.includes(String(active.id))
  return isOver && !holdsActiveCard
}

export function KanbanCell({
  column,
  dropId,
  emptyMessage,
  card,
  draggableEnabled,
  colorFieldColors,
  header,
}: KanbanCellProps): ReactElement {
  // Make the cell itself a droppable target so dragging onto an empty cell (or
  // onto its background, not over a card) still resolves to a valid drop target.
  const { setNodeRef, isOver } = useDroppable({ id: dropId })
  const recordIds = column.records.map((r) => String(r['id'] ?? ''))
  const showPlaceholder = usePlaceholderVisible(isOver, recordIds)

  return (
    <div
      ref={setNodeRef}
      data-column={column.value}
      // `w-72 shrink-0` stays here rather than in the recipe: width is a
      // placement concern owned by whatever composes the board, and the SSR
      // skeleton appends the same pair. The recipe owns the well's chrome and
      // its inner rhythm — which no longer includes a border, because a filled
      // well plus a hairline states one boundary twice.
      className={`${computeKanbanColumnClasses({ state: isOver ? 'over' : 'default' })} w-72 shrink-0`}
    >
      {header}
      <SortableContext
        items={recordIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-[2.5rem] flex-col gap-1.5">
          <CellBody
            column={column}
            emptyMessage={emptyMessage}
            card={card}
            draggableEnabled={draggableEnabled}
            colorFieldColors={colorFieldColors}
            isOver={showPlaceholder}
          />
        </div>
      </SortableContext>
    </div>
  )
}
