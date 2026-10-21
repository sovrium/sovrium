/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useRecordSelectionToggle } from '../hooks/use-lazy-shared-filter-publisher'
import { BoardContinuation } from './board-continuation'
import { buildKanbanDragHandler } from './build-drag-handler'
import { buildKanbanGrid, type KanbanGrid } from './group-lanes'
import { groupRecords, withUncategorizedLabel, type KanbanHeaderPaint } from './group-records'
import { KanbanBoard } from './kanban-board'
import { KanbanFormatProvider } from './kanban-format-context'
import { KanbanError, KanbanLoading, KanbanMissingGroupBy } from './kanban-states'
import { useBoardRecords } from './use-board-records'
import { useKanbanDragGate } from './use-kanban-drag-gate'
import type { KanbanStrings } from './kanban-states'
import type { BoardPagination } from './use-board-window'
import type { FieldMetaMap } from '../hooks/use-inline-editing'
import type { SharedFilterPublisherConfig } from '../hooks/use-shared-filter-publisher'
import type { TableRecord } from '../runtime/types'
import type {
  KanbanCard,
  KanbanDrag,
  KanbanGroupBy,
  KanbanSwimlanes,
} from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'
import type { RecordTextFields } from '@/domain/models/app/tables/record-text-service'
import type { ReactElement } from 'react'

export interface KanbanIslandProps {
  /** The board's own words in the page language, where they differ from English. */
  readonly uiStrings?: KanbanStrings
  /** The channel the board publishes the card a reader selects on. */
  readonly publishes?: SharedFilterPublisherConfig
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
    /** `style: infinite` draws the board a page of cards at a time, as the reader scrolls. */
    readonly pagination?: BoardPagination
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
  /** `value → label` per axis, in the page language: what a column or lane header prints. */
  readonly columnLabels?: Readonly<Record<string, string>>
  readonly swimlaneLabels?: Readonly<Record<string, string>>
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
  /** How each formatted field reads in a card's text, resolved server-side. */
  readonly recordText?: RecordTextFields
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
  readonly columnPaint: KanbanHeaderPaint
  readonly swimlanes: KanbanSwimlanes | undefined
  readonly swimlaneOptions: readonly string[] | undefined
  readonly swimlaneLabels: Readonly<Record<string, string>> | undefined
}): KanbanGrid | undefined {
  const laneField = input.swimlanes?.field
  if (!laneField) return undefined
  return buildKanbanGrid({
    records: input.records,
    columnField: input.columnField,
    columnOptions: input.columnOptions,
    columnPaint: input.columnPaint,
    laneField,
    laneOptions: input.swimlaneOptions,
    laneLabels: input.swimlaneLabels,
    // Defaults TRUE, matching the column axis: a declared option draws its lane
    // even when empty, which is what makes `emptyColumnMessage` reachable one
    // level deeper than a single-axis board needs it.
    showEmptyLanes: input.swimlanes?.showEmpty !== false,
  })
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
  readonly strings: KanbanStrings
  readonly isError: boolean
  readonly error: unknown
}): ReactElement | undefined {
  if (input.groupByField === undefined) return <KanbanMissingGroupBy {...input} />
  if (input.isLoading) return <KanbanLoading {...input} />
  if (input.isError) return <KanbanError {...input} />
  return undefined
}

/** The single-axis columns and, on a two-axis board, the (lane, column) grid. */
function boardLayoutOf(
  props: KanbanIslandProps,
  shown: readonly TableRecord[],
  columnField: string
): { readonly columns: ReturnType<typeof groupRecords>; readonly grid: KanbanGrid | undefined } {
  const { columnOptions, swimlanes, swimlaneOptions, uiStrings } = props
  const swimlaneLabels = withUncategorizedLabel(props.swimlaneLabels, uiStrings)
  const columnPaint = {
    colors: props.columnColors,
    labels: withUncategorizedLabel(props.columnLabels, uiStrings),
  }
  const lanes = { columnOptions, columnPaint, swimlanes, swimlaneOptions, swimlaneLabels }
  return {
    columns: groupRecords(shown, columnField, columnOptions, columnPaint),
    grid: resolveGrid({ records: shown, columnField, ...lanes }),
  }
}

/**
 * The board. Its bound table reaches every card through the format context
 * (`format.table`), so a card's `openSheet` names it as a grid row's does and
 * the drawer binds the card's record only to the forms editing that table. The
 * colour-field hues and the drag gate travel the same way: only the card reads
 * them, so no column, lane or cell between here and it carries them.
 */
export default function KanbanIsland(props: KanbanIslandProps): ReactElement {
  const { dataSource, kanbanGroupBy, swimlanes, card, drag, emptyColumnMessage } = props
  const { localRecords, setLocalRecords, isLoading, isError, error, shown, continuation } =
    useBoardRecords(dataSource)

  const groupByField = columnFieldOf(kanbanGroupBy)
  const laneField = swimlanes?.field
  const { draggableEnabled, persistEnabled } = useKanbanDragGate(dataSource, drag, [
    groupByField,
    laneField,
  ])
  const { fieldMeta, colorFieldColors, recordText } = props
  const format = {
    fieldMeta,
    table: dataSource?.table,
    colorFieldColors,
    draggableEnabled,
    recordText,
    select: useRecordSelectionToggle(props.publishes),
  }

  const state = resolveBoardState({
    groupByField,
    isLoading,
    strings: props.uiStrings,
    isError,
    error,
  })
  if (state || groupByField === undefined)
    return state ?? <KanbanMissingGroupBy strings={props.uiStrings} />

  const { columns, grid } = boardLayoutOf(props, shown, groupByField)
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
        emptyColumnMessage={emptyColumnMessage ?? props.uiStrings?.['kanban.empty']}
        onDragEnd={handleDragEnd}
      />
      <BoardContinuation
        continuation={continuation}
        words={props.uiStrings}
      />
    </KanbanFormatProvider>
  )
}
