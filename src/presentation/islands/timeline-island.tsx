/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { buildTimelineItems, type TimelineConfig } from './timeline/timeline-compute'
import {
  TimelineEmpty,
  TimelineError,
  TimelineLoading,
  TimelineMissingStartField,
  TimelineMissingTable,
} from './timeline/timeline-states'
import { TimelineView } from './timeline/timeline-view'
import { useTimelineRecords } from './timeline/use-timeline-records'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { ReactElement } from 'react'

interface TimelineIslandProps {
  readonly dataSource?: {
    readonly table: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
  }
  readonly startField?: string
  readonly endField?: string
  readonly labelField?: string
  readonly groupBy?: string
  readonly colorField?: string
  readonly defaultZoom?: TimelineConfig['defaultZoom']
  readonly emptyMessage?: string
}

export default function TimelineIsland({
  dataSource,
  startField,
  endField,
  labelField,
  groupBy,
  colorField,
  defaultZoom,
  emptyMessage,
}: TimelineIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useTimelineRecords(dataSource)

  if (!dataSource?.table) return <TimelineMissingTable />
  if (!startField) return <TimelineMissingStartField />
  if (isLoading) return <TimelineLoading />
  if (isError) return <TimelineError error={error} />

  const records = data?.records ?? []
  if (records.length === 0) return <TimelineEmpty message={emptyMessage} />

  const config: TimelineConfig = {
    startField,
    endField,
    labelField,
    groupBy,
    colorField,
    defaultZoom,
  }
  const items = buildTimelineItems(records, config)
  if (items.length === 0) return <TimelineEmpty message={emptyMessage} />

  return (
    <TimelineView
      items={items}
      groupBy={groupBy}
    />
  )
}
