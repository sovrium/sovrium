/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  formatDate,
  formatRange,
  isOutOfBounds,
  parseIso,
  type DateRange,
} from './date-format-helpers'

interface DatePickerStateInput {
  readonly minDate: string | undefined
  readonly maxDate: string | undefined
  readonly dateFormat: string | undefined
  readonly datePickerMode: 'single' | 'range'
  readonly disabled: boolean
  readonly label: string | undefined
  readonly placeholder: string | undefined
}

export interface DatePickerState {
  readonly open: boolean
  readonly singleValue: Date | undefined
  readonly rangeValue: DateRange | undefined
  readonly viewMonth: Date
  readonly minDateObj: Date | undefined
  readonly maxDateObj: Date | undefined
  readonly hiddenInputValue: string
  readonly triggerLabel: string
  readonly toggleOpen: () => void
  readonly handleDayClick: (day: Date) => void
  readonly handlePrevMonth: () => void
  readonly handleNextMonth: () => void
}

interface DisplayInput {
  readonly datePickerMode: 'single' | 'range'
  readonly singleValue: Date | undefined
  readonly rangeValue: DateRange | undefined
  readonly dateFormat: string | undefined
  readonly label: string | undefined
  readonly placeholder: string | undefined
}

function useDisplayValues({
  datePickerMode,
  singleValue,
  rangeValue,
  dateFormat,
  label,
  placeholder,
}: DisplayInput): { readonly triggerLabel: string; readonly hiddenInputValue: string } {
  const displayValue = useMemo(() => {
    if (datePickerMode === 'range') return formatRange(rangeValue, dateFormat)
    if (!singleValue) return ''
    return formatDate(singleValue, dateFormat)
  }, [datePickerMode, singleValue, rangeValue, dateFormat])

  const triggerLabel = useMemo(() => {
    const base = label ?? 'Pick a date'
    if (displayValue) return `${base} — ${displayValue}`
    if (placeholder) return `${base} — ${placeholder}`
    return base
  }, [label, displayValue, placeholder])

  const hiddenInputValue = useMemo(() => {
    if (datePickerMode === 'range') return formatRange(rangeValue, dateFormat)
    return singleValue ? formatDate(singleValue, dateFormat) : ''
  }, [datePickerMode, rangeValue, singleValue, dateFormat])

  return { triggerLabel, hiddenInputValue }
}

interface CallbacksInput {
  readonly disabled: boolean
  readonly datePickerMode: 'single' | 'range'
  readonly minDateObj: Date | undefined
  readonly maxDateObj: Date | undefined
  readonly setOpen: Dispatch<SetStateAction<boolean>>
  readonly setSingleValue: Dispatch<SetStateAction<Date | undefined>>
  readonly setRangeValue: Dispatch<SetStateAction<DateRange | undefined>>
  readonly setViewMonth: Dispatch<SetStateAction<Date>>
}

function useDatePickerCallbacks({
  disabled,
  datePickerMode,
  minDateObj,
  maxDateObj,
  setOpen,
  setSingleValue,
  setRangeValue,
  setViewMonth,
}: CallbacksInput): {
  readonly toggleOpen: () => void
  readonly handleDayClick: (day: Date) => void
  readonly handlePrevMonth: () => void
  readonly handleNextMonth: () => void
} {
  const toggleOpen = useCallback(() => {
    if (disabled) return
    setOpen((o) => !o)
  }, [disabled, setOpen])

  const handleDayClick = useCallback(
    (day: Date) => {
      if (isOutOfBounds(day, minDateObj, maxDateObj)) return
      if (datePickerMode === 'range') {
        setRangeValue((current) => {
          if (!current || !current.from || current.to) return { from: day }
          if (day < current.from) return { from: day, to: current.from }
          return { from: current.from, to: day }
        })
      } else {
        setSingleValue(day)
        setOpen(false)
      }
    },
    [datePickerMode, minDateObj, maxDateObj, setOpen, setRangeValue, setSingleValue]
  )

  const handlePrevMonth = useCallback(() => {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }, [setViewMonth])
  const handleNextMonth = useCallback(() => {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }, [setViewMonth])

  return { toggleOpen, handleDayClick, handlePrevMonth, handleNextMonth }
}

export function useDatePickerState({
  minDate,
  maxDate,
  dateFormat,
  datePickerMode,
  disabled,
  label,
  placeholder,
}: DatePickerStateInput): DatePickerState {
  const minDateObj = useMemo(() => parseIso(minDate), [minDate])
  const maxDateObj = useMemo(() => parseIso(maxDate), [maxDate])
  const [open, setOpen] = useState(false)
  const [singleValue, setSingleValue] = useState<Date | undefined>(undefined)
  const [rangeValue, setRangeValue] = useState<DateRange | undefined>(undefined)
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const m = minDateObj ?? maxDateObj ?? new Date()
    return new Date(m.getFullYear(), m.getMonth(), 1)
  })

  const { triggerLabel, hiddenInputValue } = useDisplayValues({
    datePickerMode,
    singleValue,
    rangeValue,
    dateFormat,
    label,
    placeholder,
  })

  const callbacks = useDatePickerCallbacks({
    disabled,
    datePickerMode,
    minDateObj,
    maxDateObj,
    setOpen,
    setSingleValue,
    setRangeValue,
    setViewMonth,
  })

  return {
    open,
    singleValue,
    rangeValue,
    viewMonth,
    minDateObj,
    maxDateObj,
    hiddenInputValue,
    triggerLabel,
    ...callbacks,
  }
}
