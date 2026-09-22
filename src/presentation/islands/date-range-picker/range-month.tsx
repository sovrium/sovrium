/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react'
import {
  computeDateCaptionClasses,
  computeDateDayClasses,
  computeDateWeekdayClasses,
} from '../date-picker/date-default-classes'
import {
  MONTH_NAMES,
  WEEKDAY_LABELS,
  formatDate,
  isInRange,
  isOutOfBounds,
  isSameDay,
} from '../date-picker/date-format-helpers'
import type { DateRange } from '../date-picker/date-format-helpers'
import type { ReactElement } from 'react'

/**
 * One month of the range panel.
 *
 * The grid, the weekday header and every class come from the `date-picker`'s own
 * modules — the two components document ONE calendar and must not drift into two
 * that look nearly alike. What this month adds, and the reason it is not the
 * date-picker's `DateGrid` verbatim, is the addressable day: each cell carries
 * `data-date-range-day="YYYY-MM-DD"`, which is what lets a bound be asserted on
 * a NAMED day rather than on "the third cell of the second row".
 */

interface RangeMonthProps {
  readonly viewMonth: Date
  readonly minDate: Date | undefined
  readonly maxDate: Date | undefined
  readonly range: DateRange | undefined
  readonly pendingStart: Date | undefined
  readonly onDayClick: (day: Date) => void
}

/** Six rows of seven, starting on the Sunday on or before the first of the month. */
function useMonthGrid(viewMonth: Date): readonly (readonly Date[])[] {
  return useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const gridStart = new Date(year, month, 1 - new Date(year, month, 1).getDay())
    return Array.from({ length: 6 }, (_row, r) =>
      Array.from(
        { length: 7 },
        (_cell, c) =>
          new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + r * 7 + c)
      )
    )
  }, [viewMonth])
}

export function RangeMonth({
  viewMonth,
  minDate,
  maxDate,
  range,
  pendingStart,
  onDayClick,
}: RangeMonthProps): ReactElement {
  const weeks = useMonthGrid(viewMonth)
  return (
    <div data-date-range-month>
      <div className={computeDateCaptionClasses()}>
        {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
      </div>
      <table
        role="grid"
        className="text-md border-collapse"
      >
        <thead>
          <tr>
            {WEEKDAY_LABELS.map((weekday) => (
              <th
                key={weekday}
                scope="col"
                className={computeDateWeekdayClasses()}
              >
                {weekday}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, index) => (
            <tr key={index}>
              {week.map((day) => (
                <DayCell
                  key={day.toISOString()}
                  day={day}
                  viewMonth={viewMonth}
                  minDate={minDate}
                  maxDate={maxDate}
                  range={range}
                  pendingStart={pendingStart}
                  onDayClick={onDayClick}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface DayCellProps extends RangeMonthProps {
  readonly day: Date
}

/**
 * The period a day is measured against.
 *
 * A reader who has clicked one end and not the other is holding a period too —
 * an open one — and the grid shades it, so a selection is visible while it is
 * being made rather than appearing whole on the second click.
 */
function effectivePeriod(
  range: DateRange | undefined,
  pendingStart: Date | undefined
): DateRange | undefined {
  if (range) return range
  return pendingStart ? { from: pendingStart } : undefined
}

/** Which end of the period a day sits on, once it is known to be inside it. */
function periodEdge(day: Date, period: DateRange): 'range-start' | 'range-end' | 'range-middle' {
  if (period.from && isSameDay(day, period.from)) return 'range-start'
  if (period.to && isSameDay(day, period.to)) return 'range-end'
  return 'range-middle'
}

/**
 * The visual state of one day, in the date-picker's own vocabulary.
 *
 * A bound wins over a selection: a day outside `minDate`/`maxDate` reads
 * disabled even if it sits inside a period that was authored across the bound,
 * because the reader cannot move that end there.
 */
function dayState(props: DayCellProps): {
  readonly state: 'disabled' | 'range-start' | 'range-end' | 'range-middle' | 'outside' | 'default'
  readonly out: boolean
  readonly selected: boolean
} {
  const { day, viewMonth, minDate, maxDate, range, pendingStart } = props
  const out = isOutOfBounds(day, minDate, maxDate)
  if (out) return { state: 'disabled', out, selected: false }
  const period = effectivePeriod(range, pendingStart)
  if (period !== undefined && isInRange(day, period)) {
    return { state: periodEdge(day, period), out, selected: true }
  }
  return {
    state: day.getMonth() === viewMonth.getMonth() ? 'default' : 'outside',
    out,
    selected: false,
  }
}

function DayCell(props: DayCellProps): ReactElement {
  const { day, viewMonth, onDayClick } = props
  const { state, out, selected } = dayState(props)
  const handleClick = useCallback(() => onDayClick(day), [day, onDayClick])
  // Only a day OF THIS MONTH is addressable. A two-month panel back-fills each
  // grid from its neighbours, so September's grid and October's both draw
  // October 1st — and an attribute that named it twice would make
  // `[data-date-range-day="2026-10-01"]` ambiguous exactly when the panel is in
  // its default shape. The back-filled cells stay visible and clickable; they
  // are just addressed on the month they belong to.
  const addressable = day.getMonth() === viewMonth.getMonth()
  return (
    <td
      data-date-range-day={addressable ? formatDate(day, undefined) : undefined}
      role="gridcell"
      aria-selected={selected ? 'true' : undefined}
      aria-disabled={out ? 'true' : undefined}
      className="p-0"
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={out}
        className={computeDateDayClasses({ state })}
      >
        {day.getDate()}
      </button>
    </td>
  )
}
