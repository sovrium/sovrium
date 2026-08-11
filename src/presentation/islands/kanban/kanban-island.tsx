/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState, type ReactElement } from 'react'
import { buildKanbanDragHandler } from './build-drag-handler'
import { groupRecords } from './group-records'
import { KanbanBoard } from './kanban-board'
import { KanbanError, KanbanLoading, KanbanMissingGroupBy } from './kanban-states'
import { useDragPermission } from './use-drag-permission'
import { useKanbanRecords } from './use-kanban-records'
import type { TableRecord } from '../shared/types'
import type {
  KanbanCard,
  KanbanDrag,
  KanbanGroupBy,
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
   * `optionValue → #RRGGBB` declared on the field `card.colorField` names,
   * resolved server-side from `app.tables` (an island receives records, never
   * the field schema). Absent when the field declares no option colours — the
   * cards then keep the default monochrome surface, since a kanban card has
   * never invented a hue of its own ([internal ref] A7 ruling 5).
   */
  readonly colorFieldColors?: Readonly<Record<string, string>>
}

/**
 * Resolve whether drag-to-persist is enabled.
 *
 * Drag is enabled when the schema configures `drag` AND `enabled !== false`
 * (`enabled` defaults to true when omitted per the schema docstring) — but
 * NEVER for a system source: a system source is READ-ONLY (there is no records
 * table to persist a drop to), so DB-table-only writes are gated off regardless
 * of any `drag` config. Column grouping (a read-side op over the envelope) stays.
 *
 * Extracted from `KanbanIsland` so the composition root stays under the
 * cyclomatic-complexity cap (mirrors the gallery island's helper extraction).
 */
function resolveDragConfigEnabled(isSystemSource: boolean, drag: KanbanDrag | undefined): boolean {
  return !isSystemSource && Boolean(drag) && drag?.enabled !== false
}

export default function KanbanIsland({
  dataSource,
  records,
  kanbanGroupBy,
  card,
  drag,
  emptyColumnMessage,
  columnOptions,
  columnColors,
  colorFieldColors,
}: KanbanIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useKanbanRecords(dataSource)

  // Local copy of the records list so optimistic drops appear before the
  // mutation completes. We sync this with server state whenever the query
  // returns fresh data (initial load, refetch, reconnect, etc.).
  const [localRecords, setLocalRecords] = useState<readonly TableRecord[]>([])
  useEffect(() => {
    if (data?.records) setLocalRecords(data.records)
  }, [data?.records])

  const groupByField = kanbanGroupBy?.field
  const dragConfigEnabled = resolveDragConfigEnabled(Boolean(dataSource?.system), drag)
  const tableName = dataSource?.table

  const { canDrag } = useDragPermission(tableName, groupByField, dragConfigEnabled)

  // Embedded rows win over the (disabled) fetch; a standalone board keeps its
  // own optimistic `localRecords` copy so a drop paints before the PATCH lands.
  const boardRecords = records ?? localRecords

  if (!groupByField) return <KanbanMissingGroupBy />
  if (isLoading) return <KanbanLoading />
  if (isError) return <KanbanError error={error} />

  const columns = groupRecords(boardRecords, groupByField, columnOptions, columnColors)
  const handleDragEnd = buildKanbanDragHandler({
    localRecords,
    setLocalRecords,
    groupByField,
    drag,
    tableName,
  })

  return (
    <KanbanBoard
      columns={columns}
      card={card}
      emptyColumnMessage={emptyColumnMessage}
      draggableEnabled={dragConfigEnabled && canDrag}
      onDragEnd={handleDragEnd}
      colorFieldColors={colorFieldColors}
    />
  )
}
