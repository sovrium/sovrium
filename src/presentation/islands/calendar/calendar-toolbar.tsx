/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Sovrium calendar toolbar (wave R-D).
 *
 * Replaces FullCalendar's own `headerToolbar`, which `calendar-view.tsx` turns
 * off. The rationale for swapping rather than theming — and the accessible-name
 * contract the specs pin — lives in the recipe's docstring
 * (`presentation/utils/recipes/calendar-default-classes.ts`); this file is the
 * markup that recipe was written for.
 *
 * It is a separate module rather than more of `calendar-view.tsx` for one
 * mechanical reason: `[internal ref]` caps an island at 250
 * code lines, and the view is already close to it. Splitting the control out
 * also means the toolbar is testable and re-styleable without touching the
 * FullCalendar wiring, which is the part with the spec contracts on it.
 *
 * ## Three details that are load-bearing, not cosmetic
 *
 * 1. **Every button is `type="button"`.** A bare `<button>` defaults to
 *    `type="submit"`; the calendar is a component an author can drop inside a
 *    page that also carries a form, and a submit-typed view switch would post
 *    it on the first click.
 *
 * 2. **The view items carry NO `aria-label`.** `data-calendar.spec.ts` matches
 *    them with `/^(week|day)$/i` — anchored, so a label of "Week view" would
 *    not match and the spec would fail against a correct control. Their visible
 *    text IS their accessible name, which is also what the canvas draws.
 *
 * 3. **One click handler for all three view items, keyed off `data-view`.**
 *    `react-perf/jsx-no-new-function-as-prop` is on (as a warning, and
 *    `bun run quality` runs ESLint with `--max-warnings 0`), so an inline
 *    `onClick={() => onViewChange('week')}` fails the gate. A single stable
 *    handler reading the item's own dataset avoids three `useCallback`s and
 *    keeps the item list a map rather than three hand-written branches.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeCalendarNavButtonClasses,
  computeCalendarNavGroupClasses,
  computeCalendarSegmentedClasses,
  computeCalendarSegmentedItemClasses,
  computeCalendarTitleClasses,
  computeCalendarToolbarClasses,
} from '@/presentation/design/calendar-default-classes'
import type { CalendarView } from '@/domain/models/app/pages/components/component-types/data/calendar/schema'
import type { MouseEvent, ReactElement } from 'react'

/**
 * View items in the order the canvas draws them. Module-level so the array is
 * one stable reference across renders (`react-perf/jsx-no-new-array-as-prop`),
 * and so the order is stated once rather than implied by three JSX siblings.
 */
const VIEW_ITEMS: readonly CalendarView[] = ['month', 'week', 'day']

/**
 * The `today` control is a plain `sm` `secondary` button — the canvas draws it
 * as one, and the recipe is shared with every other button in the product.
 * Computed once at module scope because neither axis varies.
 */
const TODAY_BUTTON_CLASSES = computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })

const TOOLBAR_CLASSES = computeCalendarToolbarClasses()
const NAV_GROUP_CLASSES = computeCalendarNavGroupClasses()
const NAV_PREV_CLASSES = computeCalendarNavButtonClasses()
const NAV_NEXT_CLASSES = computeCalendarNavButtonClasses({ divider: true })
const TITLE_CLASSES = computeCalendarTitleClasses()
const SEGMENTED_CLASSES = computeCalendarSegmentedClasses()

export interface CalendarToolbarProps {
  /** The period caption, taken from FullCalendar's own `view.title`. */
  readonly title: string
  /** The view currently rendered — drives which segmented item reads pressed. */
  readonly activeView: CalendarView
  readonly onPrev: () => void
  readonly onNext: () => void
  readonly onToday: () => void
  readonly onViewChange: (view: CalendarView) => void
}

/** Narrow an arbitrary dataset string back to the view vocabulary. */
const isCalendarView = (value: string | undefined): value is CalendarView =>
  value === 'month' || value === 'week' || value === 'day'

/**
 * The joined `‹ ›` pair.
 *
 * `aria-label` supplies each button's accessible name — the glyphs alone
 * announce as punctuation. "Next period" still satisfies the spec's
 * `/next|forward|›/i`, and "Previous period" matches none of those three, so
 * the spec's unscoped `getByRole` stays strict-mode-safe with exactly one hit.
 */
function CalendarNavGroup({
  onPrev,
  onNext,
}: Pick<CalendarToolbarProps, 'onPrev' | 'onNext'>): ReactElement {
  return (
    <div className={NAV_GROUP_CLASSES}>
      <button
        type="button"
        className={NAV_PREV_CLASSES}
        aria-label="Previous period"
        onClick={onPrev}
      >
        &#8249;
      </button>
      <button
        type="button"
        className={NAV_NEXT_CLASSES}
        aria-label="Next period"
        onClick={onNext}
      >
        &#8250;
      </button>
    </div>
  )
}

/** The joined `month | week | day` trio. */
function CalendarViewSwitch({
  activeView,
  onViewChange,
}: Pick<CalendarToolbarProps, 'activeView' | 'onViewChange'>): ReactElement {
  const handleViewClick = (event: MouseEvent<HTMLButtonElement>): void => {
    const next = event.currentTarget.dataset['calendarView']
    if (isCalendarView(next)) onViewChange(next)
  }

  return (
    <div
      className={SEGMENTED_CLASSES}
      role="group"
      aria-label="Calendar view"
    >
      {VIEW_ITEMS.map((view, index) => (
        <button
          key={view}
          type="button"
          data-calendar-view={view}
          className={computeCalendarSegmentedItemClasses({
            active: view === activeView,
            divider: index > 0,
          })}
          aria-pressed={view === activeView}
          onClick={handleViewClick}
        >
          {view}
        </button>
      ))}
    </div>
  )
}

export function CalendarToolbar({
  title,
  activeView,
  onPrev,
  onNext,
  onToday,
  onViewChange,
}: CalendarToolbarProps): ReactElement {
  return (
    <div
      className={TOOLBAR_CLASSES}
      data-calendar-toolbar=""
    >
      <CalendarNavGroup
        onPrev={onPrev}
        onNext={onNext}
      />
      <button
        type="button"
        className={TODAY_BUTTON_CLASSES}
        onClick={onToday}
      >
        today
      </button>
      {/*
        The period caption. Its class list carries the `sv-calendar-title` hook
        the spec locator resolves through — see the recipe docstring for why
        losing it would silently re-point that locator at the weekday header.
      */}
      <div className={TITLE_CLASSES}>{title}</div>
      <CalendarViewSwitch
        activeView={activeView}
        onViewChange={onViewChange}
      />
    </div>
  )
}
