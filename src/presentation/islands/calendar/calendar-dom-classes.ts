/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { CalendarPartClasses } from '@/presentation/design/calendar-part-classes'
import type {
  CalendarOptions,
  DayCellInfo,
  EventDisplayInfo,
  ViewDisplayInfo,
} from '@fullcalendar/react'

/**
 * The stable `fc-*` class names the calendar's DOM carries, restored on
 * FullCalendar 7.
 *
 * Version 7 renders hashed utility classes only (`fc-classic-YjJ`): the
 * semantic names version 6 put on its DOM — `.fc-event`, `.fc-daygrid-day`,
 * `.fc-timegrid-slot-lane` — are gone. Two things depended on them:
 *
 *  - **The specs.** `.fc-event`, `.fc-event-time`, `.fc-daygrid-day`,
 *    `.fc-event-draggable`, the slot lanes, the now-indicator line and the
 *    view classes are the locators the calendar specs read.
 *  - **The theming.** `infrastructure/css/theme/calendar-styles.ts` lays the
 *    design tokens and the canvas geometry onto those same names.
 *
 * Version 7's class hooks are the sanctioned way back: each `*Class` option is
 * JOINED with the theme plugin's own classes (`mergeCalendarOptions` treats
 * every `*Class` key as a class list, not an override), so these names sit
 * beside the classic theme's rather than replacing them. One name, one element:
 * `fc-event` lands on the event's root only, never on a descendant, which is
 * what lets a spec count events with it.
 */

type ClassPart = string | false | undefined

const join = (...parts: readonly ClassPart[]): string => parts.filter(Boolean).join(' ')

/** The day-state names v6 put on cells, lanes and headers alike. */
const dayState = (info: Pick<DayCellInfo, 'isToday' | 'isOther' | 'isPast' | 'isFuture'>): string =>
  join(
    info.isToday && 'fc-day-today',
    info.isOther && 'fc-day-other',
    info.isPast && 'fc-day-past',
    info.isFuture && 'fc-day-future'
  )

/** `fc-event` plus its state names, on the event root whatever its display. */
const eventClass = (info: EventDisplayInfo): string =>
  join(
    'fc-event',
    info.isDraggable && 'fc-event-draggable',
    info.isStart && 'fc-event-start',
    info.isEnd && 'fc-event-end',
    info.isPast && 'fc-event-past',
    info.isToday && 'fc-event-today',
    info.isFuture && 'fc-event-future',
    info.isMirror && 'fc-event-mirror'
  )

/**
 * `fc-view` + `fc-<type>-view` (the view locator the specs use), and the grid
 * family — `fc-daygrid` or `fc-timegrid` — the theming scopes its rules by.
 */
const viewClass = (info: ViewDisplayInfo): string =>
  join(
    'fc-view',
    `fc-${info.view.type}-view`,
    info.view.type.startsWith('timeGrid') ? 'fc-timegrid' : 'fc-daygrid'
  )

/**
 * The day-row events — month cells, and the week view's all-day row: a timed
 * event is a dot (`list-item`), an all-day or coloured one a block (`row`).
 */
const DAY_ROW_EVENT_CLASSES = {
  listItemEventClass: 'fc-daygrid-event fc-daygrid-dot-event',
  listItemEventBeforeClass: 'fc-daygrid-event-dot',
  rowEventClass: 'fc-daygrid-event fc-daygrid-block-event',
  rowMoreLinkClass: 'fc-daygrid-more-link',
} satisfies CalendarOptions

export const CALENDAR_DOM_CLASSES = {
  class: 'fc',
  viewClass,
  eventClass,
  eventInnerClass: 'fc-event-main',
  eventTimeClass: 'fc-event-time',
  eventTitleClass: 'fc-event-title',
  moreLinkClass: 'fc-more-link',
  dayHeaderClass: (info) => join('fc-col-header-cell', !info.inPopover && dayState(info)),
  dayHeaderInnerClass: 'fc-col-header-cell-cushion',
  dayCellClass: (info) => join(!info.inPopover && 'fc-daygrid-day', dayState(info)),
  dayCellInnerClass: 'fc-daygrid-day-frame',
  dayCellTopClass: 'fc-daygrid-day-top',
  dayCellTopInnerClass: 'fc-daygrid-day-number',
  dayCellBottomClass: 'fc-daygrid-day-bottom',
  dayLaneClass: (info) => join('fc-timegrid-col', dayState(info)),
  slotLaneClass: 'fc-timegrid-slot fc-timegrid-slot-lane',
  slotHeaderClass: 'fc-timegrid-slot fc-timegrid-slot-label',
  slotHeaderInnerClass: 'fc-timegrid-slot-label-cushion',
  allDayHeaderClass: 'fc-timegrid-axis',
  allDayHeaderInnerClass: 'fc-timegrid-axis-cushion',
  nowIndicatorLineClass: 'fc-timegrid-now-indicator-line',
  nowIndicatorHeaderClass: 'fc-timegrid-now-indicator-arrow',
  columnEventClass: 'fc-timegrid-event',
  columnMoreLinkClass: 'fc-timegrid-more-link',
  ...DAY_ROW_EVENT_CLASSES,
} satisfies CalendarOptions

/**
 * {@link CALENDAR_DOM_CLASSES} with the author's parts joined onto the hooks
 * that draw them: `event` on an event's root, `day` on a month cell,
 * `dayNumber` on its number, `columnHeader` on a weekday header. The popover a
 * "+N more" opens is left alone. The same object back when no part is named.
 */
export const calendarPartOptions = (parts: CalendarPartClasses | undefined): CalendarOptions => {
  if (parts === undefined) return CALENDAR_DOM_CLASSES
  return {
    ...CALENDAR_DOM_CLASSES,
    // `sv-event-part` lets the author's fill and ink through the calendar's
    // unlayered theme (`calendar-styles.ts`).
    eventClass: (info) => join(eventClass(info), parts.event && `sv-event-part ${parts.event}`),
    dayHeaderClass: (info) =>
      join(CALENDAR_DOM_CLASSES.dayHeaderClass(info), !info.inPopover && parts.columnHeader),
    dayCellClass: (info) =>
      join(CALENDAR_DOM_CLASSES.dayCellClass(info), !info.inPopover && parts.day),
    dayCellTopInnerClass: join(CALENDAR_DOM_CLASSES.dayCellTopInnerClass, parts.dayNumber),
  }
}
