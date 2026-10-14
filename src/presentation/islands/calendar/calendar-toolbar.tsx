/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The calendar toolbar, on shadcn/ui's anatomy: a `button-group` of the two
 * period arrows, an outline Today button, the period title and a
 * `toggle-group` of the views. It replaces FullCalendar's own `headerToolbar`,
 * which `calendar-view.tsx` turns off; the recipe and the reason it is swapped
 * rather than themed are in `design/calendar-default-classes.ts`.
 *
 * Four details are load-bearing:
 *
 * 1. **Every button is `type="button"`.** A calendar can sit inside a page
 *    that also carries a form, and a submit-typed view switch would post it.
 *
 * 2. **Every button names itself a `button`** (`data-component-type`), as a
 *    page names a button outside an island.
 *
 * 3. **The view items carry NO `aria-label`.** The specs match them by their
 *    visible text with an anchored pattern, which a label such as "Week view"
 *    would break.
 *
 * 4. **The view switch is one tab stop.** Only the pressed item is in the tab
 *    order; the arrow keys move focus along the group and Enter or Space
 *    presses the item in focus, as shadcn/ui's toggle group (Base UI) does.
 *    The roving focus is written here rather than mounting Base UI's
 *    `ToggleGroup`, which would add its runtime to the calendar's chunk for
 *    three buttons.
 */

import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import {
  computeCalendarNavGroupClasses,
  computeCalendarTitleClasses,
  computeCalendarToolbarClasses,
} from '@/presentation/design/calendar-default-classes'
import {
  computeToggleGroupClasses,
  computeToggleGroupItemClasses,
} from '../form-controls/toggle-default-classes'
import type { CalendarCaptions } from './calendar-captions'
import type { CalendarView } from '@/domain/models/app/pages/components/component-types/data/calendar/schema'
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactElement } from 'react'

/** View items in the order the switch draws them. */
const VIEW_ITEMS: readonly CalendarView[] = ['month', 'week', 'day']

const TODAY_CLASSES = computePartButtonClasses({ variant: 'outline', size: 'sm' })
const ARROW_CLASSES = computePartButtonClasses({ variant: 'outline', size: 'icon-sm' })
const TOOLBAR_CLASSES = computeCalendarToolbarClasses()
const NAV_GROUP_CLASSES = computeCalendarNavGroupClasses()
const TITLE_CLASSES = computeCalendarTitleClasses()
const VIEW_GROUP_CLASSES = computeToggleGroupClasses()
const VIEW_ITEM_CLASSES = computeToggleGroupItemClasses({ variant: 'outline', size: 'sm' })

/** The toggle group draws its items joined: shadcn's `spacing={0}`. */
const JOINED: CSSProperties = { '--gap': 0 } as CSSProperties

export interface CalendarToolbarProps {
  /** The period caption, taken from FullCalendar's own `view.title`. */
  readonly title: string
  /** The view currently rendered — drives which view item reads pressed. */
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

/** The phone's switch: the agenda in the month's place, then week and day. */
const PHONE_VIEW_ITEMS: readonly ViewItem[] = ['agenda', 'week', 'day']

/** Narrow an arbitrary dataset string back to the view vocabulary. */
const isCalendarView = (value: string | undefined): value is CalendarView =>
  value === 'month' || value === 'week' || value === 'day'

/** lucide's chevron, pointing back (`m15 18-6-6 6-6`) or on (`m9 18 6-6-6-6`). */
function Chevron({ path }: { readonly path: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

/** One outline icon button of the arrows' group. */
function ArrowButton({
  label,
  path,
  onClick,
}: {
  readonly label: string
  readonly path: string
  readonly onClick: () => void
}): ReactElement {
  return (
    <button
      type="button"
      data-component-type="button"
      data-slot="button"
      data-variant="outline"
      data-size="icon-sm"
      className={ARROW_CLASSES}
      aria-label={label}
      onClick={onClick}
    >
      <Chevron path={path} />
    </button>
  )
}

/** The focus step each arrow key takes along the view switch. */
const ARROW_STEP: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
}

/**
 * Arrow-key focus along the view switch: Left/Up go back, Right/Down go on,
 * wrapping at the ends as Base UI's toggle group does.
 */
const moveViewFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
  const step = ARROW_STEP[event.key]
  if (step === undefined) return
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-calendar-view]')]
  const at = items.findIndex((item) => item === document.activeElement)
  if (at < 0) return
  event.preventDefault()
  items[(at + step + items.length) % items.length]?.focus()
}

/** The `month | week | day` toggle group. */
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
      role="group"
      aria-label={captions.viewGroup}
      data-slot="toggle-group"
      data-variant="outline"
      data-size="sm"
      data-spacing="0"
      data-orientation="horizontal"
      className={VIEW_GROUP_CLASSES}
      style={JOINED}
      onKeyDown={moveViewFocus}
    >
      {(phone === true ? PHONE_VIEW_ITEMS : VIEW_ITEMS).map((view) => (
        <button
          key={view}
          type="button"
          data-component-type="button"
          data-slot="toggle-group-item"
          data-variant="outline"
          data-size="sm"
          data-spacing="0"
          data-calendar-view={view}
          className={VIEW_ITEM_CLASSES}
          aria-pressed={pressed(view)}
          tabIndex={pressed(view) ? 0 : -1}
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
      <div
        role="group"
        data-slot="button-group"
        data-orientation="horizontal"
        className={NAV_GROUP_CLASSES}
      >
        <ArrowButton
          label={captions.previousPeriod}
          path="m15 18-6-6 6-6"
          onClick={onPrev}
        />
        <ArrowButton
          label={captions.nextPeriod}
          path="m9 18 6-6-6-6"
          onClick={onNext}
        />
      </div>
      <button
        type="button"
        data-component-type="button"
        data-slot="button"
        data-variant="outline"
        data-size="sm"
        className={TODAY_CLASSES}
        onClick={onToday}
      >
        {captions.today}
      </button>
      {/* The period caption; its `sv-calendar-title` hook is the spec's locator. */}
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
