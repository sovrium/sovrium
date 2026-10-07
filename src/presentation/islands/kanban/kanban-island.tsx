/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState, type ReactElement } from 'react'
import { buildKanbanDragHandler } from './build-drag-handler'
import { buildKanbanGrid, type KanbanGrid } from './group-lanes'
import { groupRecords } from './group-records'
import { KanbanBoard } from './kanban-board'
import { KanbanFormatProvider } from './kanban-format-context'
import { KanbanError, KanbanLoading, KanbanMissingGroupBy } from './kanban-states'
import { useKanbanDragGate } from './use-kanban-drag-gate'
import { useKanbanRecords } from './use-kanban-records'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type { TableRecord } from '../runtime/types'
import type {
  KanbanCard,
  KanbanDrag,
  KanbanGroupBy,
  KanbanSwimlanes,
} from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'

export interface KanbanIslandProps {
  readonly dataSource?: {
    /** DB-table binding — ABSENT for a system-source binding. */
    readonly table?: string
    /**
     * System read-endpoint binding (CAP-1). Groups rows from a named read
     * endpoint instead of a declared DB table. Mutually exclusive with `table`.
     */
    readonly system?: SystemSource
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
  }
  readonly kanbanGroupBy?: KanbanGroupBy
  /**
   * The board's SECOND grouping axis. Absent on every board that declares none,
   * and its absence is what keeps that board a flat row of columns.
   */
  readonly swimlanes?: KanbanSwimlanes
  readonly card?: KanbanCard
  readonly drag?: KanbanDrag
  readonly emptyColumnMessage?: string
  readonly colorField?: string
  /**
   * Distinct values to render as columns, derived from the groupBy field's
   * schema-defined options (e.g. single-select / status options). When
   * provided, the board renders one column per option even if no record has
   * that value yet — this is what surfaces the empty-column message.
   */
  readonly columnOptions?: readonly string[]
  /**
   * A `columnValue → hex color` map derived from a colored `status` groupBy
   * field, so each column can render its option color as a header accent.
   * Absent when grouping by a plain (uncolored) single-select.
   */
  readonly columnColors?: Readonly<Record<string, string>>
  /**
   * Distinct values to render as lanes, derived from `swimlanes.field`'s
   * schema-defined options — the lane axis' counterpart to `columnOptions`, and
   * what makes a declared-but-unused lane render (and `showEmpty: false`
   * meaningful, since a lane can only be suppressed if it could have appeared).
   */
  readonly swimlaneOptions?: readonly string[]
  /**
   * `optionValue → #RRGGBB` declared on the field `card.colorField` names,
   * resolved server-side from `app.tables` (an island receives records, never
   * the field schema). Absent when the field declares no option colours — the
   * cards then keep the default monochrome surface, since a kanban card has
   * never invented a hue of its own ([internal ref] A7 ruling 5).
   */
  readonly colorFieldColors?: Readonly<Record<string, string>>
  /**
   * Declared display properties of the columns the card footer names, resolved
   * server-side from `app.tables` — what lets a `currency` footer item print
   * the column's own currency, precision and separators.
   */
  readonly fieldMeta?: FieldMetaMap
}

/**
 * Build the (lane, column) grid — or nothing at all, for a board that declares
 * no second axis.
 *
 * `undefined` is what the board branches on, so a config with no `swimlanes`
 * key produces exactly the flat column list it always has.
 */
function resolveGrid(input: {
  readonly records: readonly TableRecord[]
  readonly columnField: string
  readonly columnOptions: readonly string[] | undefined
  readonly columnColors: Readonly<Record<string, string>> | undefined
  readonly swimlanes: KanbanSwimlanes | undefined
  readonly swimlaneOptions: readonly string[] | undefined
}): KanbanGrid | undefined {
  const laneField = input.swimlanes?.field
  if (!laneField) return undefined
  return buildKanbanGrid({
    records: input.records,
    columnField: input.columnField,
    columnOptions: input.columnOptions,
    columnColors: input.columnColors,
    laneField,
    laneOptions: input.swimlaneOptions,
    // Defaults TRUE, matching the column axis: a declared option draws its lane
    // even when empty, which is what makes `emptyColumnMessage` reachable one
    // level deeper than a single-axis board needs it.
    showEmptyLanes: input.swimlanes?.showEmpty !== false,
  })
}

