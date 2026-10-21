/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, useRef, type ReactElement } from 'react'
import { Calendar } from '../parts/day-picker'
import { useInViewPlacement } from '../parts/in-view-placement'
import { computeDatePopupClasses } from './date-default-classes'
import { calendarBounds, type DateRange } from './date-format-helpers'

interface DatePickerPopupProps {
  readonly label: string | undefined
  readonly viewMonth: Date
  readonly onMonthChange: (month: Date) => void
  readonly minDateObj: Date | undefined
  readonly maxDateObj: Date | undefined
  readonly datePickerMode: 'single' | 'range'
  readonly singleValue: Date | undefined
  readonly rangeValue: DateRange | undefined
  readonly onDayClick: (day: Date) => void
  /**
   * Draw the panel as a still DEPICTION of the open state rather than as the
   * live popup.
   *
   * Two things go, and they are the two the drawing cannot honestly claim.
   * `role="dialog"` goes because a dialog nobody opened is a second dialog the
   * document advertises and a screen reader announces — the design-system
   * console draws several of these on one page, and `[internal ref]`
   * asserts the absence. The floating position goes because a specimen cell
   * cannot host an overlay (see `POPUP_LAYOUT_DEPICTED`).
   *
   * Everything else is untouched, which is the point: the month nav, the
   * caption and the grid are the component's own markup, so what a reader looks
   * at is the calendar this app ships rather than a surface shaped like one.
   */
  readonly depicted?: boolean
}

/**
 * Calendar popup `<div role="dialog">` around the shared {@link Calendar}: its
 * month navigation, caption and day grid are react-day-picker's.
 *
 * With {@link DatePickerPopupProps.depicted} set it is the same panel without
 * the dialog role and without the floating position — see that prop.
 */
export function DatePickerPopup({
  label,
  viewMonth,
  onMonthChange,
  minDateObj,
  maxDateObj,
  datePickerMode,
  singleValue,
  rangeValue,
  onDayClick,
  depicted = false,
}: DatePickerPopupProps): ReactElement {
  const bounds = useMemo(() => calendarBounds(minDateObj, maxDateObj), [minDateObj, maxDateObj])
  // react-day-picker hands over the day it would select; the island's own
  // state machine decides what that day does, so the range rules stay in one
  // place whichever grid draws the days.
  const handleSelect = useCallback(
    (_selection: unknown, day: Date) => onDayClick(day),
    [onDayClick]
  )
  const selectedRange = useMemo(
    () => (rangeValue?.from ? { from: rangeValue.from, to: rangeValue.to } : undefined),
    [rangeValue]
  )
  // Kept inside the window — flipped above, or shifted — like the other popups;
  // a month with one more week is measured again.
  const panel = useRef<HTMLDivElement>(null)
  const placement = useInViewPlacement(panel, viewMonth.getTime())
  return (
    <div
      ref={panel}
      style={depicted ? undefined : placement}
      role={depicted ? undefined : 'dialog'}
      aria-label={depicted ? undefined : (label ?? 'Choose date')}
      data-specimen-open={depicted ? 'true' : undefined}
      data-slot="popover-content"
      className={computeDatePopupClasses({ depicted })}
    >
      {datePickerMode === 'range' ? (
        <Calendar
          mode="range"
          month={viewMonth}
          onMonthChange={onMonthChange}
          disabled={bounds}
          selected={selectedRange}
          onSelect={handleSelect}
        />
      ) : (
        <Calendar
          mode="single"
          month={viewMonth}
          onMonthChange={onMonthChange}
          disabled={bounds}
          selected={singleValue}
          onSelect={handleSelect}
        />
      )}
    </div>
  )
}
