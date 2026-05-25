/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, type ReactElement } from 'react'
import {
  WEEKDAY_LABELS,
  isInRange,
  isOutOfBounds,
  isSameDay,
  type DateRange,
} from './date-format-helpers'

interface DayCellProps {
  readonly day: Date
  readonly viewMonth: Date
  readonly minDateObj: Date | undefined
  readonly maxDateObj: Date | undefined
  readonly datePickerMode: 'single' | 'range'
  readonly singleValue: Date | undefined
  readonly rangeValue: DateRange | undefined
  readonly onDayClick: (day: Date) => void
}

function DayCell({
  day,
  viewMonth,
  minDateObj,
  maxDateObj,
  datePickerMode,
  singleValue,
  rangeValue,
  onDayClick,
}: DayCellProps): ReactElement {
  const inViewMonth = day.getMonth() === viewMonth.getMonth()
  const oob = isOutOfBounds(day, minDateObj, maxDateObj)
  const isSelected =
    datePickerMode === 'range'
      ? rangeValue !== undefined && isInRange(day, rangeValue)
      : singleValue !== undefined && isSameDay(day, singleValue)
  const buttonClass = isSelected
    ? 'bg-primary text-primary-fg h-8 w-8 rounded'
    : 'hover:bg-background-subtle h-8 w-8 rounded'
  const handleClick = useCallback(() => onDayClick(day), [day, onDayClick])
  return (
    <td
      role="gridcell"
      aria-selected={isSelected ? 'true' : undefined}
      aria-disabled={oob ? 'true' : undefined}
      data-out-of-month={inViewMonth ? undefined : 'true'}
      className="p-0"
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={oob}
        className={buttonClass}
      >
        {day.getDate()}
      </button>
    </td>
  )
}

interface DateGridProps {
  readonly viewMonth: Date
  readonly minDateObj: Date | undefined
  readonly maxDateObj: Date | undefined
  readonly datePickerMode: 'single' | 'range'
  readonly singleValue: Date | undefined
  readonly rangeValue: DateRange | undefined
  readonly onDayClick: (day: Date) => void
}

function useDayGrid(viewMonth: Date): readonly (readonly Date[])[] {
  return useMemo(() => {
    const year = viewMonth.getFullYear()
    const month = viewMonth.getMonth()
    const firstOfMonth = new Date(year, month, 1)
    const startOffset = firstOfMonth.getDay()
    const gridStart = new Date(year, month, 1 - startOffset)
    return Array.from({ length: 6 }, (_, r) =>
      Array.from(
        { length: 7 },
        (_unused, c) =>
          new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + r * 7 + c)
      )
    )
  }, [viewMonth])
}

function WeekdayHeaderRow(): ReactElement {
  return (
    <tr>
      {WEEKDAY_LABELS.map((w) => (
        <th
          key={w}
          scope="col"
          className="text-foreground-muted px-1 py-1 text-xs font-normal"
        >
          {w}
        </th>
      ))}
    </tr>
  )
}

export function DateGrid({
  viewMonth,
  minDateObj,
  maxDateObj,
  datePickerMode,
  singleValue,
  rangeValue,
  onDayClick,
}: DateGridProps): ReactElement {
  const dayGrid = useDayGrid(viewMonth)
  return (
    <table
      role="grid"
      className="border-collapse text-sm"
    >
      <thead>
        <WeekdayHeaderRow />
      </thead>
      <tbody>
        {dayGrid.map((row, ri) => (
          <tr key={ri}>
            {row.map((day) => (
              <DayCell
                key={day.toISOString()}
                day={day}
                viewMonth={viewMonth}
                minDateObj={minDateObj}
                maxDateObj={maxDateObj}
                datePickerMode={datePickerMode}
                singleValue={singleValue}
                rangeValue={rangeValue}
                onDayClick={onDayClick}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
