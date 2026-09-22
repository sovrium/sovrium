/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useState } from 'react'
import {
  computeKanbanGridClasses,
  computeKanbanLaneRowClasses,
} from '@/presentation/design/kanban-default-classes'
import { KanbanColumnHeader } from './kanban-column'
import { KanbanSwimlane } from './kanban-swimlane'
import type { KanbanGrid } from './group-lanes'
import type { KanbanCard } from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { ReactElement } from 'react'

export interface KanbanSwimlaneGridProps {
  readonly grid: KanbanGrid
  readonly card: KanbanCard | undefined
  readonly emptyColumnMessage: string | undefined
  readonly draggableEnabled: boolean
  readonly colorFieldColors: Readonly<Record<string, string>> | undefined
  /** Lane values the author declared as starting closed (`swimlanes.collapsed`). */
  readonly initiallyCollapsed: readonly string[] | undefined
}

/**
 * The two-axis board: one shared column-header row, then a stack of lanes.
 *
 * ─── THE COLUMNS ARE LABELLED ONCE ────────────────────────────────────────
 *
 * The header row sits ABOVE every lane and carries board-wide counts, on the
 * same gutter and the same cell width as the lanes beneath it. That is what
 * makes a column legible top-to-bottom across lanes, which is the whole reason
 * to add a second axis rather than two separate boards.
 *
 * The header cells deliberately carry NO `data-column` attribute. A cell is
 * identified by its (lane, column) intersection, and a labelled header that
 * answered `[data-column="Done"]` would make that selector ambiguous the moment
 * anything reached for it outside a lane.
 *
 * ─── COLLAPSE IS LOCAL STATE, SEEDED ONCE FROM THE CONFIG ─────────────────
 *
 * `swimlanes.collapsed` names a STARTING state, not a capability — every lane
 * carries its disclosure whether or not it is listed. So the set is the lazy
 * initialiser of a `useState` and is never read again: re-seeding it on a
 * re-render would slam a lane shut under a reader who had just opened it, every
 * time the records query refetched.
 */
export function KanbanSwimlaneGrid({
  grid,
  card,
  emptyColumnMessage,
  draggableEnabled,
  colorFieldColors,
  initiallyCollapsed,
}: KanbanSwimlaneGridProps): ReactElement {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(initiallyCollapsed ?? [])
  )

  const handleToggle = useCallback((laneValue: string) => {
    setCollapsed((previous) =>
      previous.has(laneValue)
        ? new Set([...previous].filter((value) => value !== laneValue))
        : new Set([...previous, laneValue])
    )
  }, [])

  return (
    <div className={computeKanbanGridClasses()}>
      <div className={computeKanbanLaneRowClasses()}>
        {grid.columnHeaders.map((column) => (
          <div
            key={column.value}
            className="w-72 shrink-0"
          >
            <KanbanColumnHeader column={column} />
          </div>
        ))}
      </div>
      {grid.lanes.map((lane) => (
        <KanbanSwimlane
          key={lane.value}
          lane={lane}
          expanded={!collapsed.has(lane.value)}
          onToggle={handleToggle}
          emptyMessage={emptyColumnMessage}
          card={card}
          draggableEnabled={draggableEnabled}
          colorFieldColors={colorFieldColors}
          idPrefix="kanban"
        />
      ))}
    </div>
  )
}
