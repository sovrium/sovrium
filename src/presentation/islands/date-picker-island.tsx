/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

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
      className="border-border bg-background text-foreground hover:bg-background-subtle inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-sm"
    >
      {triggerLabel}
    </button>
  )
}

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
      className="relative inline-block"
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
