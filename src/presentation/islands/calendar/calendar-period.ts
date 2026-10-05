/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a phone's agenda (`calendar-agenda.tsx`) reads: whether the viewport is
 * a phone, and the period FullCalendar shows.
 */

import { useEffect, useState } from 'react'

/** Below Tailwind's `sm` breakpoint — a phone. */
const PHONE_QUERY = '(max-width: 639px)'

/** Whether the viewport is phone-sized, following it as it changes. */
export function usePhoneViewport(): boolean {
  const [phone, setPhone] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches
  )
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY)
    const onChange = (): void => setPhone(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return phone
}

/** The period FullCalendar shows, as `YYYY-MM-DD` days — `end` excluded. */
export interface CalendarPeriod {
  readonly start: string
  readonly end: string
}

/** A local-midnight `Date` (how FullCalendar reports a period) as its `YYYY-MM-DD`. */
export const localDay = (date: Readonly<Date>): string =>
  [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
