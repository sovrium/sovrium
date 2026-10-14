/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeCalendarToolbarClasses } from '@/presentation/design/calendar-default-classes'
import type { ReactElement } from 'react'

/** One pulsing bone: shadcn/ui's `Skeleton`. */
const BONE = 'bg-muted animate-pulse rounded-md'

export function CalendarMissingDateField(): ReactElement {
  return (
    <div className="border-border bg-card text-foreground rounded-lg border p-3 text-sm">
      <p>
        Calendar is missing required <code>dateField</code> configuration.
      </p>
      <p className="text-muted-foreground mt-1">
        Add it to this component in your app config, then redeploy.
      </p>
    </div>
  )
}

/**
 * Loading skeleton for the calendar, at the geometry the mounted calendar
 * paints so the swap does not move a line: the toolbar row from the shared
 * recipe with a bone per control (the arrows' group, Today, the title, the
 * views), then the grid in the border colour, 36px day cells.
 */
export function CalendarLoading(): ReactElement {
  return (
    <div
      className="w-full"
      aria-label="Loading calendar..."
      role="status"
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
    </div>
  )
}

export function CalendarError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="border-destructive/30 bg-card text-destructive rounded-lg border p-3 text-sm"
      role="alert"
    >
      <p>
        Failed to load calendar records: {error instanceof Error ? error.message : String(error)}
      </p>
      <p className="text-muted-foreground mt-1">Refresh the page to try again.</p>
    </div>
  )
}
