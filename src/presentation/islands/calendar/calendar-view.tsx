/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import frLocale from '@fullcalendar/core/locales/fr'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { useMemo, useRef, useState } from 'react'
import { usableLocale } from '@/domain/kernel/format/usable-locale'
import { cardPathClick, openCardDrawer } from '../runtime/card-click'
import { resolvePageLocale } from '../runtime/page-locale'
import { CalendarAgenda } from './calendar-agenda'
import { resolveCalendarCaptions } from './calendar-captions'
import { CalendarCreateModal } from './calendar-create-modal'
import {
  buildDropPatch,
  inclusiveDayEnd,
  minutesToSlotDuration,
  persistEventDrop,
  resolveEventNavigatePath,
} from './calendar-handlers'
import { localDay, usePhoneViewport, type CalendarPeriod } from './calendar-period'
import { CalendarToolbar } from './calendar-toolbar'
import { instantFromZonedWallClock, toZonedWallClock } from './calendar-zone'
import type { CalendarToolbarProps } from './calendar-toolbar'
import type { CalendarEvent } from './record-to-event'
import type { TableRecord } from '../runtime/types'
import type {
  CalendarEventConfig,
  CalendarInteraction,
  CalendarView,
} from '@/domain/models/app/pages/components/component-types/data/calendar/schema'
import type { DatesSetArg, EventClickArg, EventDropArg, EventMountArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { ReactElement, RefObject } from 'react'

const VIEW_TO_FULLCALENDAR: Record<CalendarView, string> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
}

/**
 * The reverse of {@link VIEW_TO_FULLCALENDAR}.
 *
 * The Sovrium toolbar has to reflect the view FullCalendar is ACTUALLY
 * showing, not the one it was last told to show. Those diverge whenever
 * something other than the toolbar changes the view — a `navLink` day-name
 * click, a `dateClick` under `dayMaxEvents`, or a future external view
 * switcher — and a segmented control that keeps its own idea of the state is
 * the classic way a toolbar starts lying about what is on screen. Reading the
 * view back out of `datesSet` is what makes the control a mirror rather than a
 * second source of truth.
 */
const FULLCALENDAR_TO_VIEW: Record<string, CalendarView> = {
  dayGridMonth: 'month',
  timeGridWeek: 'week',
  timeGridDay: 'day',
}

// Module-level constants — stable references avoid jsx-no-new-* warnings.
const CALENDAR_PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin]
/** What FullCalendar holds while a phone's agenda draws the month instead. */
const NO_EVENTS: CalendarEvent[] = []
/**
 * The FullCalendar locale bundles the calendar ships — French only, matching
 * the caption table in `calendar-captions.ts`. The period title and the
 * weekday headers are dates, which FullCalendar formats through `Intl` under
 * whatever `locale` it is given, bundle or not; a bundle only adds the few
 * words FullCalendar writes itself (the week view's "all-day" row, the month
 * view's "+N more"). One bundle is ~0.6 KB, where `locales-all` would carry
 * sixty-odd languages the caption table cannot follow anyway.
 */
const CALENDAR_LOCALES = [frLocale]
// 24-hour `09:00` format (matches the test contract for time-grid views).
const SLOT_LABEL_FORMAT = {
  hour: '2-digit' as const,
  minute: '2-digit' as const,
  hour12: false,
}

/**
 * Mirror an event's derived label tone onto the event element itself.
 *
 * FullCalendar puts a per-event `textColor` on the inner `.fc-event-main`
 * only, while the declared FILL lands on the `.fc-event` harness — so the
 * element a reader (or an accessibility audit) inspects for the pair reports
 * a background from the author and a colour inherited from the page. On a dark
 * declared fill that pairing is unreadable, which is exactly the mismatch
 * [internal ref] A7 ruling 3 makes the platform responsible for closing.
 *
 * `eventDidMount` is FullCalendar's own extension point for this and does not
 * re-run when event data changes; that is tolerable here because the VISIBLE
 * label is driven by the declarative `textColor` on `.fc-event-main`, which
 * does re-render. This mirror only keeps the harness honest.
 */
function applyEventTextColor(info: EventMountArg): void {
  const { textColor } = info.event
  // eslint-disable-next-line functional/immutable-data, no-param-reassign -- FullCalendar hands the mounted element back for exactly this; DOM mutation is the contract of `eventDidMount`
  if (textColor) info.el.style.color = textColor
}

