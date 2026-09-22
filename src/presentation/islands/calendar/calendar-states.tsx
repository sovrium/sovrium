/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeCalendarToolbarClasses } from '@/presentation/design/calendar-default-classes'
import type { ReactElement } from 'react'

/**
 * The INNER grid rule — `sv-bg-subtle` (`well`), deliberately fainter than the
 * `sv-border` (`hair`) rule under the weekday header.
 *
 * The same two-weight split the real calendar paints
 * (`infrastructure/css/theme/calendar-styles.ts`), reproduced here because a
 * skeleton that draws every line at one weight is exactly the "unthemed
 * calendar" look the loading state is standing in for — the reader's first
 * impression of the surface would be the thing the design is trying to avoid.
 *
 * Spelled as a literal so the Oxide scanner in `scripts/build/generate-css-assets.ts`
 * can see it: this file is NOT a `*-default-classes.ts`, so the arbitrary-var
 * safelist generator does not scan it and a template-built class here would
 * reach no stylesheet at all.
 */
const WELL_RULE = 'border-[var(--sv-bg-subtle,oklch(0.965_0_0))]'

/** One pulsing bone. */
const BONE = 'bg-background-subtle animate-pulse rounded'

export function CalendarMissingDateField(): ReactElement {
  return (
    <div
      className="border-warning-border bg-warning-bg text-warning-fg text-md rounded border p-3"
      data-component="calendar"
    >
      <p>
        Calendar is missing required <code>dateField</code> configuration.
      </p>
      <p className="mt-1 opacity-80">Add it to this component in your app config, then redeploy.</p>
    </div>
  )
}

/**
 * Loading skeleton for the calendar.
 *
 * It reproduces the REAL geometry rather than a generic card of boxes, because
 * the two are swapped in place: the skeleton is the Suspense fallback that the
 * hydrated calendar replaces, so any difference between them is a visible jump
 * at the exact moment the reader is looking at the surface. The previous
 * version matched nothing that ships — a two-bone toolbar of 32 × 80 slabs
 * where the real toolbar is a 28px row of four controls, and a gapped grid of
 * 64px cells where the real one is a contiguous 36px grid — so the swap moved
 * every line on screen.
 *
 * Four things are held in lockstep with the real calendar, and each is a
 * measurement someone can check rather than a guess:
 *
 *  - the toolbar row's own classes come from the shared recipe, so they cannot
 *    drift apart at all;
 *  - the three toolbar controls are `h-7`, matching the `sm` button the real
 *    `today` control is and the `h-7` joined groups either side of it;
 *  - the day cells are 36px, matching `.fc-daygrid-day-frame`'s `min-height`;
 *  - the weekday rule is `hair` and the grid rules are `well`, matching the
 *    two-weight split described on {@link WELL_RULE}.
 *
 * The bones themselves are approximations — a bone is not pretending to be
 * text — but the BOXES they sit in are not.
 */
export function CalendarLoading(): ReactElement {
  return (
    <div
      className="w-full"
      aria-label="Loading calendar..."
      role="status"
      data-component="calendar"
    >
      {/* Toolbar row: nav pair · today · centred title · segmented trio. */}
      <div className={computeCalendarToolbarClasses()}>
        <div className={`${BONE} h-7 w-14`} />
        <div className={`${BONE} h-7 w-12`} />
        <div className="flex min-w-0 flex-1 justify-center">
          <div className={`${BONE} h-4 w-32`} />
        </div>
        <div className={`${BONE} h-7 w-40`} />
      </div>

      {/* The grid frame — `.fc-scrollgrid`'s hairline, no radius, no padding. */}
      <div className="border-border bg-background-raised border">
        {/* Weekday header: hair rule beneath, the OUTER weight. */}
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
        {/* Day cells: 36px, contiguous, well rules — the INNER weight. */}
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

export function CalendarError({ error }: { readonly error: unknown }): ReactElement {
  return (
    <div
      className="border-error-border bg-error-bg text-error-fg text-md rounded border p-3"
      role="alert"
      data-component="calendar"
    >
      <p>
        Failed to load calendar records: {error instanceof Error ? error.message : String(error)}
      </p>
      <p className="mt-1 opacity-80">Refresh the page to try again.</p>
    </div>
  )
}
