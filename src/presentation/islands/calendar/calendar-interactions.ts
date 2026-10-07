/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { cardPathClick, openCardDrawer } from '../runtime/card-click'
import {
  buildDropPatch,
  inclusiveDayEnd,
  persistEventDrop,
  resolveEventNavigatePath,
} from './calendar-handlers'
import { instantFromZonedWallClock } from './calendar-zone'
import type { TableRecord } from '../runtime/types'
import type {
  CalendarEventConfig,
  CalendarInteraction,
} from '@/domain/models/app/pages/components/component-types/data/calendar/schema'
import type { EventDropInfo } from '@fullcalendar/react'

/** The zone a date-time field reads in, or `undefined` for the browser's clock. */
export type ZoneOf = (field: string) => string | undefined

/**
 * Pull the navigate path off an event-click and route the user.
 *
 * The full record snapshot is exposed via FullCalendar's
 * `extendedProps`, so paths like `/events/$record.id` resolve without a
 * server round-trip.
 */
export function buildRecordClickHandler(
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
export const eventRecord = (id: string, snapshot: TableRecord | undefined): TableRecord => ({
  ...snapshot,
  id: snapshot?.['id'] ?? id,
})

/**
 * FullCalendar's drop callback fires AFTER the event has visually moved.
 * We mirror the new position to the persisted record. If the PATCH fails
 * (network, validation, permission), `info.revert()` rolls the FullCalendar
 * state back so the UI matches the database again.
 */
export function buildEventDropHandler(args: {
  readonly tableName: string | undefined
  readonly dateField: string | undefined
  readonly endDateField: string | undefined
  readonly zoneOf: ZoneOf | undefined
}): ((info: EventDropInfo) => void) | undefined {
  const { tableName, dateField, endDateField, zoneOf } = args
  if (!tableName || !dateField) return undefined
  return (info: EventDropInfo) => {
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

/**
 * Resolve the target table for the create modal — uses the CRUD action's
 * declared `table` when present, otherwise falls back to the calendar's
 * bound `tableName`. Returns `undefined` for non-create actions so the
 * modal renders with an empty table name (the form button still renders
 * but the POST is a no-op).
 */
export function resolveCreateTable(
  interaction: CalendarInteraction | undefined,
  tableName: string | undefined
): string | undefined {
  const action = interaction?.onDateClick
  if (action && 'type' in action && action.type === 'crud' && action.operation === 'create') {
    return action.table ?? tableName
  }
  return tableName
}
