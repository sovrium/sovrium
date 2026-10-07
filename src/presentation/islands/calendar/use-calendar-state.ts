/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useMemo, useRef, useState } from 'react'
import { usableLocale } from '@/domain/kernel/format/usable-locale'
import { resolvePageLocale } from '../runtime/page-locale'
import { resolveCalendarCaptions } from './calendar-captions'
import { buildRecordClickHandler, eventRecord } from './calendar-interactions'
import { FULLCALENDAR_TO_VIEW, VIEW_TO_FULLCALENDAR } from './calendar-options'
import { localDay, usePhoneViewport, type CalendarPeriod } from './calendar-period'
import { instantFromZonedWallClock } from './calendar-zone'
import type { CalendarToolbarProps } from './calendar-toolbar'
import type { CalendarEvent } from './record-to-event'
import type { TableRecord } from '../runtime/types'
import type {
  CalendarEventConfig,
  CalendarInteraction,
  CalendarView,
} from '@/domain/models/app/pages/components/component-types/data/calendar/schema'
import type { CalendarRef, DateClickInfo, DatesSetInfo, EventClickInfo } from '@fullcalendar/react'
import type { RefObject } from 'react'

/**
 * The calendar view's state hooks. Each one owns one relationship between the
 * Sovrium chrome and the FullCalendar instance, so `calendar-view.tsx` is
 * left with rendering only.
 */

/**
 * The event-click handlers: FullCalendar's, and the phone agenda's — the same
 * record click either way, so an event opens the same drawer or path on any
 * screen.
 */
export function useEventClicks(calendarEvent: CalendarEventConfig | undefined): {
  readonly onEventClick: ((info: EventClickInfo) => void) | undefined
  readonly onAgendaPick: ((event: CalendarEvent) => void) | undefined
} {
  return useMemo(() => {
    const onRecordClick = buildRecordClickHandler(calendarEvent)
    if (onRecordClick === undefined) return { onEventClick: undefined, onAgendaPick: undefined }
    return {
      onEventClick: (info: EventClickInfo) =>
        onRecordClick(eventRecord(info.event.id, info.event.extendedProps as TableRecord)),
      onAgendaPick: (event: CalendarEvent) =>
        onRecordClick(eventRecord(event.id, event.extendedProps)),
    }
  }, [calendarEvent])
}

interface DateClickState {
  readonly open: boolean
  readonly clickedDate: string | undefined
  readonly handleDateClick: (info: DateClickInfo) => void
  readonly closeModal: () => void
}

/** Modal-open state bundled with the FullCalendar `dateClick` handler. */
export function useDateClickModal(
  interaction: CalendarInteraction | undefined,
  zone: string | undefined
): DateClickState {
  const [open, setOpen] = useState(false)
  const [clickedDate, setClickedDate] = useState<string | undefined>(undefined)
  const action = interaction?.onDateClick
  const handleDateClick = (info: DateClickInfo): void => {
    if (!action || !('type' in action) || action.type !== 'crud') return
    if (action.operation !== 'create') return
    // A clicked time slot is a wall clock of the zone the grid is drawn in.
    setClickedDate(info.allDay ? info.dateStr : instantFromZonedWallClock(info.date, zone))
    setOpen(true)
  }
  const closeModal = (): void => setOpen(false)
  return { open, clickedDate, handleDateClick, closeModal }
}

interface ToolbarState {
  readonly calendarRef: RefObject<CalendarRef | null>
  readonly handleDatesSet: (arg: DatesSetInfo) => void
  /** The toolbar's whole prop set, ready to spread. */
  readonly toolbar: CalendarToolbarProps
  /**
   * The page language as `Intl` accepts it — handed to FullCalendar so the
   * period title and weekday headers are dates in the page's language too.
   */
  readonly pageLocale: string
  /** The period FullCalendar shows — what a phone's agenda lists. */
  readonly period: CalendarPeriod | undefined
}

/**
 * Wires the Sovrium toolbar to the FullCalendar instance.
 *
 * The whole of the toolbar's relationship to FullCalendar is these members,
 * and having them in one place is what makes it obvious that the toolbar reads
 * state OUT of the calendar and pushes commands IN, rather than holding a
 * second copy of the view state.
 *
 * `title` starts empty because FullCalendar has not mounted yet on the first
 * render; `datesSet` fires on mount and on every navigation, so the caption is
 * populated before the calendar is interactive. That is also the only event
 * that fires for BOTH a toolbar navigation and an internal one, which is what
 * keeps the segmented control honest when something else changes the view.
 */
export function useCalendarToolbar(defaultView: CalendarView): ToolbarState {
  const pageLocale = usableLocale(resolvePageLocale())
  const calendarRef = useRef<CalendarRef | null>(null)
  const [title, setTitle] = useState('')
  const [activeView, setActiveView] = useState<CalendarView>(defaultView)
  const [period, setPeriod] = useState<CalendarPeriod | undefined>(undefined)

  const handleDatesSet = (arg: DatesSetInfo): void => {
    setTitle(arg.view.title)
    setPeriod({ start: localDay(arg.view.currentStart), end: localDay(arg.view.currentEnd) })
    const next = FULLCALENDAR_TO_VIEW[arg.view.type]
    if (next) setActiveView(next)
  }

  const toolbar: CalendarToolbarProps = {
    title,
    activeView,
    onPrev: () => calendarRef.current?.getApi().prev(),
    onNext: () => calendarRef.current?.getApi().next(),
    onToday: () => calendarRef.current?.getApi().today(),
    onViewChange: (view) => calendarRef.current?.getApi().changeView(VIEW_TO_FULLCALENDAR[view]),
    captions: resolveCalendarCaptions(pageLocale),
  }

  return { calendarRef, handleDatesSet, toolbar, pageLocale, period }
}

/**
 * On a phone a month reads as an agenda (see `calendar-agenda.tsx`) until the
 * reader picks the month grid, and the switch names the agenda as a view of its
 * own. Returns whether the agenda is drawn and the toolbar that says so.
 */
export function usePhoneAgenda(toolbar: CalendarToolbarProps): {
  readonly agenda: boolean
  readonly phoneToolbar: CalendarToolbarProps
} {
  const phone = usePhoneViewport()
  const [agendaChosen, setAgendaChosen] = useState(true)
  const agenda = phone && agendaChosen && toolbar.activeView === 'month'
  if (!phone) return { agenda, phoneToolbar: toolbar }
  return {
    agenda,
    phoneToolbar: {
      ...toolbar,
      phone,
      agenda,
      onViewChange: (view) => {
        setAgendaChosen(false)
        toolbar.onViewChange(view)
      },
      onAgenda: () => {
        setAgendaChosen(true)
        toolbar.onViewChange('month')
      },
    },
  }
}