/**
 * Pull the navigate path off an event-click and route the user.
 *
 * The full record snapshot is exposed via FullCalendar's
 * `extendedProps`, so paths like `/events/$record.id` resolve without a
 * server round-trip.
 */
function buildRecordClickHandler(
  calendarEvent: CalendarEventConfig | undefined
): ((record: TableRecord) => void) | undefined {
  const action = calendarEvent?.onEventClick
  if (!action) return undefined
  return (record: TableRecord) => {
    // `openDrawer` opens the named drawer on the clicked record, as a grid
    // row click does.
    if ('action' in action && action.action === 'openDrawer') {
      openCardDrawer(action.component, record)
      return
    }
    // The filled path is followed only when it stays on this site.
    const path = resolveEventNavigatePath(action, record)
    if (path) cardPathClick(path)?.()
  }
}

/** The clicked event's record: its snapshot, keyed by the event's id. */
const eventRecord = (id: string, snapshot: TableRecord | undefined): TableRecord => ({
  ...snapshot,
  id: snapshot?.['id'] ?? id,
})

/**
 * The event-click handlers: FullCalendar's, and the phone agenda's — the same
 * record click either way, so an event opens the same drawer or path on any
 * screen.
 */
function useEventClicks(calendarEvent: CalendarEventConfig | undefined): {
  readonly onEventClick: ((info: EventClickArg) => void) | undefined
  readonly onAgendaPick: ((event: CalendarEvent) => void) | undefined
} {
  return useMemo(() => {
    const onRecordClick = buildRecordClickHandler(calendarEvent)
    if (onRecordClick === undefined) return { onEventClick: undefined, onAgendaPick: undefined }
    return {
      onEventClick: (info: EventClickArg) =>
        onRecordClick(eventRecord(info.event.id, info.event.extendedProps as TableRecord)),
      onAgendaPick: (event: CalendarEvent) =>
        onRecordClick(eventRecord(event.id, event.extendedProps)),
    }
  }, [calendarEvent])
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
  readonly zoneOf: ZoneOf | undefined
}): ((info: EventDropArg) => void) | undefined {
  const { tableName, dateField, endDateField, zoneOf } = args
  if (!tableName || !dateField) return undefined
  return (info: EventDropArg) => {
    const recordId = String(info.event.id)
    // An all-day event's start is a calendar DAY. `start.toISOString()` would
    // read the browser's local midnight in UTC — the day before, east of
    // Greenwich — so the day is taken as FullCalendar writes it.
    // A timed event sits at its zone's wall clock; the record keeps the instant.
    const start = info.event.allDay
      ? info.event.startStr.slice(0, 10)
      : info.event.start && instantFromZonedWallClock(info.event.start, zoneOf?.(dateField))
    if (!start) {
      info.revert()
      return
    }
    // An all-day event's end is exclusive on the calendar and inclusive in the
    // record: a range dropped to end on the 18th ends on the 17th.
    const end = info.event.allDay
      ? inclusiveDayEnd(info.event.endStr)
      : info.event.end === null
        ? undefined
        : instantFromZonedWallClock(
            info.event.end,
            endDateField === undefined ? undefined : zoneOf?.(endDateField)
          )
    const patch = buildDropPatch({ dateField, endDateField, start, end })
    void persistEventDrop({ tableName, recordId, patch }).then((result) => {
      if (!result.ok) info.revert()
    })
  }
}

/** The zone a date-time field reads in, or `undefined` for the browser's clock. */
type ZoneOf = (field: string) => string | undefined

/**
 * FullCalendar's `now` at the operator zone's wall clock — the now-indicator
 * and "today" follow the zone the events are placed in. Absent when the page
 * names no zone, leaving FullCalendar on the browser's clock.
 */
function nowProp(pageZone: string | undefined): { readonly now?: () => string } {
  if (pageZone === undefined) return {}
  return { now: () => toZonedWallClock(new Date(), pageZone) ?? new Date().toISOString() }
}

/**
 * The `slotDuration` option, as a bag to spread — carrying the key only when a
 * slot interval was actually declared.
 *
 * It cannot be passed as a plain attribute, because FullCalendar decides which
 * defaults apply by KEY PRESENCE rather than by value: an explicit
 * `slotDuration={undefined}` is not "unset", it SHADOWS the timegrid view's own
 * `00:30:00` default with nothing. The week and day views then try to divide by
 * a duration that never parsed, throw while rendering, and leave a blank card
 * where the grid should be. Month view is unaffected only because it has no
 * time slots to lay out.
 */
