/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseIso } from '../date-picker/date-format-helpers'
import { useDismissOnOutsidePointerDown } from '../hooks/use-dismiss-on-outside-pointer-down'
import { resolvePreset } from './range-presets'
import { orderedRange, parseInterval } from './range-value'
import type { DateRange } from '../date-picker/date-format-helpers'

/** The first of the month containing `date`, which is what a calendar view is. */
function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Close the panel on Escape, while it is open and only then.
 *
 * The listener is on `document` rather than on the panel because the panel does
 * not hold focus: a reader who has clicked a day still has focus inside the
 * grid, and one who opened the panel and moved the pointer away has focus on
 * the trigger. A keydown handler bound to either would miss the other.
 */
function useEscapeToClose(open: boolean, setOpen: (next: boolean) => void): void {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen])
}

/**
 * Which months the panel is showing, and the two ways they move.
 *
 * The view is anchored ONCE, on the period the picker opened with, so a panel
 * over a declared period opens on that period rather than on today. It then
 * moves only by a reader's own actions: a step from the arrows, or a jump when
 * a preset lands the period in another month.
 */
function useMonthView(anchor: Date | undefined): {
  readonly viewMonth: Date
  readonly shiftMonths: (delta: number) => void
  readonly jumpTo: (date: Date) => void
} {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(anchor ?? new Date()))
  const shiftMonths = useCallback((delta: number) => {
    setViewMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + delta, 1))
  }, [])
  const jumpTo = useCallback((date: Date) => setViewMonth(startOfMonth(date)), [])
  return { viewMonth, shiftMonths, jumpTo }
}

/**
 * The period, and the half-made period a reader holds between two clicks.
 *
 * `pendingStart` is held APART from `range` so that the submitted value stays
 * empty while the period is incomplete: a consumer reading a lone date out of a
 * period field would have to guess whether it was a start with no end or an end
 * with no start.
 *
 * A preset skips both clicks and lands a whole period at once, resolved against
 * the clock AT CLICK TIME — which is the reason the preset vocabulary is closed
 * rather than authored. "This month" is a computation, and a config that wrote
 * its two dates down would be wrong on the first of next month.
 */
function usePeriodSelection(
  initial: DateRange | undefined,
  onJump: (date: Date) => void
): {
  readonly range: DateRange | undefined
  readonly pendingStart: Date | undefined
  readonly handleDayClick: (day: Date) => void
  readonly handlePresetClick: (preset: string) => void
} {
  const [range, setRange] = useState<DateRange | undefined>(initial)
  const [pendingStart, setPendingStart] = useState<Date | undefined>(undefined)

  const handleDayClick = useCallback(
    (day: Date) => {
      if (pendingStart === undefined) {
        setPendingStart(day)
        setRange(undefined)
        return
      }
      setRange(orderedRange(pendingStart, day))
      setPendingStart(undefined)
    },
    [pendingStart]
  )

  const handlePresetClick = useCallback(
    (preset: string) => {
      const resolved = resolvePreset(preset, new Date())
      if (!resolved) return
      setRange(resolved)
      setPendingStart(undefined)
      if (resolved.from) onJump(resolved.from)
    },
    [onJump]
  )

  return { range, pendingStart, handleDayClick, handlePresetClick }
}

/**
 * Everything the picker holds while it is open: the period being chosen, the
 * months it is being chosen in, and whether the panel is showing at all.
 *
 * None of it is about MARKUP, which is why it sits beside the component rather
 * than inside it — a reader auditing what the picker DRAWS should not have to
 * read past the period arithmetic to reach the first element.
 */
export function useDateRangeState({
  value,
  minDate,
  maxDate,
}: {
  readonly value?: string
  readonly minDate?: string
  readonly maxDate?: string
}) {
  const initial = useMemo(() => parseInterval(value), [value])
  const [open, setOpen] = useState(false)
  const { viewMonth, shiftMonths, jumpTo } = useMonthView(initial?.from)
  const { range, pendingStart, handleDayClick, handlePresetClick } = usePeriodSelection(
    initial,
    jumpTo
  )

  const minDateObj = useMemo(() => parseIso(minDate), [minDate])
  const maxDateObj = useMemo(() => parseIso(maxDate), [maxDate])

  useEscapeToClose(open, setOpen)
  const toggleOpen = useCallback(() => setOpen((previous) => !previous), [])

  // Escape was the only way out that did not go back through the trigger, and
  // it asks the reader to know a key. Pressing elsewhere is the gesture every
  // other dismissable surface here answers, and the panel now answers it too —
  // the same hook the single-date picker uses, because "a panel a reader can
  // leave" is not a fact about periods.
  const close = useCallback(() => setOpen(false), [])
  const containerRef = useDismissOnOutsidePointerDown<HTMLSpanElement>(open, close)

  return {
    range,
    pendingStart,
    open,
    containerRef,
    viewMonth,
    minDateObj,
    maxDateObj,
    toggleOpen,
    shiftMonths,
    handleDayClick,
    handlePresetClick,
  }
}
