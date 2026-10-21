/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useCallback, useMemo, useRef, type ReactElement } from 'react'
import { POPUP_SURFACE } from '@/presentation/design/shared-tokens-default-classes'
import { Calendar } from './day-picker'
import { useInViewPlacement } from './in-view-placement'

/**
 * The calendar a date box opens: the shared day grid in a floating
 * panel below the box — or above it, or shifted, where the window has no room
 * below (`in-view-placement`).
 *
 * Its own module so the form loads it on demand (`React.lazy` in
 * `date-text-box`): the grid pulls react-day-picker and its date library, which a
 * form nobody opens a calendar on never needs.
 *
 * The grid speaks plain `Date`; the form holds the day as `YYYY-MM-DD`. Both
 * conversions read the LOCAL calendar day, which is what react-day-picker draws
 * and hands back (local midnight), so no time zone moves a picked day.
 */
export interface DateTextCalendarProps {
  /** The day the field holds (`YYYY-MM-DD`), or anything else for none. */
  readonly value: string
  /** The panel's accessible name. */
  readonly label: string
  /** A day was picked, as `YYYY-MM-DD`. */
  readonly onPick: (day: string) => void
}

const PANEL_CLASSES = `absolute top-full left-0 z-50 mt-1 max-w-[calc(100vw-2rem)] rounded-lg p-1 shadow-lg ${POPUP_SURFACE}`

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** `YYYY-MM-DD` (or a timestamp starting with it) as the local day, else none. */
function dayOf(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (match === null) return undefined
  const [, year = '', month = '', day = ''] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** A local day as `YYYY-MM-DD`. */
const isoOf = (date: Date): string =>
  `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

/** The floating day grid — see the module note. Opens on the held day's month. */
export default function DateTextCalendar({
  value,
  label,
  onPick,
}: DateTextCalendarProps): ReactElement {
  const selected = useMemo(() => dayOf(value), [value])
  // The pressed day, whether or not it was already the selected one: in
  // `single` mode pressing the selected day again would otherwise deselect it.
  const handleSelect = useCallback((_selection: unknown, day: Date) => onPick(isoOf(day)), [onPick])
  const panel = useRef<HTMLDivElement>(null)
  const placement = useInViewPlacement(panel)
  return (
    <div
      ref={panel}
      style={placement}
      role="dialog"
      aria-label={label}
      data-slot="popover-content"
      className={PANEL_CLASSES}
    >
      <Calendar
        mode="single"
        defaultMonth={selected}
        selected={selected}
        onSelect={handleSelect}
        autoFocus
      />
    </div>
  )
}
