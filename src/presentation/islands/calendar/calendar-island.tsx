/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo } from 'react'
import { resolvePageTimezone } from '../runtime/page-timezone'
import { CalendarError, CalendarLoading, CalendarMissingDateField } from './calendar-states'
import { CalendarViewComponent } from './calendar-view'
import { recordsToCalendarEvents } from './record-to-event'
import { useCalendarRecords } from './use-calendar-records'
import type {
  CalendarEventConfig,
  CalendarInteraction,
  CalendarView,
} from '@/domain/models/app/pages/components/component-types/data/calendar/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { SystemSource } from '@/domain/models/app/pages/components/system-source'
import type { CalendarPartClasses } from '@/presentation/design/calendar-part-classes'
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
  /** The fields holding a calendar day, resolved server-side. */
  readonly dateOnlyFields?: readonly string[]
  /** `field → zone` for the date-time fields declaring a `timeZone`, resolved server-side. */
  readonly fieldTimeZones?: Readonly<Record<string, string>>
  readonly maxEventsPerDay?: number
  readonly calendarEvent?: CalendarEventConfig
  readonly calendarInteraction?: CalendarInteraction
  /** The author's classes for the calendar's pieces, resolved server-side. */
  readonly calendarClasses?: CalendarPartClasses
}

/**
 * The zone each date-time field reads in: its declared `timeZone`, else the
 * operator zone the server stamped on the page — the grid's rule.
 */
function useZones(fieldTimeZones: Readonly<Record<string, string>> | undefined): {
  readonly pageZone: string | undefined
  readonly zoneOf: (field: string) => string | undefined
} {
  const pageZone = resolvePageTimezone()
  const zoneOf = useMemo(
    () =>
      (field: string): string | undefined =>
        fieldTimeZones?.[field] ?? pageZone,
    [fieldTimeZones, pageZone]
  )
  return { pageZone, zoneOf }
}

export default function CalendarIsland({
  dataSource,
  dateField,
  endDateField,
  defaultView,
  labelField,
  colorField,
  colorFieldColors,
  dateOnlyFields,
  fieldTimeZones,
  maxEventsPerDay,
  calendarEvent,
  calendarInteraction,
  calendarClasses,
}: CalendarIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useCalendarRecords(dataSource)
  const { pageZone, zoneOf } = useZones(fieldTimeZones)

  if (!dateField) return <CalendarMissingDateField />
  if (isLoading) return <CalendarLoading />
  if (isError) return <CalendarError error={error} />

  const events = recordsToCalendarEvents(data?.records ?? [], {
    dateField,
    endDateField,
    labelField,
    colorField,
    colorFieldColors,
    dateOnlyFields,
    zoneOf,
  })

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
      maxEventsPerDay={maxEventsPerDay}
      calendarEvent={calendarEvent}
      calendarInteraction={isSystemSource ? undefined : calendarInteraction}
      tableName={dataSource?.table}
      dateField={dateField}
      endDateField={endDateField}
      pageZone={pageZone}
      zoneOf={zoneOf}
      calendarClasses={calendarClasses}
    />
  )
}
