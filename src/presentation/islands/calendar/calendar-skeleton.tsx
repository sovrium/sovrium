/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeCalendarToolbarClasses } from '@/presentation/design/calendar-default-classes'
import { ViewLoading, type ViewStrings } from '../parts/view-states'
import type { ReactElement } from 'react'

/** One pulsing bone: shadcn/ui's `Skeleton`. */
const BONE = 'bg-muted animate-pulse rounded-md'

/**
 * Loading skeleton for the calendar, at the geometry the mounted calendar
 * paints so the swap does not move a line: the toolbar row from the shared
 * recipe with a bone per control (the arrows' group, Today, the title, the
 * views), then the grid in the border colour, 36px day cells.
 */
export function CalendarLoading({ strings }: { readonly strings: ViewStrings }): ReactElement {
  return (
    <ViewLoading
      className="w-full"
      label={strings?.['calendar.loading'] ?? 'Loading calendar...'}
    >
      <div className={computeCalendarToolbarClasses()}>
        <div className={`${BONE} h-7 w-14`} />
        <div className={`${BONE} h-7 w-14`} />
        <div className="flex min-w-0 flex-1 justify-center">
          <div className={`${BONE} h-4 w-32`} />
        </div>
        <div className={`${BONE} h-7 w-40`} />
      </div>
      <div className="border-border bg-card border">
        <div className="border-border grid grid-cols-7 border-b">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={`calendar-skeleton-weekday-${String(i)}`}
              className="flex justify-center py-1"
            >
              <div className={`${BONE} h-3 w-6`} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={`calendar-skeleton-${String(i)}`}
              className="border-border h-9 border-b border-l p-1"
            >
              <div className={`${BONE} h-2 w-3`} />
            </div>
          ))}
        </div>
      </div>
    </ViewLoading>
  )
}
