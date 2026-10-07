/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import dayGridPlugin from '@fullcalendar/react/daygrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import frLocale from '@fullcalendar/react/locales/fr'
import classicTheme from '@fullcalendar/react/themes/classic'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import { minutesToSlotDuration } from './calendar-handlers'
import { toZonedWallClock } from './calendar-zone'
import type { CalendarEvent } from './record-to-event'
import type { CalendarView } from '@/domain/models/app/pages/components/component-types/data/calendar/schema'
import type { CalendarOptions } from '@fullcalendar/react'

/**
 * The FullCalendar options that never change between renders, and the two
 * that are spread in by key presence. Module-level so every reference is
 * stable (no `jsx-no-new-*` churn, no option diffing on each render).
 */

export const VIEW_TO_FULLCALENDAR: Record<CalendarView, string> = {
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
export const FULLCALENDAR_TO_VIEW: Record<string, CalendarView> = {
  dayGridMonth: 'month',
  timeGridWeek: 'week',
  timeGridDay: 'day',
}

/**
 * The views, the drag interactions, and the classic theme — the theme is a
 * plugin in FullCalendar 7 (its class generators), paired with the stylesheet
 * `calendar-stylesheet.ts` delivers.
 */
export const CALENDAR_PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin, classicTheme]

/** What FullCalendar holds while a phone's agenda draws the month instead. */
export const NO_EVENTS: CalendarEvent[] = []

/**
 * The FullCalendar locale bundles the calendar ships — French only, matching
 * the caption table in `calendar-captions.ts`. The period title and the
 * weekday headers are dates, which FullCalendar formats through `Intl` under
 * whatever `locale` it is given, bundle or not; a bundle only adds the few
 * words FullCalendar writes itself (the week view's "all-day" row, the month
 * view's "+N more"). One bundle is well under a kilobyte, where `locales-all`
 * would carry sixty-odd languages the caption table cannot follow anyway.
 */
export const CALENDAR_LOCALES = [frLocale]

/**
 * The week and day views' period title and day headers, held at the formats
 * FullCalendar 6 used. Version 7 changed both defaults — the week title lost
 * its day numbers (`September 2026` for a week, where the reader needs
 * `Sep 21 – 27, 2026`) and the header gained them — so the toolbar caption
 * and the column headers keep their old wording by being spelled out here.
 */
export const CALENDAR_VIEWS = {
  dayGridMonth: { dayHeaderFormat: { weekday: 'short' } },
  timeGridWeek: {
    titleFormat: { year: 'numeric', month: 'short', day: 'numeric' },
    dayHeaderFormat: { weekday: 'short', month: 'numeric', day: 'numeric', omitCommas: true },
  },
  timeGridDay: { dayHeaderFormat: { weekday: 'long' } },
} satisfies CalendarOptions['views']

/**
 * Grid geometry FullCalendar 7 derives where version 6 read it from CSS.
 *
 * - `slotMinHeight` — a time slot is 24px on the canvas. Version 7 sizes a
 *   slot from its MEASURED label height (+1px) unless given a floor, and a
 *   stylesheet `height` on the slot row no longer reaches it.
 * - `aspectRatio` — with `height: 'auto'` a month row is now
 *   `width / aspectRatio / 6` tall (version 6 let it shrink to its content).
 *   At the default 1.35 a week row grows to ~100px in a typical card; 1.9
 *   keeps it at the ~70px rows the month grid had.
 */
export const GRID_GEOMETRY = { slotMinHeight: 24, aspectRatio: 1.9 } as const

/** 24-hour `09:00` slot labels (the test contract for time-grid views). */
export const SLOT_HEADER_FORMAT = {
  hour: '2-digit' as const,
  minute: '2-digit' as const,
  hour12: false,
}

/**
 * FullCalendar's `now` at the operator zone's wall clock — the now-indicator
 * and "today" follow the zone the events are placed in. Absent when the page
 * names no zone, leaving FullCalendar on the browser's clock.
 */
export function nowProp(pageZone: string | undefined): { readonly now?: () => string } {
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
export function slotDurationProp(minutes: number | undefined): { readonly slotDuration?: string } {
  const slotDuration = minutesToSlotDuration(minutes)
  return slotDuration === undefined ? {} : { slotDuration }
}
