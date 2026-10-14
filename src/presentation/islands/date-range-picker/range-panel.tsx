/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo } from 'react'
import { computeDatePopupClasses } from '../date-picker/date-default-classes'
import { calendarBounds, formatDate } from '../date-picker/date-format-helpers'
import { Calendar } from '../parts/day-picker'
import { PRESET_LABELS } from './range-presets'
import type { DateRange } from '../date-picker/date-format-helpers'
import type { CalendarProps } from '../parts/day-picker'
import type { ReactElement } from 'react'
import type { DayProps, MonthProps } from 'react-day-picker'

/** What the calendar needs to draw a day and decide whether it can be clicked. */
interface CalendarInput {
  readonly viewMonth: Date
  readonly minDate: Date | undefined
  readonly maxDate: Date | undefined
  readonly range: DateRange | undefined
  readonly pendingStart: Date | undefined
  readonly onDayClick: (day: Date) => void
  readonly onMonthChange: (month: Date) => void
}

interface RangePanelProps extends CalendarInput {
  readonly label: string | undefined
  readonly months: 1 | 2
  readonly presets: readonly string[]
  readonly onPresetClick: (preset: string) => void
  /**
   * Draw the panel as a still DEPICTION of the open state.
   *
   * The same two withholdings `DatePickerPopup.depicted` makes, for the same
   * reasons: no `role="dialog"` a reader never opened, and no floating
   * position a specimen cell cannot host. The presets and the calendar are the
   * component's own.
   */
  readonly depicted?: boolean
}

/**
 * The open panel: a preset column, then one or two months side by side.
 *
 * TWO months is the default because a period that crosses a month boundary is
 * the common case, and paging one calendar back and forth to pick its two ends
 * loses the shape of the selection between the clicks. `months: 1` is the
 * narrow-viewport shape, worth declaring where the panel has to fit a sidebar.
 *
 * An empty `presets` draws no column at all rather than an empty one.
 */
export function RangePanel({
  label,
  months,
  presets,
  onPresetClick,
  depicted = false,
  ...calendar
}: RangePanelProps): ReactElement {
  return (
    <div
      data-date-range-panel
      role={depicted ? undefined : 'dialog'}
      aria-label={depicted ? undefined : (label ?? 'Choose a period')}
      data-specimen-open={depicted ? 'true' : undefined}
      data-slot="popover-content"
      className={computeDatePopupClasses({ depicted })}
    >
      {/* Stacks below `md`. Side by side, the preset column and one calendar
          want more width than a phone has, and the panel is absolutely
          positioned so nothing else would stop them. Above `md` the two sit
          beside each other, which is the shape the presets were designed for. */}
      <div className="flex flex-col gap-4 md:flex-row">
        <PresetColumn
          presets={presets}
          onPresetClick={onPresetClick}
        />
        <RangeCalendar
          months={months}
          {...calendar}
        />
      </div>
    </div>
  )
}

/**
 * One month of the panel, marked `data-date-range-month`.
 *
 * The second month is HIDDEN below `md`, not dropped: two calendars do not fit a
 * phone, and an author writes one config for every screen, so `months: 1`
 * cannot be the answer there. Keeping the node and hiding it is what lets the
 * same declaration read as two months on a laptop and one on a phone.
 */
function RangeMonth({ calendarMonth: _month, displayIndex, className, ...props }: MonthProps) {
  return (
    <div
      data-date-range-month
      className={displayIndex === 0 ? className : `${className ?? ''} hidden md:flex`}
      {...props}
    />
  )
}

/**
 * One day cell. Only a day OF ITS OWN MONTH is addressable: a two-month panel
 * back-fills each grid from its neighbours, so September's grid and October's
 * both draw October 1st, and an attribute naming it twice would make
 * `[data-date-range-day="2026-10-01"]` ambiguous exactly when the panel is in
 * its default shape. A day outside the bounds says so with `aria-disabled`, on
 * the cell a bound is asserted on.
 */
function RangeDay({ day, modifiers, ...props }: DayProps) {
  return (
    <td
      data-date-range-day={day.outside ? undefined : formatDate(day.date, undefined)}
      aria-disabled={modifiers.disabled ? 'true' : undefined}
      {...props}
    />
  )
}

const RANGE_COMPONENTS: CalendarProps['components'] = { Month: RangeMonth, Day: RangeDay }

/**
 * The calendars. A reader who has clicked one end and not the other is holding
 * a period too, an open one, and the grid shades it, so a selection is visible
 * while it is being made rather than appearing whole on the second click.
 */
function RangeCalendar({
  months,
  viewMonth,
  minDate,
  maxDate,
  range,
  pendingStart,
  onDayClick,
  onMonthChange,
}: CalendarInput & { readonly months: 1 | 2 }): ReactElement {
  const bounds = useMemo(() => calendarBounds(minDate, maxDate), [minDate, maxDate])
  const period = range ?? (pendingStart ? { from: pendingStart } : undefined)
  const selected = useMemo(
    () => (period?.from ? { from: period.from, to: period.to } : undefined),
    [period?.from, period?.to]
  )
  const handleSelect = useCallback(
    (_selection: unknown, day: Date) => onDayClick(day),
    [onDayClick]
  )
  return (
    <Calendar
      mode="range"
      numberOfMonths={months}
      month={viewMonth}
      onMonthChange={onMonthChange}
      disabled={bounds}
      selected={selected}
      onSelect={handleSelect}
      components={RANGE_COMPONENTS}
    />
  )
}

/**
 * The named periods down the left of the panel, drawn only when some are
 * declared: an author who offers none gets no column rather than an empty one.
 */
function PresetColumn({
  presets,
  onPresetClick,
}: {
  readonly presets: readonly string[]
  readonly onPresetClick: (preset: string) => void
}): ReactElement | undefined {
  if (presets.length === 0) return undefined
  return (
    <div className="flex flex-col gap-1 p-2">
      {presets.map((preset) => (
        <PresetButton
          key={preset}
          preset={preset}
          onClick={onPresetClick}
        />
      ))}
    </div>
  )
}

function PresetButton({
  preset,
  onClick,
}: {
  readonly preset: string
  readonly onClick: (preset: string) => void
}): ReactElement {
  const handleClick = useCallback(() => onClick(preset), [preset, onClick])
  return (
    <button
      type="button"
      data-date-range-preset={preset}
      onClick={handleClick}
      // `whitespace-nowrap`: a named period is a phrase, and "This month"
      // broken over two rows beside a calendar reads as two presets rather
      // than one.
      className="text-muted-foreground hover:bg-muted hover:text-foreground rounded px-2 py-1 text-left text-sm whitespace-nowrap"
    >
      {PRESET_LABELS[preset] ?? preset}
    </button>
  )
}
