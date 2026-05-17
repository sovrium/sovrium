/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useEffect, useState, type ReactElement } from 'react'
import { buildKanbanDragHandler } from './kanban/build-drag-handler'
import { groupRecords } from './kanban/group-records'
import { KanbanBoard } from './kanban/kanban-board'
import { KanbanError, KanbanLoading, KanbanMissingGroupBy } from './kanban/kanban-states'
import { useDragPermission } from './kanban/use-drag-permission'
import { useKanbanRecords } from './kanban/use-kanban-records'
import type { TableRecord } from './shared/types'
import type {
  KanbanCard,
  KanbanDrag,
  KanbanGroupBy,
} from '@/domain/models/app/pages/components/component-types/data/kanban/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'

interface KanbanIslandProps {
  readonly dataSource?: {
    readonly table: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
  }
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
}

export default function KanbanIsland({
  dataSource,
  kanbanGroupBy,
  card,
  drag,
  emptyColumnMessage,
  columnOptions,
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
  // Drag is enabled when the schema configures `drag` AND `enabled !== false`.
  // (`enabled` defaults to true when omitted per the schema docstring.)
  const dragConfigEnabled = Boolean(drag) && drag?.enabled !== false
  const tableName = dataSource?.table

  const { canDrag } = useDragPermission(tableName, groupByField, dragConfigEnabled)

  if (!groupByField) return <KanbanMissingGroupBy />
  if (isLoading) return <KanbanLoading />
  if (isError) return <KanbanError error={error} />

  const columns = groupRecords(localRecords, groupByField, columnOptions)
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
    />
  )
}
