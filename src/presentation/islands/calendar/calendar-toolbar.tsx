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
import type { CalendarCaptions } from './calendar-captions'
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
  /** The words the toolbar writes itself, already resolved for the page language. */
  readonly captions: CalendarCaptions
  /**
   * On a phone the month is drawn as an agenda by default, so the switch
   * carries `Agenda` as a view of its own ahead of Month — pressed while the
   * agenda is drawn ({@link agenda}), Month pressed only for the month grid.
   */
  readonly phone?: boolean
  /** Whether the agenda is the view drawn (a phone, on the month). */
  readonly agenda?: boolean
  /** Draw the agenda; given with {@link phone}. */
  readonly onAgenda?: () => void
  /** The toolbar's classes with the author's `toolbar` part merged in; the recipe's when absent. */
  readonly className?: string
}

type ViewItem = CalendarView | 'agenda'

/**
 * The phone's switch: the agenda in the month's place, then week and day. A
 * month grid is not offered at phone width — the agenda is the phone's month.
 */
const PHONE_VIEW_ITEMS: readonly ViewItem[] = ['agenda', 'week', 'day']

/** Narrow an arbitrary dataset string back to the view vocabulary. */
const isCalendarView = (value: string | undefined): value is CalendarView =>
  value === 'month' || value === 'week' || value === 'day'

/**
 * The joined `‹ ›` pair.
 *
 * `aria-label` supplies each button's accessible name — the glyphs alone
 * announce as punctuation. On an English page "Next period" still satisfies
 * the spec's `/next|forward|›/i`, and "Previous period" matches none of those
 * three, so the spec's unscoped `getByRole` stays strict-mode-safe with exactly
 * one hit.
 */
function CalendarNavGroup({
  onPrev,
  onNext,
  captions,
}: Pick<CalendarToolbarProps, 'onPrev' | 'onNext' | 'captions'>): ReactElement {
  return (
    <div className={NAV_GROUP_CLASSES}>
      <button
        type="button"
        data-component-type="button"
        className={NAV_PREV_CLASSES}
        aria-label={captions.previousPeriod}
        onClick={onPrev}
      >
        &#8249;
      </button>
      <button
        type="button"
        data-component-type="button"
        className={NAV_NEXT_CLASSES}
        aria-label={captions.nextPeriod}
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
  captions,
  phone,
  agenda,
  onAgenda,
}: Pick<
  CalendarToolbarProps,
  'activeView' | 'onViewChange' | 'captions' | 'phone' | 'agenda' | 'onAgenda'
>): ReactElement {
  const handleViewClick = (event: MouseEvent<HTMLButtonElement>): void => {
    const next = event.currentTarget.dataset['calendarView']
    if (next === 'agenda') onAgenda?.()
    else if (isCalendarView(next)) onViewChange(next)
  }
  const pressed = (view: ViewItem): boolean =>
    view === 'agenda' ? agenda === true : view === activeView && !(agenda === true)

  return (
    <div
      className={SEGMENTED_CLASSES}
      role="group"
      aria-label={captions.viewGroup}
    >
      {(phone === true ? PHONE_VIEW_ITEMS : VIEW_ITEMS).map((view, index) => (
        <button
          key={view}
          type="button"
          data-component-type="button"
          data-calendar-view={view}
          className={computeCalendarSegmentedItemClasses({
            active: pressed(view),
            divider: index > 0,
          })}
          aria-pressed={pressed(view)}
          onClick={handleViewClick}
        >
          {view === 'agenda' ? captions.agenda : captions.views[view]}
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
  captions,
  phone,
  agenda,
  onAgenda,
  className,
}: CalendarToolbarProps): ReactElement {
  return (
    <div
      className={className ?? TOOLBAR_CLASSES}
      data-calendar-toolbar=""
    >
      <CalendarNavGroup
        onPrev={onPrev}
        onNext={onNext}
        captions={captions}
      />
      <button
        type="button"
        data-component-type="button"
        className={TODAY_BUTTON_CLASSES}
        onClick={onToday}
      >
        {captions.today}
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
        captions={captions}
        phone={phone}
        agenda={agenda}
        onAgenda={onAgenda}
      />
    </div>
  )
}
