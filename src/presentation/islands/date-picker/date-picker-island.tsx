/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeDateTriggerClasses } from './date-default-classes'
import { DatePickerPopup } from './date-picker-popup'
import { useDatePickerState } from './use-date-picker-state'
import type { ReactElement } from 'react'

interface DatePickerIslandProps {
  readonly id?: string
  readonly label?: string
  readonly placeholder?: string
  readonly dateFormat?: string
  readonly minDate?: string
  readonly maxDate?: string
  readonly datePickerMode?: 'single' | 'range'
  readonly disabled?: boolean
  readonly name?: string
}

interface TriggerButtonProps {
  readonly id: string | undefined
  readonly disabled: boolean
  readonly open: boolean
  readonly triggerLabel: string
  readonly onClick: () => void
}

function TriggerButton({
  id,
  disabled,
  open,
  triggerLabel,
  onClick,
}: TriggerButtonProps): ReactElement {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open ? 'true' : 'false'}
      className={computeDateTriggerClasses({
        state: disabled ? 'disabled' : open ? 'open' : 'default',
      })}
    >
      {triggerLabel}
    </button>
  )
}

/**
 * Date-picker island — a trigger button that opens a custom calendar
 * popup. The calendar grid is a 7-column `<table role="grid">` with one
 * `<td role="gridcell">` per day, matching the structure the spec asserts.
 *
 * Supports `single` (default) and `range` selection modes plus `minDate` /
 * `maxDate` constraints. We intentionally roll a small grid rather than
 * pull in `react-day-picker` (not installed in `package.json` despite being
 * documented as a stack member) — keeping the island dependency-free.
 *
 * ─── THE ROOT IS A FULL-WIDTH BLOCK, AND IT CARRIES THE REF ────────────────
 *
 * `block w-full`, not `inline-block`. The trigger already asks for `w-full`,
 * and against a shrink-to-fit root that resolved against the caption's own
 * text — so the control took whatever width its label happened to need, plus a
 * floor, and never the width of the column it was dropped into. Founder, on a
 * form of stacked fields: _"pour qu'on ait vraiment le même rythme entre chaque
 * input"_. A form control fills the box it is given, like every other one on
 * the page.
 *
 * The same element carries the ref that decides what counts as pressing the
 * control rather than leaving it: the calendar is a child of it, so the
 * calendar is inside and the rest of the page is outside.
 */
export default function DatePickerIsland({
  id,
  label,
  placeholder,
  dateFormat,
  minDate,
  maxDate,
  datePickerMode = 'single',
  disabled = false,
  name,
}: DatePickerIslandProps): ReactElement {
  const state = useDatePickerState({
    minDate,
    maxDate,
    dateFormat,
    datePickerMode,
    disabled,
    label,
    placeholder,
  })

  return (
    <span
      ref={state.containerRef}
      className="relative block w-full"
      data-component="date-picker-island"
    >
      <TriggerButton
        id={id}
        disabled={disabled}
        open={state.open}
        triggerLabel={state.triggerLabel}
        onClick={state.toggleOpen}
      />
      {name !== undefined && (
        <input
          type="hidden"
          name={name}
          value={state.hiddenInputValue}
        />
      )}
      {state.open && (
        <DatePickerPopup
          label={label}
          viewMonth={state.viewMonth}
          onPrevMonth={state.handlePrevMonth}
          onNextMonth={state.handleNextMonth}
          minDateObj={state.minDateObj}
          maxDateObj={state.maxDateObj}
          datePickerMode={datePickerMode}
          singleValue={state.singleValue}
          rangeValue={state.rangeValue}
          onDayClick={state.handleDayClick}
        />
      )}
    </span>
  )
}