function slotDurationProp(minutes: number | undefined): { readonly slotDuration?: string } {
  const slotDuration = minutesToSlotDuration(minutes)
  return slotDuration === undefined ? {} : { slotDuration }
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
  if (action && 'type' in action && action.type === 'crud' && action.operation === 'create') {
    return action.table ?? tableName
  }
  return tableName
}

interface CalendarViewProps {
  readonly events: readonly CalendarEvent[]
  readonly defaultView?: CalendarView
  /**
   * Date the calendar opens on (`YYYY-MM-DD`). Omitted for a standalone
   * calendar, which keeps FullCalendar's "today" default; supplied when the
   * calendar renders as one tab of a data-table view switcher, so the month
   * shown is the month the narrowed records are actually in.
   */
  readonly initialDate?: string
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
function useDateClickModal(
  interaction: CalendarInteraction | undefined,
  zone: string | undefined
): DateClickState {
  const [open, setOpen] = useState(false)
  const [clickedDate, setClickedDate] = useState<string | undefined>(undefined)
  const action = interaction?.onDateClick
  const handleDateClick = (info: DateClickArg): void => {
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
  readonly calendarRef: RefObject<FullCalendar | null>
  readonly handleDatesSet: (arg: DatesSetArg) => void
  /**
   * The toolbar's whole prop set, ready to spread. Returned as one object
   * rather than six loose members so the wiring is a single line at the call
   * site: the parent component sits under a `max-lines-per-function` cap and
   * six JSX attributes is most of the budget the toolbar can afford there.
   */
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
 * Internal hook wiring the Sovrium toolbar to the FullCalendar instance.
 *
 * Split out for the same reason as {@link useDateClickModal} — the parent
 * component sits under a `max-lines-per-function` cap — but also because the
 * whole of the toolbar's relationship to FullCalendar is these eight members,
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
function useCalendarToolbar(defaultView: CalendarView): ToolbarState {
  const pageLocale = usableLocale(resolvePageLocale())
  const calendarRef = useRef<FullCalendar | null>(null)
  const [title, setTitle] = useState('')
  const [activeView, setActiveView] = useState<CalendarView>(defaultView)
  const [period, setPeriod] = useState<CalendarPeriod | undefined>(undefined)

  const handleDatesSet = (arg: DatesSetArg): void => {
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
function usePhoneAgenda(toolbar: CalendarToolbarProps): {
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

/**
 * Renders the Sovrium toolbar above the FullCalendar shell (month/week/day
 * plugins).
 *
 * The calendar is NAMED by the element around it — the island host, or the
 * wrapper a data-table's view switcher draws — which also carries the view it
 * opens on (`data-view`), so one element answers `[data-component="calendar"]`.
 *
 * `headerToolbar={false}` retires FullCalendar's own toolbar in favour of
 * {@link CalendarToolbar}. Two consequences worth knowing before reinstating
 * it: the entire `--fc-button-*` variable family goes dead with it (no Sovrium
 * token ever needed to be invented for FullCalendar's `#2c3e50` button slab),
 * and `.fc-toolbar-title` disappears — which is why the replacement title
 * carries the `sv-calendar-title` hook the heading spec locator resolves
 * through. See `presentation/utils/recipes/calendar-default-classes.ts`.
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

  return (
    <div className="w-full">
      <CalendarToolbar {...phoneToolbar} />
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
  readonly calendarRef: RefObject<FullCalendar | null>
  readonly agenda: boolean
  readonly pageLocale: string
  readonly onDatesSet: (arg: DatesSetArg) => void
  readonly onEventClick: ((info: EventClickArg) => void) | undefined
  readonly onDateClick: (info: DateClickArg) => void
}): ReactElement {
  const { tableName, dateField, endDateField, calendarInteraction, initialDate, zoneOf } = view
  const handleEventDrop = buildEventDropHandler({ tableName, dateField, endDateField, zoneOf })
  return (
    <div className={agenda ? 'hidden' : undefined}>
      <FullCalendar
        ref={calendarRef}
        plugins={CALENDAR_PLUGINS}
        initialView={VIEW_TO_FULLCALENDAR[view.defaultView ?? 'month']}
        {...(initialDate && { initialDate })}
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
        eventDidMount={applyEventTextColor}
        dateClick={onDateClick}
        editable={Boolean(handleEventDrop)}
        eventDrop={handleEventDrop}
        {...slotDurationProp(calendarInteraction?.timeSlotInterval)}
        slotLabelFormat={SLOT_LABEL_FORMAT}
      />
    </div>
  )
}
