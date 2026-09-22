/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveIslandRecords } from '../runtime/data-binding'
import { CalendarError, CalendarLoading, CalendarMissingDateField } from './calendar-states'
import { CalendarViewComponent } from './calendar-view'
import { recordsToCalendarEvents } from './record-to-event'
import { useCalendarRecords } from './use-calendar-records'
import type { CalendarEvent } from './record-to-event'
import type { TableRecord } from '../runtime/types'
import type {
  CalendarEventConfig,
  CalendarInteraction,
  CalendarView,
} from '@/domain/models/app/pages/components/component-types/data/calendar/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'
import type { ReactElement } from 'react'

interface CalendarIslandProps {
  readonly dataSource?: {
    /** DB-table binding — ABSENT for a system-source binding. */
    readonly table?: string
    /**
     * System read-endpoint binding (CAP-1). Plots events from a named read
     * endpoint instead of a declared DB table. Mutually exclusive with `table`.
     * A system source is READ-ONLY: `tableName` resolves to `undefined`, so the
     * view's drag-reschedule + create-modal POST (both keyed on a table) are
     * gated off automatically.
     */
    readonly system?: SystemSource
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
  }
  /**
   * Rows supplied by an EMBEDDING component instead of fetched here — the
   * data-table's view switcher renders this island over the rows its grid is
   * already showing, so a runtime search / filter carries across the switch.
   * Passed WITHOUT a `dataSource`, which disables the fetch.
   *
   * Embedded mode also lands the calendar on the month of the EARLIEST record
   * rather than on today. A standalone calendar is a surface you navigate, so
   * "today" is the right landing point; a calendar that is one tab of a view
   * switcher is a rendering OF a set of records the user just narrowed, and
   * opening on an empty month would read as "the switch lost my records".
   */
  readonly records?: readonly TableRecord[]
  readonly dateField?: string
  readonly endDateField?: string
  readonly defaultView?: CalendarView
  readonly labelField?: string
  readonly colorField?: string
  /**
   * `optionValue → #RRGGBB` declared on the field `colorField` names, resolved
   * server-side from `app.tables` (an island receives records, never the field
   * schema). Absent when the field declares no option colours — events then
   * keep the built-in fallback palette.
   */
  readonly colorFieldColors?: Readonly<Record<string, string>>
  readonly maxEventsPerDay?: number
  readonly calendarEvent?: CalendarEventConfig
  readonly calendarInteraction?: CalendarInteraction
}

/**
 * Earliest event start as the `YYYY-MM-DD` string FullCalendar's `initialDate`
 * wants. Undefined when there is nothing to land on, which leaves
 * FullCalendar's own "today" default in place.
 *
 * ISO-8601 timestamps compare correctly as plain strings for a common offset,
 * which is what `recordsToCalendarEvents` emits — no Date parsing needed.
 */
function earliestEventDate(events: readonly CalendarEvent[]): string | undefined {
  const starts = events.map((e) => e.start).filter((s) => typeof s === 'string' && s.length > 0)
  const earliest = starts.length === 0 ? undefined : starts.reduce((min, s) => (s < min ? s : min))
  return earliest?.slice(0, 10)
}

/**
 * Only the EMBEDDED calendar re-anchors — see the `records` docstring for why a
 * standalone calendar keeps FullCalendar's "today" default.
 */
function resolveInitialDate(
  records: readonly TableRecord[] | undefined,
  events: readonly CalendarEvent[]
): string | undefined {
  return records ? earliestEventDate(events) : undefined
}

export default function CalendarIsland({
  dataSource,
  records,
  dateField,
  endDateField,
  defaultView,
  labelField,
  colorField,
  colorFieldColors,
  maxEventsPerDay,
  calendarEvent,
  calendarInteraction,
}: CalendarIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useCalendarRecords(dataSource)

  if (!dateField) return <CalendarMissingDateField />
  if (isLoading) return <CalendarLoading />
  if (isError) return <CalendarError error={error} />

  const events = recordsToCalendarEvents(resolveIslandRecords(records, data?.records), {
    dateField,
    endDateField,
    labelField,
    colorField,
    colorFieldColors,
  })
  const initialDate = resolveInitialDate(records, events)

  // A system source is READ-ONLY: there is no records table to write to, so the
  // DB-table-only write affordances are gated off. `tableName` is undefined for a
  // system source (drag-reschedule + create-modal POST are keyed on a table), and
  // we also drop `calendarInteraction` so an onDateClick create can never fire.
  // View switching (month/week/day) is a read-side control and stays on.
  const isSystemSource = Boolean(dataSource?.system)

  return (
    <CalendarViewComponent
      events={events}
      defaultView={defaultView}
      {...(initialDate && { initialDate })}
      maxEventsPerDay={maxEventsPerDay}
      calendarEvent={calendarEvent}
      calendarInteraction={isSystemSource ? undefined : calendarInteraction}
      tableName={dataSource?.table}
      dateField={dateField}
      endDateField={endDateField}
    />
  )
}
