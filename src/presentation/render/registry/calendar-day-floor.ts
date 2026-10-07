/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { RESPONSIVE_BREAKPOINTS } from '@/presentation/design/responsive-classes'
import type { CSSProperties } from 'react'

/**
 * The calendar host's attributes for `dayMinHeight`: a marker, and one custom
 * property per breakpoint holding the floor in force there — the declared
 * value, else the one below it, so the stylesheet's media rules
 * (`calendar-day-floor-styles.ts`) only ever read their own breakpoint.
 *
 * @param dayMinHeight - The declared `{ mobile, sm, md, … }` struct, if any.
 */
export const calendarDayFloorAttributes = (
  dayMinHeight: unknown
): { readonly 'data-day-min-height'?: ''; readonly style?: CSSProperties } => {
  if (dayMinHeight === null || typeof dayMinHeight !== 'object') return {}
  const declared = dayMinHeight as Readonly<Record<string, unknown>>
  const entries = RESPONSIVE_BREAKPOINTS.reduce<readonly (readonly [string, string])[]>(
    (filled, breakpoint) => {
      const value = declared[breakpoint]
      const inForce = typeof value === 'string' ? value : filled.at(-1)?.[1]
      return inForce === undefined
        ? filled
        : [...filled, [`--sv-day-min-height-${breakpoint}`, inForce] as const]
    },
    []
  )
  return entries.length === 0
    ? {}
    : { 'data-day-min-height': '', style: Object.fromEntries(entries) as CSSProperties }
}
