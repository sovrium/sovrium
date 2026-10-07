/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeCalendarToolbarClasses } from '@/presentation/design/calendar-default-classes'
import { cn } from '@/presentation/design/class-merge'
import type { CalendarPartClasses } from '@/presentation/design/calendar-part-classes'

const GRID_PARTS = ['event', 'day', 'dayNumber', 'columnHeader'] as const

/**
 * The calendar's piece classes, as the island payload key `calendarClasses` —
 * or nothing at all when the calendar names no calendar part, so its payload
 * keeps its bytes.
 *
 * @param parts - The author's classes by part (`design.components.calendar` under `classes`).
 */
export const declaredCalendarPartClasses = (
  parts: Readonly<Record<string, string>> | undefined
): { readonly calendarClasses?: CalendarPartClasses } => {
  if (parts === undefined) return {}
  const grid = Object.fromEntries(
    GRID_PARTS.flatMap((part) => (parts[part] === undefined ? [] : [[part, parts[part]]]))
  )
  const { toolbar } = parts
  if (Object.keys(grid).length === 0 && toolbar === undefined) return {}
  return {
    calendarClasses: {
      ...grid,
      ...(toolbar === undefined ? {} : { toolbar: cn(computeCalendarToolbarClasses(), toolbar) }),
    },
  }
}
