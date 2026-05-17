/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ComponentRenderer } from '../component-dispatch-config'

/**
 * Extracts calendar island props from section component props.
 *
 * Forwarded to the calendar island for client-side data fetching and
 * FullCalendar rendering with date-field mapping.
 */
function extractCalendarProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  return {
    dataSource: elementProps.dataSource,
    dateField: elementProps.dateField,
    endDateField: elementProps.endDateField,
    defaultView: elementProps.defaultView,
    labelField: elementProps.labelField,
    colorField: elementProps.colorField,
    maxEventsPerDay: elementProps.maxEventsPerDay,
    calendarEvent: elementProps.calendarEvent,
    calendarInteraction: elementProps.calendarInteraction,
  }
}

/**
 * SSR placeholder for the calendar island. Renders a 5x7 day-grid skeleton
 * preserved as a Suspense fallback while the FullCalendar bundle loads.
 */
export const islandCalendarComponent: ComponentRenderer = ({ elementProps }) => {
  const islandProps = extractCalendarProps(elementProps)
  const propsJson = JSON.stringify(islandProps)

  return (
    <div
      data-island="calendar"
      data-island-props={propsJson}
      data-component="calendar"
      data-component-type="calendar"
      data-testid={elementProps['data-testid'] as string | undefined}
    >
      {/* Loading skeleton — preserved as Suspense fallback */}
      <div
        className="w-full rounded-lg border border-gray-200 bg-white p-4"
        aria-label="Loading calendar..."
        role="status"
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
    </div>
  )
}
