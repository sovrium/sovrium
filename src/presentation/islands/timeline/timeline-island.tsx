/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hasDataBinding } from '../runtime/data-binding'
import { buildTimelineItems, type TimelineConfig } from './timeline-compute'
import {
  TimelineEmpty,
  TimelineError,
  TimelineLoading,
  TimelineMissingStartField,
  TimelineMissingTable,
} from './timeline-states'
import { TimelineView } from './timeline-view'
import { useTimelineRecords } from './use-timeline-records'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'
import type { ReactElement } from 'react'

interface TimelineIslandProps {
  readonly dataSource?: {
    /** DB-table binding — ABSENT for a system-source binding. */
    readonly table?: string
    /**
     * System read-endpoint binding (CAP-1). Plots entries from a named read
     * endpoint instead of a declared DB table. Mutually exclusive with `table`.
     * A system source is READ-ONLY — the timeline is a non-interactive
     * visualization (no drag-reschedule / resize), so writes are gated off
     * intrinsically.
     */
    readonly system?: SystemSource
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
  }
  readonly startField?: string
  readonly endField?: string
  readonly labelField?: string
  readonly groupBy?: string
  readonly colorField?: string
  /**
   * `optionValue → #RRGGBB` declared on the field `colorField` names, resolved
   * server-side from `app.tables` (an island receives records, never the field
   * schema). Absent when the field declares no option colours — bars then keep
   * the built-in fallback palette.
   */
  readonly colorFieldColors?: Readonly<Record<string, string>>
  readonly defaultZoom?: TimelineConfig['defaultZoom']
  /**
   * Draw a rule at the current date. ABSENT means ON: the schema declares this
   * with a decoding default of `true`, and a timeline's display bindings reach
   * the island through the component's open `props` object rather than through
   * that schema, so the default has to be honoured here — otherwise "declared
   * nothing" and "declared false" would render identically.
   */
  readonly showToday?: boolean
  /** Draw connectors between a record and the records it follows. Default off. */
  readonly showDependencies?: boolean
  /** Field holding the predecessor ids. Without it there is nothing to connect. */
  readonly dependencyField?: string
  readonly emptyMessage?: string
}

/**
 * data-timeline island — client-side data-bound timeline visualisation.
 *
 * The island contract:
 * - Returns `TimelineMissingTable` if NEITHER a `dataSource.table` NOR a
 *   `dataSource.system` read-endpoint binding is configured.
 * - Returns `TimelineMissingStartField` if no `startField` is configured.
 * - Returns `TimelineLoading` while the records query is in flight.
 * - Returns `TimelineError` on fetch failure.
 * - Returns `TimelineEmpty` when zero records come back.
 * - Otherwise renders `TimelineView` — horizontal bars on a time axis, point
 *   markers for records lacking an end date, optional swimlanes (`groupBy`)
 *   and per-value bar colors (`colorField`).
 *
 * Every branch emits `data-component="data-timeline"` so spec assertions on
 * the canonical attribute resolve in every state.
 */
export default function TimelineIsland({
  dataSource,
  startField,
  endField,
  labelField,
  groupBy,
  colorField,
  colorFieldColors,
  defaultZoom,
  showToday,
  showDependencies,
  dependencyField,
  emptyMessage,
}: TimelineIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useTimelineRecords(dataSource)

  if (!hasDataBinding(dataSource)) return <TimelineMissingTable />
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
    dependencyField,
  }
  const items = buildTimelineItems(records, config)
  if (items.length === 0) return <TimelineEmpty message={emptyMessage} />

  return (
    <TimelineView
      items={items}
      groupBy={groupBy}
      colorFieldColors={colorFieldColors}
      zoom={defaultZoom}
      showToday={showToday !== false}
      showDependencies={showDependencies === true && dependencyField !== undefined}
    />
  )
}
