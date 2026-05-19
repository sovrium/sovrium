/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  CalendarError,
  CalendarLoading,
  CalendarMissingDateField,
} from './calendar/calendar-states'
import { CalendarViewComponent } from './calendar/calendar-view'
import { recordsToCalendarEvents } from './calendar/record-to-event'
import { useCalendarRecords } from './calendar/use-calendar-records'
import type {
  CalendarEventConfig,
  CalendarInteraction,
  CalendarView,
} from '@/domain/models/app/pages/components/component-types/data/calendar/schema'
import type { DataFilter, DataSort } from '@/domain/models/app/pages/components/data-source'
import type { ReactElement } from 'react'

interface CalendarIslandProps {
  readonly dataSource?: {
    readonly table: string
    readonly view?: string
    readonly filter?: readonly DataFilter[]
    readonly sort?: readonly DataSort[]
  }
  readonly dateField?: string
  readonly endDateField?: string
  readonly defaultView?: CalendarView
  readonly labelField?: string
  readonly colorField?: string
  readonly maxEventsPerDay?: number
  readonly calendarEvent?: CalendarEventConfig
  readonly calendarInteraction?: CalendarInteraction
}

export default function CalendarIsland({
  dataSource,
  dateField,
  endDateField,
  defaultView,
  labelField,
  colorField,
  maxEventsPerDay,
  calendarEvent,
  calendarInteraction,
}: CalendarIslandProps): ReactElement {
  const { data, isLoading, isError, error } = useCalendarRecords(dataSource)

  if (!dateField) return <CalendarMissingDateField />
  if (isLoading) return <CalendarLoading />
  if (isError) return <CalendarError error={error} />

  const events = recordsToCalendarEvents(data?.records ?? [], {
    dateField,
    endDateField,
    labelField,
    colorField,
  })

  return (
    <CalendarViewComponent
      events={events}
      defaultView={defaultView}
      maxEventsPerDay={maxEventsPerDay}
      calendarEvent={calendarEvent}
      calendarInteraction={calendarInteraction}
      tableName={dataSource?.table}
      dateField={dateField}
      endDateField={endDateField}
    />
  )
}
