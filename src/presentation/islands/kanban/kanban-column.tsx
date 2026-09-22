/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  KANBAN_COLUMN_TITLE_CLASSES,
  computeKanbanColumnCountClasses,
  computeKanbanColumnDotClasses,
  computeKanbanColumnHeaderClasses,
} from '@/presentation/design/kanban-default-classes'
import { columnDropId } from './collision-detection'
import { KanbanCell } from './kanban-cell'
import type { KanbanColumnData } from './group-records'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactElement } from 'react'

/**
 * Column header: the optional colored status accent dot, the column label, and
 * the record-count badge.
 *
 * ONE flex line, where this was a `justify-between` row wrapping a nested flex
 * pair. The wrapper is gone (nothing selects it) and the count is pushed right
 * by its own `ml-auto`, which is what the canvas draws — with
 * `justify-between`, a truncating label and a right-aligned count left the
 * accent dot stranded mid-row.
 *
 * The `<h3>` stays an `<h3>`: `data-kanban` specs resolve it with
 * `getByRole('heading', { name })`, so the heading semantics are a contract and
 * only the type step moves.
 *
 * EXPORTED because a two-axis board draws this row ONCE above all its lanes
 * rather than once per cell — the columns are labelled in one place and every
 * lane repeats their geometry underneath. A header per cell would put one copy
 * of each column name per lane on the page, turning a single heading into a
 * count that grows with the data.
 */
export function KanbanColumnHeader({
  column,
}: {
  readonly column: KanbanColumnData
}): ReactElement {
  return (
    <div className={computeKanbanColumnHeaderClasses()}>
      {column.color ? (
        <span
          className={computeKanbanColumnDotClasses()}
          data-column-accent
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-column accent colour is dynamic config data; React Compiler not yet enabled in Bun
          style={{ backgroundColor: column.color }}
          aria-hidden="true"
        />
      ) : undefined}
      <h3 className={KANBAN_COLUMN_TITLE_CLASSES}>{column.value}</h3>
      <span
        className={computeKanbanColumnCountClasses()}
        aria-label={`${column.records.length} records`}
      >
        {column.records.length}
      </span>
    </div>
  )
}

/**
 * One column of a SINGLE-axis board: its header, over its own droppable well.
 *
 * The well itself, the drop target, the sortable context and the empty message
 * all live in {@link KanbanCell}, which a two-axis board draws headerless at
 * every (lane, column) intersection.
 */
export function KanbanColumn({
  column,
  emptyMessage,
  card,
  draggableEnabled,
  colorFieldColors,
}: {
  readonly column: KanbanColumnData
  readonly emptyMessage?: string
  readonly card?: KanbanCard
  readonly draggableEnabled: boolean
  /** `optionValue → #RRGGBB` declared on the field `card.colorField` names. */
  readonly colorFieldColors?: Readonly<Record<string, string>>
}): ReactElement {
  return (
    <KanbanCell
      column={column}
      dropId={columnDropId(column.value)}
      emptyMessage={emptyMessage}
      card={card}
      draggableEnabled={draggableEnabled}
      colorFieldColors={colorFieldColors}
      header={<KanbanColumnHeader column={column} />}
    />
  )
}
