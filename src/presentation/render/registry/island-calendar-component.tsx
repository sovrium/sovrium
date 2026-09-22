/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeCalendarToolbarClasses } from '@/presentation/design/calendar-default-classes'
import { renderComponentSearchBar } from './component-search-bar'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

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
    // `optionValue → hex` for the field `colorField` names, resolved
    // server-side from `app.tables` (the island only ever sees records).
    colorFieldColors: elementProps.colorFieldColors,
    maxEventsPerDay: elementProps.maxEventsPerDay,
    calendarEvent: elementProps.calendarEvent,
    calendarInteraction: elementProps.calendarInteraction,
    search: elementProps.search,
  }
}

/** One pulsing bone of the skeleton. */
const BONE = 'bg-background-subtle animate-pulse rounded'

/**
 * The faint inner grid rule, spelled as an arbitrary value rather than
 * `border-border`.
 *
 * The calendar draws TWO rule weights and collapsing them is the most visible
 * way to get a calendar wrong: `sv-border` closes the surface and separates the
 * weekday header, while the rules BETWEEN day cells are the much fainter
 * `sv-bg-subtle`. The skeleton has to make the same distinction or the grid
 * visibly darkens for the length of the Suspense window and then lightens as the
 * real calendar mounts.
 */
const WELL_RULE = 'border-[var(--sv-bg-subtle,oklch(0.965_0_0))]'

/**
 * The skeleton the reader sees while the FullCalendar bundle loads.
 *
 * A plain render FUNCTION rather than a `<CalendarSkeleton />` component: this
 * module already exports a renderer, and adding a second component-shaped export
 * trips `react-refresh/only-export-components`. Every other placeholder in this
 * registry is written the same way.
 *
 * Extracted rather than inlined because `islandCalendarComponent` would
 * otherwise breach the 60-line `max-lines-per-function` cap in
 * `[internal ref]`.
 *
 * It deliberately carries NO class containing `header` or `title`:
 * `data-calendar.spec.ts` resolves the period heading with
 * `[class*="header"], h2, [class*="title"]` and `.first()`, so a class named
 * that way here would capture the heading locator for the whole Suspense window.
 */
function renderCalendarSkeleton(): ReactElement {
  return (
    <div
      className="w-full"
      aria-label="Loading calendar..."
      role="status"
    >
      <div className={computeCalendarToolbarClasses()}>
        <div className={`${BONE} h-7 w-14`} />
        <div className={`${BONE} h-7 w-12`} />
        <div className="flex min-w-0 flex-1 justify-center">
          <div className={`${BONE} h-4 w-32`} />
        </div>
        <div className={`${BONE} h-7 w-40`} />
      </div>
      <div className="border-border bg-background-raised border">
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
              className={`h-9 border-b border-l p-1 ${WELL_RULE}`}
            >
              <div className={`${BONE} h-2 w-3`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * SSR placeholder for the calendar island. Renders the Sovrium toolbar row and
 * a 5x7 day-grid skeleton preserved as a Suspense fallback while the
 * FullCalendar bundle loads — at the geometry the mounted calendar paints, so
 * the grid does not resize under the reader as the island hydrates.
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
      {renderComponentSearchBar(elementProps.search)}
      {renderCalendarSkeleton()}
    </div>
  )
}
