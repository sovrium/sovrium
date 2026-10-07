/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import FullCalendar from '@fullcalendar/react'
import { useInsertionEffect, useMemo } from 'react'
import { CalendarAgenda } from './calendar-agenda'
import { CalendarCreateModal } from './calendar-create-modal'
import { calendarPartOptions } from './calendar-dom-classes'
import { buildEventDropHandler, resolveCreateTable } from './calendar-interactions'
import {
  CALENDAR_LOCALES,
  CALENDAR_PLUGINS,
  CALENDAR_VIEWS,
  GRID_GEOMETRY,
  NO_EVENTS,
  SLOT_HEADER_FORMAT,
  VIEW_TO_FULLCALENDAR,
  nowProp,
  slotDurationProp,
} from './calendar-options'
import { ensureCalendarStylesheet } from './calendar-stylesheet'
import { CalendarToolbar } from './calendar-toolbar'
import {
  useCalendarToolbar,
  useDateClickModal,
  useEventClicks,
  usePhoneAgenda,
} from './use-calendar-state'
import type { ZoneOf } from './calendar-interactions'
import type { CalendarEvent } from './record-to-event'
import type {
  CalendarEventConfig,
  CalendarInteraction,
  CalendarView,
} from '@/domain/models/app/pages/components/component-types/data/calendar/schema'
import type { CalendarPartClasses } from '@/presentation/design/calendar-part-classes'
import type { CalendarRef, DateClickInfo, DatesSetInfo, EventClickInfo } from '@fullcalendar/react'
import type { ReactElement, RefObject } from 'react'

interface CalendarViewProps {
  readonly events: readonly CalendarEvent[]
  readonly defaultView?: CalendarView
  /**
   * Maximum number of events visible per day cell (month view) before a
   * "+N more" link replaces the overflow. Maps to FullCalendar's
   * `dayMaxEvents` option.
   */
  readonly maxEventsPerDay?: number
  readonly calendarEvent?: CalendarEventConfig
  readonly calendarInteraction?: CalendarInteraction
  /** Records' source table — required for drag-persist + create-modal POST. */
  readonly tableName?: string
  /** Date field name — used to pre-fill the create modal on date-click. */
  readonly dateField?: string
  /** End-date field name — used by drag-persist when set. */
  readonly endDateField?: string
  /** The operator zone stamped on the page — what "now" reads in. */
  readonly pageZone?: string | undefined
  /** The zone each date-time field reads in; drops and clicks are written back through it. */
  readonly zoneOf?: ZoneOf
  /** The author's classes for the calendar's pieces (`calendarPartOptions`). */
  readonly calendarClasses?: CalendarPartClasses
}

/**
 * Renders the Sovrium toolbar above the FullCalendar shell (month/week/day
 * plugins).
 *
 * The calendar is NAMED by the element around it — the island host — which
 * also carries the view it opens on (`data-view`), so one element answers `[data-component="calendar"]`.
 *
 * FullCalendar's own toolbar stays off (`headerToolbar` is `false` by default
 * in version 7) in favour of {@link CalendarToolbar}, whose title carries the
 * `sv-calendar-title` hook the heading spec locator resolves through. See
 * `presentation/design/calendar-default-classes.ts`.
 */
export function CalendarViewComponent(props: CalendarViewProps): ReactElement {
  const { events, defaultView = 'month', calendarEvent, calendarInteraction } = props
  const { onEventClick, onAgendaPick } = useEventClicks(calendarEvent)
  const { open, clickedDate, handleDateClick, closeModal } = useDateClickModal(
    calendarInteraction,
    props.dateField === undefined ? undefined : props.zoneOf?.(props.dateField)
  )
  const { calendarRef, handleDatesSet, toolbar, pageLocale, period } =
    useCalendarToolbar(defaultView)
  const { agenda, phoneToolbar } = usePhoneAgenda(toolbar)
  useInsertionEffect(ensureCalendarStylesheet, [])

  return (
    <div className="w-full">
      <CalendarToolbar
        {...phoneToolbar}
        className={props.calendarClasses?.toolbar}
      />
      {agenda && (
        <CalendarAgenda
          events={events}
          period={period}
          locale={pageLocale}
          onPick={onAgendaPick}
        />
      )}
      <CalendarGrid
        view={props}
        calendarRef={calendarRef}
        agenda={agenda}
        pageLocale={pageLocale}
        onDatesSet={handleDatesSet}
        onEventClick={onEventClick}
        onDateClick={handleDateClick}
      />
      <CalendarCreateModal
        open={open}
        tableName={resolveCreateTable(calendarInteraction, props.tableName) ?? ''}
        clickedDate={clickedDate}
        dateField={props.dateField}
        onClose={closeModal}
      />
    </div>
  )
}

/**
 * The FullCalendar shell. Hidden, and holding no events, while a phone's
 * agenda draws the month: it stays mounted so the toolbar keeps paging the
 * period the agenda lists.
 */
function CalendarGrid({
  view,
  calendarRef,
  agenda,
  pageLocale,
  onDatesSet,
  onEventClick,
  onDateClick,
}: {
  readonly view: CalendarViewProps
  readonly calendarRef: RefObject<CalendarRef | null>
  readonly agenda: boolean
  readonly pageLocale: string
  readonly onDatesSet: (arg: DatesSetInfo) => void
  readonly onEventClick: ((info: EventClickInfo) => void) | undefined
  readonly onDateClick: (info: DateClickInfo) => void
}): ReactElement {
  const { tableName, dateField, endDateField, calendarInteraction, zoneOf } = view
  const handleEventDrop = buildEventDropHandler({ tableName, dateField, endDateField, zoneOf })
  const domClasses = useMemo(
    () => calendarPartOptions(view.calendarClasses),
    [view.calendarClasses]
  )
  return (
    <div className={agenda ? 'hidden' : undefined}>
      <FullCalendar
        ref={calendarRef}
        plugins={CALENDAR_PLUGINS}
        {...domClasses}
        {...GRID_GEOMETRY}
        views={CALENDAR_VIEWS}
        initialView={VIEW_TO_FULLCALENDAR[view.defaultView ?? 'month']}
        headerToolbar={false}
        locales={CALENDAR_LOCALES}
        locale={pageLocale}
        datesSet={onDatesSet}
        events={agenda ? NO_EVENTS : (view.events as CalendarEvent[])}
        height="auto"
        firstDay={1}
        nowIndicator={calendarInteraction?.showCurrentTimeIndicator !== false}
        {...nowProp(view.pageZone)}
        dayMaxEvents={view.maxEventsPerDay ?? false}
        eventClick={onEventClick}
        dateClick={onDateClick}
        editable={Boolean(handleEventDrop)}
        eventDrop={handleEventDrop}
        {...slotDurationProp(calendarInteraction?.timeSlotInterval)}
        slotHeaderFormat={SLOT_HEADER_FORMAT}
      />
    </div>
  )
}
