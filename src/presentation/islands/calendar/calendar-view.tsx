/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useState } from 'react'
import { CalendarCreateModal } from './calendar-create-modal'
import {
  buildDropPatch,
  minutesToSlotDuration,
  navigateTo,
  persistEventDrop,
  resolveEventNavigatePath,
} from './calendar-handlers'
import type { CalendarEvent } from './record-to-event'
import type { TableRecord } from '../shared/types'
import type {
  CalendarEventConfig,
  CalendarInteraction,
  CalendarView,
} from '@/domain/models/app/pages/components/component-types/data/calendar/schema'
import type { EventClickArg, EventDropArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { ReactElement } from 'react'

const VIEW_TO_FULLCALENDAR: Record<CalendarView, string> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
}

// Module-level constants — stable references avoid jsx-no-new-* warnings.
const CALENDAR_PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin]
const HEADER_TOOLBAR = {
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay',
}
// 24-hour `09:00` format (matches the test contract for time-grid views).
const SLOT_LABEL_FORMAT = {
  hour: '2-digit' as const,
  minute: '2-digit' as const,
  hour12: false,
}

/**
 * Pull the navigate path off an event-click and route the user.
 *
 * The full record snapshot is exposed via FullCalendar's
 * `extendedProps`, so paths like `/events/$record.id` resolve without a
 * server round-trip.
 */
function buildEventClickHandler(
  calendarEvent: CalendarEventConfig | undefined
): ((info: EventClickArg) => void) | undefined {
  const action = calendarEvent?.onEventClick
  if (!action) return undefined
  return (info: EventClickArg) => {
    const record = (info.event.extendedProps as TableRecord | undefined) ?? {}
    const path = resolveEventNavigatePath(action, record)
    if (path) navigateTo(path)
  }
}

/**
 * FullCalendar's drop callback fires AFTER the event has visually moved.
 * We mirror the new position to the persisted record. If the PATCH fails
 * (network, validation, permission), `info.revert()` rolls the FullCalendar
 * state back so the UI matches the database again.
 */
function buildEventDropHandler(args: {
  readonly tableName: string | undefined
  readonly dateField: string | undefined
  readonly endDateField: string | undefined
}): ((info: EventDropArg) => void) | undefined {
  const { tableName, dateField, endDateField } = args
  if (!tableName || !dateField) return undefined
  return (info: EventDropArg) => {
    const recordId = String(info.event.id)
    const start = info.event.start?.toISOString()
    if (!start) {
      info.revert()
      return
    }
    const end = info.event.end?.toISOString()
    const patch = buildDropPatch({ dateField, endDateField, start, end })
    void persistEventDrop({ tableName, recordId, patch }).then((result) => {
      if (!result.ok) info.revert()
    })
  }
}

/**
 * Resolve the target table for the create modal — uses the CRUD action's
 * declared `table` when present, otherwise falls back to the calendar's
 * bound `tableName`. Returns `undefined` for non-create actions so the
 * modal renders with an empty table name (the form button still renders
 * but the POST is a no-op).
 */
function resolveCreateTable(
  interaction: CalendarInteraction | undefined,
  tableName: string | undefined
): string | undefined {
  const action = interaction?.onDateClick
  if (action?.type === 'crud' && action.operation === 'create') {
    return action.table ?? tableName
  }
  return tableName
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
  readonly calendarInteraction?: CalendarInteraction
  /** Records' source table — required for drag-persist + create-modal POST. */
  readonly tableName?: string
  /** Date field name — used to pre-fill the create modal on date-click. */
  readonly dateField?: string
  /** End-date field name — used by drag-persist when set. */
  readonly endDateField?: string
}

interface DateClickState {
  readonly open: boolean
  readonly clickedDate: string | undefined
  readonly handleDateClick: (info: DateClickArg) => void
  readonly closeModal: () => void
}

/**
 * Internal hook that bundles modal-open state with the FullCalendar
 * `dateClick` handler. Splitting this out keeps the parent component
 * under the `max-lines-per-function` cap and the `complexity` cap.
 */
function useDateClickModal(interaction: CalendarInteraction | undefined): DateClickState {
  const [open, setOpen] = useState(false)
  const [clickedDate, setClickedDate] = useState<string | undefined>(undefined)
  const action = interaction?.onDateClick
  const handleDateClick = (info: DateClickArg): void => {
    if (!action || action.type !== 'crud') return
    if (action.operation !== 'create') return
    setClickedDate(info.dateStr)
    setOpen(true)
  }
  const closeModal = (): void => setOpen(false)
  return { open, clickedDate, handleDateClick, closeModal }
}

/**
 * Renders the FullCalendar shell with month/week/day plugins.
 *
 * The wrapping `<div data-component="calendar">` carries the test marker
 * (matching the kanban precedent) so spec tests can scope locators to the
 * calendar's interactive surface, ignoring the SSR skeleton above it.
 */
export function CalendarViewComponent({
  events,
  defaultView = 'month',
  maxEventsPerDay,
  calendarEvent,
  calendarInteraction,
  tableName,
  dateField,
  endDateField,
}: CalendarViewProps): ReactElement {
  const initialView = VIEW_TO_FULLCALENDAR[defaultView]

  const handleEventClick = buildEventClickHandler(calendarEvent)
  const handleEventDrop = buildEventDropHandler({ tableName, dateField, endDateField })
  const { open, clickedDate, handleDateClick, closeModal } = useDateClickModal(calendarInteraction)

  const editableDrag = Boolean(handleEventDrop)
  const slotDuration = minutesToSlotDuration(calendarInteraction?.timeSlotInterval)
  const showCurrentTimeIndicator = calendarInteraction?.showCurrentTimeIndicator !== false
  const createTable = resolveCreateTable(calendarInteraction, tableName)

  return (
    <div
      data-component="calendar"
      data-view={defaultView}
      className="w-full"
    >
      <FullCalendar
        plugins={CALENDAR_PLUGINS}
        initialView={initialView}
        headerToolbar={HEADER_TOOLBAR}
        events={events as CalendarEvent[]}
        height="auto"
        firstDay={1}
        nowIndicator={showCurrentTimeIndicator}
        dayMaxEvents={maxEventsPerDay ?? false}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        editable={editableDrag}
        eventDrop={handleEventDrop}
        slotDuration={slotDuration}
        slotLabelFormat={SLOT_LABEL_FORMAT}
      />
      <CalendarCreateModal
        open={open}
        tableName={createTable ?? ''}
        clickedDate={clickedDate}
        dateField={dateField}
        onClose={closeModal}
      />
    </div>
  )
}
