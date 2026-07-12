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
    readonly table?: string
    readonly system?: SystemSource
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
  }
  readonly kanbanGroupBy?: KanbanGroupBy
  readonly card?: KanbanCard
  readonly drag?: KanbanDrag
  readonly emptyColumnMessage?: string
  readonly colorField?: string
  readonly columnOptions?: readonly string[]
}

function resolveDragConfigEnabled(isSystemSource: boolean, drag: KanbanDrag | undefined): boolean {
  return !isSystemSource && Boolean(drag) && drag?.enabled !== false
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

  const [localRecords, setLocalRecords] = useState<readonly TableRecord[]>([])
  useEffect(() => {
    if (data?.records) setLocalRecords(data.records)
  }, [data?.records])

  const groupByField = kanbanGroupBy?.field
  const dragConfigEnabled = resolveDragConfigEnabled(Boolean(dataSource?.system), drag)
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
