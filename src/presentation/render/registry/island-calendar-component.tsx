/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeCalendarToolbarClasses } from '@/presentation/design/calendar-default-classes'
import { declaredCalendarPartClasses } from '@/presentation/design/calendar-part-class-resolution'
import { hostClassName, namedHost } from '@/presentation/render/registry/island-host-attributes'
import { calendarDayFloorAttributes } from './calendar-day-floor'
import { islandLoadingLabel, islandUiStrings } from './island-loading-label'
import { islandFallback, specimenEmpty } from './specimen-island-states'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ReactElement } from 'react'

/**
 * Extracts calendar island props from section component props.
 *
 * Forwarded to the calendar island for client-side data fetching and
 * FullCalendar rendering with date-field mapping.
 */
function extractCalendarProps(
  elementProps: Record<string, unknown>,
  parts: Readonly<Record<string, string>> | undefined
): Record<string, unknown> {
  return {
    ...declaredCalendarPartClasses(parts),
    dataSource: elementProps.dataSource,
    dateField: elementProps.dateField,
    endDateField: elementProps.endDateField,
    defaultView: elementProps.defaultView,
    labelField: elementProps.labelField,
    colorField: elementProps.colorField,
    // `optionValue → hex` for the field `colorField` names, resolved
    // server-side from `app.tables` (the island only ever sees records).
    colorFieldColors: elementProps.colorFieldColors,
    // The fields holding a calendar day, so a range ends on its last day.
    dateOnlyFields: elementProps.dateOnlyFields,
    // The date-time fields declaring their own zone; the rest read in the page's.
    fieldTimeZones: elementProps.fieldTimeZones,
    maxEventsPerDay: elementProps.maxEventsPerDay,
    calendarEvent: elementProps.calendarEvent,
    calendarInteraction: elementProps.calendarInteraction,
    // The channel the calendar publishes the event a reader selects on.
    publishes: elementProps.publishes,
  }
}

/** One pulsing bone of the skeleton: shadcn/ui's `Skeleton`. */
const BONE = 'bg-muted animate-pulse rounded-md'

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
function renderCalendarSkeleton(label: string): ReactElement {
  return (
    <div
      className="w-full"
      data-loading-status=""
      aria-label={label}
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

/**
 * The view the mounted calendar opens on — its `defaultView`, `month` when
 * unset — written on the host that names the calendar.
 */
const calendarView = (defaultView: unknown): string =>
  typeof defaultView === 'string' ? defaultView : 'month'

/**
 * SSR placeholder for the calendar island. Renders the toolbar row and
 * a 5x7 day-grid skeleton preserved as a Suspense fallback while the
 * FullCalendar bundle loads — at the geometry the mounted calendar paints, so
 * the grid does not resize under the reader as the island hydrates.
 */
export const islandCalendarComponent: ComponentRenderer = ({
  elementProps,
  designStyles,
  currentLang,
  languages,
}) => {
  const loading = islandLoadingLabel('calendar.loading', currentLang, languages)
  const islandProps = {
    ...extractCalendarProps(elementProps, designStyles?.parts),
    uiStrings: islandUiStrings('calendar', currentLang, languages),
  }
  const propsJson = JSON.stringify(islandProps)

  return (
    <div
      data-island="event-calendar"
      data-island-props={propsJson}
      {...namedHost('event-calendar', { 'data-view': calendarView(elementProps.defaultView) })}
      data-testid={elementProps['data-testid'] as string | undefined}
      className={hostClassName(elementProps)}
      {...calendarDayFloorAttributes(elementProps.dayMinHeight)}
    >
      {islandFallback(renderCalendarSkeleton(loading.status), () =>
        specimenEmpty('gallery.empty', currentLang, languages)
      )}
    </div>
  )
}
