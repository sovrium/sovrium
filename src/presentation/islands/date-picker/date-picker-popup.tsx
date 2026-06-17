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
}

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
}: DatePickerPopupProps): ReactElement {
  return (
    <div
      role="dialog"
      aria-label={label ?? 'Choose date'}
      className={computeDatePopupClasses()}
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