/**
 * The records the board draws: its own copy, so a drop appears before the
 * PATCH lands, re-synced whenever the query returns fresh data.
 */
function useBoardRecords(dataSource: KanbanIslandProps['dataSource']) {
  const { data, isLoading, isError, error } = useKanbanRecords(dataSource)
  const [localRecords, setLocalRecords] = useState<readonly TableRecord[]>([])
  useEffect(() => {
    if (data?.records) setLocalRecords(data.records)
  }, [data?.records])
  return {
    localRecords,
    setLocalRecords,
    isLoading,
    isError,
    error,
  }
}

/**
 * The board's column field. An EMPTY `kanbanGroupBy` is a board whose column
 * field its reader may not read (the server drops it for her): `''`, under
 * which one column holds every card. An absent one is a missing configuration.
 */
const columnFieldOf = (groupBy: KanbanGroupBy | undefined): string | undefined =>
  groupBy === undefined ? undefined : (groupBy.field ?? '')

/**
 * The placeholder a board renders INSTEAD of itself, or `undefined` when there
 * is a board to draw.
 *
 * Its own function so the composition root below stays inside the
 * cyclomatic-complexity cap.
 */
function resolveBoardState(input: {
  readonly groupByField: string | undefined
  readonly isLoading: boolean
  readonly isError: boolean
  readonly error: unknown
}): ReactElement | undefined {
  if (input.groupByField === undefined) return <KanbanMissingGroupBy />
  if (input.isLoading) return <KanbanLoading />
  if (input.isError) return <KanbanError error={input.error} />
  return undefined
}

/**
 * The board. Its bound table reaches every card through the format context
 * (`format.table`), so a card's `openDrawer` names it as a grid row's does and
 * the drawer binds the card's record only to the forms editing that table. The
 * colour-field hues and the drag gate travel the same way: only the card reads
 * them, so no column, lane or cell between here and it carries them.
 */
export default function KanbanIsland({
  dataSource,
  kanbanGroupBy,
  swimlanes,
  card,
  drag,
  emptyColumnMessage,
  columnOptions,
  columnColors,
  swimlaneOptions,
  colorFieldColors,
  fieldMeta,
}: KanbanIslandProps): ReactElement {
  const { localRecords, setLocalRecords, isLoading, isError, error } = useBoardRecords(dataSource)

  const groupByField = columnFieldOf(kanbanGroupBy)
  const laneField = swimlanes?.field
  const gate = useKanbanDragGate(dataSource, drag, [groupByField, laneField])
  const { draggableEnabled, persistEnabled } = gate
  const format = { fieldMeta, table: dataSource?.table, colorFieldColors, draggableEnabled }

  const state = resolveBoardState({ groupByField, isLoading, isError, error })
  if (state || groupByField === undefined) return state ?? <KanbanMissingGroupBy />

  const columns = groupRecords(localRecords, groupByField, columnOptions, columnColors)
  const grid = resolveGrid({
    records: localRecords,
    columnField: groupByField,
    columnOptions,
    columnColors,
    swimlanes,
    swimlaneOptions,
  })
  const handleDragEnd = buildKanbanDragHandler({
    localRecords,
    setLocalRecords,
    groupByField,
    laneField,
    drag,
    tableName: format.table,
    persist: persistEnabled,
  })

  return (
    <KanbanFormatProvider {...format}>
      <KanbanBoard
        columns={columns}
        grid={grid}
        swimlanes={swimlanes}
        groupBy={kanbanGroupBy}
        card={card}
        emptyColumnMessage={emptyColumnMessage}
        onDragEnd={handleDragEnd}
      />
    </KanbanFormatProvider>
  )
}
