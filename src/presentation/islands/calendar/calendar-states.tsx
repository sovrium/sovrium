/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ReactElement } from 'react'

export function CalendarMissingDateField(): ReactElement {
  return (
    <div
      className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800"
      data-component="calendar"
    >
      Calendar is missing required <code>dateField</code> configuration.
    </div>
  )
}

export function CalendarLoading(): ReactElement {
  return (
    <div
      className="w-full rounded-lg border border-gray-200 bg-white p-4"
      aria-label="Loading calendar..."
      role="status"
      data-component="calendar"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <div
            key={`calendar-skeleton-${String(i)}`}
            className="h-16 animate-pulse rounded bg-gray-100"
          />
        ))}
      </div>
    </div>
  )
}

export function CalendarError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
      role="alert"
      data-component="calendar"
    >
      Failed to load calendar records: {error instanceof Error ? error.message : String(error)}
    </div>
  )
}
