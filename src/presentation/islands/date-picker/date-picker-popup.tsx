/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeDateCaptionClasses,
  computeDateNavButtonClasses,
  computeDatePopupClasses,
} from './date-default-classes'
import { MONTH_NAMES, type DateRange } from './date-format-helpers'
import { DateGrid } from './date-grid'
import type { ReactElement } from 'react'

interface DatePickerPopupProps {
  readonly label: string | undefined
  readonly viewMonth: Date
  readonly onPrevMonth: () => void
  readonly onNextMonth: () => void
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
 * Calendar popup `<div role="dialog">` containing the month-nav buttons
 * + the `<DateGrid>` mount.
 *
 * With {@link DatePickerPopupProps.depicted} set it is the same panel without
 * the dialog role and without the floating position — see that prop.
 */
export function DatePickerPopup({
  label,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  minDateObj,
  maxDateObj,
  datePickerMode,
  singleValue,
  rangeValue,
  onDayClick,
  depicted = false,
}: DatePickerPopupProps): ReactElement {
  return (
    <div
      role={depicted ? undefined : 'dialog'}
      aria-label={depicted ? undefined : (label ?? 'Choose date')}
      data-specimen-open={depicted ? 'true' : undefined}
      className={computeDatePopupClasses({ depicted })}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="previous month"
          onClick={onPrevMonth}
          className={computeDateNavButtonClasses({ direction: 'previous' })}
        >
          ‹
        </button>
        <span className={computeDateCaptionClasses()}>
          {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <button
          type="button"
          aria-label="next month"
          onClick={onNextMonth}
          className={computeDateNavButtonClasses({ direction: 'next' })}
        >
          ›
        </button>
      </div>
      <DateGrid
        viewMonth={viewMonth}
        minDateObj={minDateObj}
        maxDateObj={maxDateObj}
        datePickerMode={datePickerMode}
        singleValue={singleValue}
        rangeValue={rangeValue}
        onDayClick={onDayClick}
      />
    </div>
  )
}
