/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { ViewEmpty, ViewError, ViewMissing, type ViewStrings } from '../parts/view-states'
import { hasDataBinding } from '../runtime/data-binding'
import { buildTimelineItems, type TimelineConfig } from './timeline-compute'
import { TimelineLoading } from './timeline-skeleton'
import { TimelineView } from './timeline-view'
import { TimelineResizeContext, useTimelineData } from './use-timeline-resize'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'
import type { ReactElement } from 'react'

interface TimelineIslandProps {
  /** The timeline's own words in the page language, where they differ from English. */
  readonly uiStrings?: ViewStrings
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
  /**
   * The date fields this reader may move by dragging a bar's ends, named by the
   * server from the table's update grant and each field's write rule. Absent
   * or empty draws no handle; a system-source timeline is never given any.
   */
  readonly resizeFields?: readonly string[]
}

const OF = 'timeline' as const

/** The timeline's English for the shared view states. */
const WORDS = {
  'timeline.loadFailed': 'Failed to load timeline records: {error}',
  'timeline.missingTable': 'data-timeline is missing a dataSource.table binding.',
  'timeline.missingStartField': 'data-timeline is missing a required {setting} binding.',
  'timeline.empty': 'No records on the timeline yet.',
  'timeline.emptyHint': 'Records with a value in the configured date field will appear here.',
} as const

/** The `data-timeline-state` each shared state carries: the host names the timeline once. */
const STATE = {
  error: { 'data-timeline-state': 'error' },
  'timeline.missingTable': { 'data-timeline-state': 'missing-table' },
  'timeline.missingStartField': { 'data-timeline-state': 'missing-start-field' },
} as const

/** An empty timeline announces itself, and the host's shell steps out around it. */
const EMPTY = { announce: true, attributes: { 'data-timeline-state': 'empty' } } as const

/** A binding the timeline's config left out. */
const missingOf = (
  sentence: 'timeline.missingTable' | 'timeline.missingStartField',
  strings: ViewStrings
): ReactElement => (
  <ViewMissing
    sentence={sentence}
    setting={sentence === 'timeline.missingStartField' ? 'startField' : undefined}
    words={WORDS}
    strings={strings}
    attributes={STATE[sentence]}
  />
)

/**
 * data-timeline island — client-side data-bound timeline visualisation.
 *
 * The island contract:
 * - Names the missing binding if NEITHER a `dataSource.table` NOR a
 *   `dataSource.system` read-endpoint binding is configured, or no `startField`.
 * - Returns `TimelineLoading` while the records query is in flight.
 * - Says the read failed on fetch failure.
 * - Says there is nothing to draw when zero records come back.
 * - Otherwise renders `TimelineView` — horizontal bars on a time axis, point
 *   markers for records lacking an end date, optional swimlanes (`groupBy`)
 *   and per-value bar colors (`colorField`).
 *
 * The island host names the timeline (`data-component="data-timeline"`) once,
 * whatever branch is drawn inside it.
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
  resizeFields,
  uiStrings,
}: TimelineIslandProps): ReactElement {
  const { records, resize, isLoading, isError, error } = useTimelineData(dataSource, {
    startField,
    endField,
    resizeFields,
  })

  const strings = uiStrings
  if (!hasDataBinding(dataSource)) return missingOf('timeline.missingTable', strings)
  if (!startField) return missingOf('timeline.missingStartField', strings)
  if (isLoading) return <TimelineLoading strings={strings} />
  if (isError)
    return <ViewError {...{ error, strings, of: OF, words: WORDS, attributes: STATE.error }} />

  const empty = (
    <ViewEmpty {...{ strings, of: OF, words: WORDS, message: emptyMessage, ...EMPTY }} />
  )
  if (records.length === 0) return empty

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
  if (items.length === 0) return empty

  return (
    <TimelineResizeContext.Provider value={resize}>
      <TimelineView
        items={items}
        groupBy={groupBy}
        colorFieldColors={colorFieldColors}
        zoom={defaultZoom}
        showToday={showToday !== false}
        showDependencies={showDependencies === true && dependencyField !== undefined}
      />
    </TimelineResizeContext.Provider>
  )
}
