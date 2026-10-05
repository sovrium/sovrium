/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A month calendar on a phone, read as an agenda.
 *
 * Seven day columns at 390 px leave each event a strip too narrow for its
 * title, so every title is clipped and the month says nothing. Below the small
 * breakpoint the month is therefore drawn as the period's events stacked in
 * date order, one per line under its day, each title in full, with no sideways
 * scroll — the rendering the boards draw on a phone. The toolbar still pages
 * the month: FullCalendar stays mounted (hidden, holding no events) to own the
 * period, and this list reads the period it reports.
 *
 * Week and day views are unaffected: a time grid already has room for a title.
 */

import { useMemo, type CSSProperties, type ReactElement } from 'react'
import { formatCalendarDate } from '@/domain/kernel/format/calendar-date'
import type { CalendarPeriod } from './calendar-period'
import type { CalendarEvent } from './record-to-event'

interface AgendaDay {
  readonly day: string
  readonly items: readonly {
    readonly event: CalendarEvent
    readonly style: CSSProperties
  }[]
}

/** The period's events grouped by day, in date order. */
function agendaDays(
  events: readonly CalendarEvent[],
  period: CalendarPeriod
): readonly AgendaDay[] {
  const inPeriod = events
    .filter((event) => {
      const day = event.start.slice(0, 10)
      return day >= period.start && day < period.end
    })
    .toSorted((a, b) => a.start.localeCompare(b.start))
  const days = [...new Set(inPeriod.map((event) => event.start.slice(0, 10)))]
  return days.map((day) => ({
    day,
    items: inPeriod
      .filter((event) => event.start.slice(0, 10) === day)
      .map((event) => ({
        event,
        style: {
          ...(event.backgroundColor ? { backgroundColor: event.backgroundColor } : {}),
          ...(event.textColor ? { color: event.textColor } : {}),
        },
      })),
  }))
}

const ITEM_CLASS =
  'border-border w-full rounded border px-2 py-1 text-left text-sm break-words whitespace-normal'

export function CalendarAgenda({
  events,
  period,
  locale,
  onPick,
}: {
  readonly events: readonly CalendarEvent[]
  readonly period: CalendarPeriod | undefined
  readonly locale: string
  readonly onPick: ((event: CalendarEvent) => void) | undefined
}): ReactElement {
  const days = useMemo(
    () => (period === undefined ? [] : agendaDays(events, period)),
    [events, period]
  )
  return (
    <ol
      data-calendar-agenda=""
      className="flex flex-col gap-3 py-2"
    >
      {days.map(({ day, items }) => (
        <li
          key={day}
          className="flex flex-col gap-1"
        >
          <p className="text-foreground-muted text-sm">
            {formatCalendarDate(day, locale, 'short') ?? day}
          </p>
          <ul className="flex flex-col gap-1">
            {items.map(({ event, style }) => (
              <li key={event.id}>
                <button
                  type="button"
                  className={ITEM_CLASS}
                  style={style}
                  disabled={onPick === undefined}
                  // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- one handler per event, closing over it; a phone agenda of one month
                  onClick={() => onPick?.(event)}
                >
                  {event.title}
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
