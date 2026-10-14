/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { DATE_CONTROL_ROOT_CLASSES } from '@/presentation/design/date-trigger-default-classes'
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
 * Date-picker island — a trigger button that opens a calendar popup. The
 * calendar is the shared react-day-picker wrapper (`parts/day-picker.tsx`):
 * a `<table role="grid">` with one `<td role="gridcell">` per day.
 *
 * Supports `single` (default) and `range` selection modes plus `minDate` /
 * `maxDate` constraints. The selection rules stay in this island's state
 * hook; the grid only reports which day was pressed.
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
      className={DATE_CONTROL_ROOT_CLASSES}
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
          onMonthChange={state.handleMonthChange}
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
