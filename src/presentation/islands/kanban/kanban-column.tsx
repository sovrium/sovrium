/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  KANBAN_COLUMN_TITLE_CLASSES,
  computeKanbanSwimlaneToggleClasses,
  computeKanbanColumnCountClasses,
  computeKanbanColumnDotClasses,
  computeKanbanColumnHeaderClasses,
} from '@/presentation/design/kanban-default-classes'
import { columnDropId } from './collision-detection'
import { KanbanCell } from './kanban-cell'
import { LaneChevron } from './kanban-swimlane'
import type { KanbanColumnPlacement } from './column-sizing'
import type { KanbanColumnData } from './group-records'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactElement } from 'react'

/**
 * DOM id of a foldable column's card well — the target of its `aria-controls`.
 * Scoped by the board's own id, so two boards on one page that share a column
 * value never point their toggles at each other's well.
 */
const columnBodyId = (idPrefix: string, value: string): string =>
  `${idPrefix}-column-${encodeURIComponent(value)}`

/**
 * The column title — plain text, or, on a board that declares
 * `kanbanGroupBy.collapsed`, the WAI-ARIA disclosure a swimlane header uses:
 * `<h3><button aria-expanded aria-controls>`, the whole label the hit target.
 * `expanded` is `undefined` on a board whose columns do not fold.
 */
function ColumnTitle({
  value,
  bodyId,
  expanded,
  onToggle,
}: {
  readonly value: string
  readonly bodyId: string | undefined
  readonly expanded: boolean | undefined
  readonly onToggle: ((value: string) => void) | undefined
}): ReactElement {
  if (expanded === undefined || !onToggle || bodyId === undefined) {
    return <h3 className={KANBAN_COLUMN_TITLE_CLASSES}>{value}</h3>
  }
  return (
    <h3 className={KANBAN_COLUMN_TITLE_CLASSES}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        className={computeKanbanSwimlaneToggleClasses()}
        onClick={() => onToggle(value)}
      >
        <LaneChevron expanded={expanded} />
        {value}
      </button>
    </h3>
  )
}

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
  bodyId,
  expanded,
  onToggle,
}: {
  readonly column: KanbanColumnData
  /** DOM id of the well a foldable header controls; absent on a board whose columns do not fold. */
  readonly bodyId?: string
  /** Open state of a foldable column; absent on a board whose columns do not fold. */
  readonly expanded?: boolean
  readonly onToggle?: (value: string) => void
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
      <ColumnTitle
        value={column.value}
        bodyId={bodyId}
        expanded={expanded}
        onToggle={onToggle}
      />
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
  expanded,
  onToggle,
  idPrefix,
  placement,
}: {
  readonly column: KanbanColumnData
  readonly placement?: KanbanColumnPlacement
  readonly emptyMessage?: string
  readonly card?: KanbanCard
  /** Open state, present only on a board that declares `kanbanGroupBy.collapsed`. */
  readonly expanded?: boolean
  readonly onToggle?: (value: string) => void
  /** The board's DOM-id scope, so a foldable column's `aria-controls` is unique per page. */
  readonly idPrefix: string
}): ReactElement {
  const bodyId = expanded === undefined ? undefined : columnBodyId(idPrefix, column.value)
  return (
    <KanbanCell
      column={column}
      dropId={columnDropId(column.value)}
      emptyMessage={emptyMessage}
      card={card}
      header={
        <KanbanColumnHeader
          column={column}
          bodyId={bodyId}
          expanded={expanded}
          onToggle={onToggle}
        />
      }
      folded={expanded === false}
      bodyId={bodyId}
      placement={placement}
    />
  )
}
