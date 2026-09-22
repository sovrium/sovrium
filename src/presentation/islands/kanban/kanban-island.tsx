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
import { KanbanError, KanbanLoading, KanbanMissingGroupBy } from './kanban-states'
import { useDragPermission } from './use-drag-permission'
import { useKanbanRecords } from './use-kanban-records'
import type { TableRecord } from '../runtime/types'
import type {
  KanbanCard,
  KanbanDrag,
  KanbanGroupBy,
  KanbanSwimlanes,
} from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'

interface KanbanIslandProps {
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
  /**
   * Rows supplied by an EMBEDDING component instead of fetched here.
   *
   * The data-table's view switcher renders this island over the rows the grid
   * is already showing, so a runtime search / filter / sort carries across the
   * switch rather than the board silently re-querying the whole table. The
   * embedder passes no `dataSource` alongside it, which disables the fetch
   * (`useRecordsQuery` is `enabled` only for a table or system binding) and
   * therefore also disables drag-to-persist — an embedded board is read-only,
   * because there is no bound table to write a drop back to.
   */
  readonly records?: readonly TableRecord[]
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
}

/**
 * Resolve whether a DROP MAY BE WRITTEN BACK.
 *
 * Persistence is enabled when the schema configures `drag` AND `enabled !==
 * false` (`enabled` defaults to true when omitted per the schema docstring) —
 * but NEVER for a system source: a system source is READ-ONLY (there is no
 * records table to persist a drop to), so DB-table-only writes are gated off
 * regardless of any `drag` config. Column grouping (a read-side op over the
 * envelope) stays.
 *
 * Extracted from `KanbanIsland` so the composition root stays under the
 * cyclomatic-complexity cap (mirrors the gallery island's helper extraction).
 */
function resolvePersistEnabled(isSystemSource: boolean, drag: KanbanDrag | undefined): boolean {
  return !isSystemSource && Boolean(drag) && drag?.enabled !== false
}

/**
 * Resolve whether A CARD MAY BE PICKED UP — the gesture, not the write.
 *
 * These were ONE flag until it was noticed that gating the gesture on the write
 * leaves a read-only board announcing a drag it refuses to perform: `DndContext`
 * still mounts its screen-reader description regions, so an assistive-technology
 * user is told to press the space bar to pick up a card that no `useSortable`
 * will answer. Telling a reader to do something impossible is worse than saying
 * nothing.
 *
 * So the two legs separate on what a drop DOES rather than on where the rows
 * came from. A board that can write needs `drag` declared, exactly as before. A
 * board bound to a read-only system source can only ever reorder in the
 * reader's own browser — there is no table to write to, so there is nothing for
 * a `drag` block to authorise and nothing a permission could protect. The
 * gesture is therefore on there by default, and `drag.enabled: false` is still
 * the one way an author switches it off, in either mode.
 *
 * Nothing survives the reader closing the tab: the reorder lives in
 * `localRecords`, and the next load re-reads the endpoint.
 */
function resolveLocalDragEnabled(isSystemSource: boolean, drag: KanbanDrag | undefined): boolean {
  if (drag?.enabled === false) return false
  return isSystemSource || Boolean(drag)
}

/** What a board may do with a drag: make the gesture, and keep its result. */
interface KanbanDragGate {
  /** A card may be picked up. */
  readonly draggableEnabled: boolean
  /** A settled drop may be written back to a table. */
  readonly persistEnabled: boolean
}

/**
 * Resolve both drag legs, including the permission probe the write leg needs.
 *
 * The probe is keyed on PERSISTENCE rather than on the gesture, and that is
 * load-bearing in the read-only direction: a drag that writes nothing needs no
 * write permission, and asking for one would fail CLOSED. The permissions query
 * is disabled without a `tableName`, a disabled TanStack query reports
 * `pending`, and `resolveDragPermission` reads pending as unresolved and
 * refuses — so a board with nothing to protect would have been protected hardest.
 *
 * BOTH axis fields are gated on the write leg, not just the first: a drop on a
 * two-axis board can write either field, so a reader who may set `status` but
 * not `team` must not be handed a board whose vertical drags fail at the API.
 *
 * `persistEnabled` implies `draggableEnabled`, which is why the composition
 * below is a choice between the two gates rather than a conjunction of them.
 *
 * Its own hook so the composition root stays inside the per-function line cap,
 * the reason `useBoardRecords` above is one too.
 */
function useKanbanDragGate(
  dataSource: KanbanIslandProps['dataSource'],
  drag: KanbanDrag | undefined,
  writeFields: readonly (string | undefined)[]
): KanbanDragGate {
  const isSystemSource = Boolean(dataSource?.system)
  const persistEnabled = resolvePersistEnabled(isSystemSource, drag)
  const localDragEnabled = resolveLocalDragEnabled(isSystemSource, drag)
  const { canDrag } = useDragPermission(dataSource?.table, writeFields, persistEnabled)
  return { draggableEnabled: persistEnabled ? canDrag : localDragEnabled, persistEnabled }
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
 * The records the board draws, plus the optimistic copy a drop paints into.
 *
 * Embedded rows (the data-table's view switcher) win over the — disabled —
 * fetch; a standalone board keeps its own copy so a drop appears before the
 * PATCH lands, and re-syncs whenever the query returns fresh data.
 */
function useBoardRecords(
  dataSource: KanbanIslandProps['dataSource'],
  embedded: readonly TableRecord[] | undefined
) {
  const { data, isLoading, isError, error } = useKanbanRecords(dataSource)
  const [localRecords, setLocalRecords] = useState<readonly TableRecord[]>([])
  useEffect(() => {
    if (data?.records) setLocalRecords(data.records)
  }, [data?.records])
  return {
    boardRecords: embedded ?? localRecords,
    localRecords,
    setLocalRecords,
    isLoading,
    isError,
    error,
  }
}

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
  if (!input.groupByField) return <KanbanMissingGroupBy />
  if (input.isLoading) return <KanbanLoading />
  if (input.isError) return <KanbanError error={input.error} />
  return undefined
}

export default function KanbanIsland({
  dataSource,
  records,
  kanbanGroupBy,
  swimlanes,
  card,
  drag,
  emptyColumnMessage,
  columnOptions,
  columnColors,
  swimlaneOptions,
  colorFieldColors,
}: KanbanIslandProps): ReactElement {
  const { boardRecords, localRecords, setLocalRecords, isLoading, isError, error } =
    useBoardRecords(dataSource, records)

  const groupByField = kanbanGroupBy?.field
  const laneField = swimlanes?.field
  const tableName = dataSource?.table
  const gate = useKanbanDragGate(dataSource, drag, [groupByField, laneField])

  const state = resolveBoardState({ groupByField, isLoading, isError, error })
  if (state || !groupByField) return state ?? <KanbanMissingGroupBy />

  const columns = groupRecords(boardRecords, groupByField, columnOptions, columnColors)
  const grid = resolveGrid({
    records: boardRecords,
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
    tableName,
    persist: gate.persistEnabled,
  })

  return (
    <KanbanBoard
      columns={columns}
      grid={grid}
      swimlanes={swimlanes}
      card={card}
      emptyColumnMessage={emptyColumnMessage}
      draggableEnabled={gate.draggableEnabled}
      onDragEnd={handleDragEnd}
      colorFieldColors={colorFieldColors}
    />
  )
}
