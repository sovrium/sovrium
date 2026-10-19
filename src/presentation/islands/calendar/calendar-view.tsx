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
import type {
  CalendarRef,
  DateClickInfo,
  DatesSetInfo,
  EventClickInfo,
  EventDisplayInfo,
  MountInfo,
} from '@fullcalendar/react'
import type { ReactElement, RefObject } from 'react'

/**
 * A month chip's content: FullCalendar's own (`true`) except where it dropped
 * the time. Below 60px a day cell is "micro" and FullCalendar forces an empty
 * time, so a narrow month read titles with no hour at all. A timed event's
 * first segment keeps its `HH:mm` there, and only the title gives way (the
 * title ellipsizes; the time never shrinks — `calendar-styles.ts`). The time
 * is marked `sv-chip-micro`, which tightens that chip so the title keeps room
 * for at least a whole ellipsis.
 */
function chipContent(arg: EventDisplayInfo): ReactElement | true {
  const { event } = arg
  if (arg.timeText !== '' || event.allDay || event.start === null || !arg.isStart) return true
  return (
    <>
      <div className={`${arg.timeClass} sv-chip-micro`}>
        {arg.view.calendar.formatDate(event.start, SLOT_HEADER_FORMAT)}
      </div>
      <div className={arg.titleClass}>{event.title || '\u00A0'}</div>
    </>
  )
}

/**
 * Every chip names its event on hover, whatever its width: a chip too narrow
 * to show its title still says which event it is. The chip's text is left as
 * it is, so what an assistive technology reads does not change.
 */
function nameChip({ el, event }: MountInfo<EventDisplayInfo>): void {
  if (event.title !== '') el.setAttribute('title', event.title)
}

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
  /** Publishes the event a reader selects, on a calendar that declares `publishes`. */
  readonly select?: (recordId: unknown) => void
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
 * Renders the shadcn/ui toolbar above the FullCalendar shell (month/week/day
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
  const { onEventClick, onAgendaPick } = useEventClicks(calendarEvent, props.select)
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
        eventTimeFormat={SLOT_HEADER_FORMAT}
        eventContent={chipContent}
        eventDidMount={nameChip}
      />
    </div>
  )
}
