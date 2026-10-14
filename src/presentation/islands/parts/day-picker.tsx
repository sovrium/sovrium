/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui calendar (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The day grid every Sovrium calendar draws through: shadcn's `calendar` over
 * react-day-picker ([internal ref] D3). `date-picker` and `date-range-picker` mount
 * {@link Calendar} inside their own popup; a calendar drawn inline mounts it
 * on its own.
 *
 * This file is also the only place `date-fns` may be named (it is
 * react-day-picker's date library): Sovrium's own date logic stays on Effect
 * `DateTime` and Temporal, and the props here speak plain `Date`.
 *
 * Three departures from the upstream file:
 *
 *  - No `Button`: the navigation arrows and the day buttons carry base-nova's
 *    ghost button classes directly, so the grid pulls no recipe into the
 *    islands that mount it.
 *  - No `cn`: the class lists are joined rather than merged. A consumer's
 *    `classNames` entry REPLACES the default for its slot, as upstream's
 *    spread does, so there is nothing to de-conflict inside one slot.
 *  - The chevrons are inline SVG (lucide's paths) instead of the registry's
 *    icon-library placeholder.
 */

import { useEffect, useMemo, useRef } from 'react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'
import type { ComponentProps, ReactElement, Ref } from 'react'
import type { DayButtonProps } from 'react-day-picker'

/**
 * The locale type react-day-picker's `locale` prop takes. A consumer maps an
 * app's language onto it through this name; nothing else in `src/` names a
 * date-fns symbol.
 * @public The `calendar` type maps an app language onto it.
 */
export type { Locale as DayPickerLocale } from 'date-fns'

/** Every prop react-day-picker takes: the calendar adds none of its own. */
export type CalendarProps = ComponentProps<typeof DayPicker>

const join = (...classes: ReadonlyArray<string | false | undefined>): string =>
  classes.filter(Boolean).join(' ')

/** base-nova's `ghost` button, minus its own `size-8` box. */
const GHOST_BUTTON = [
  'inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent',
  'bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:pointer-events-none disabled:opacity-50',
  'hover:bg-muted hover:text-foreground dark:hover:bg-muted/50',
].join(' ')

const NAV_BUTTON = `${GHOST_BUTTON} size-(--cell-size) p-0 select-none aria-disabled:opacity-50`

const DAY_BUTTON = [
  GHOST_BUTTON,
  'relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1',
  'border-0 leading-none font-normal',
  'group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10',
  'group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px]',
  'group-data-[focused=true]/day:ring-ring/50',
  'data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius)',
  'data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground',
  'data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted',
  'data-[range-middle=true]:text-foreground',
  'data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius)',
  'data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground',
  'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground',
  'dark:hover:text-foreground [&>span]:text-xs [&>span]:opacity-70',
].join(' ')

const CHEVRON_PATHS = {
  left: 'm15 18-6-6 6-6',
  right: 'm9 18 6-6-6-6',
  up: 'm18 15-6-6-6 6',
  down: 'm6 9 6 6 6-6',
} as const

function CalendarChevron({
  className,
  orientation = 'left',
}: {
  readonly className?: string
  readonly orientation?: keyof typeof CHEVRON_PATHS
}): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={join('size-4', className)}
    >
      <path d={CHEVRON_PATHS[orientation]} />
    </svg>
  )
}

/** The root `<div>`, marked as the calendar slot the way upstream marks it. */
function CalendarRoot({
  className,
  rootRef,
  ...props
}: ComponentProps<'div'> & { readonly rootRef?: Ref<HTMLDivElement> }): ReactElement {
  return (
    <div
      data-slot="calendar"
      ref={rootRef}
      className={className}
      {...props}
    />
  )
}

/**
 * One day's button. It reads its range position from the modifiers so the
 * selection paints as a bar, and it takes the focus react-day-picker's keyboard
 * navigation hands it.
 */
export function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: DayButtonProps): ReactElement {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])
  const single =
    modifiers.selected && !modifiers.range_start && !modifiers.range_end && !modifiers.range_middle
  return (
    <button
      ref={ref}
      data-day={day.isoDate}
      data-selected-single={single}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={join(DAY_BUTTON, getDefaultClassNames().day, className)}
      {...props}
    />
  )
}

/** The classes of every slot, upstream's list with react-day-picker's own names kept. */
function slotClassNames(showWeekNumber: boolean | undefined): CalendarProps['classNames'] {
  const d = getDefaultClassNames()
  return {
    root: join('w-fit', d.root),
    months: join('relative flex flex-col gap-4 md:flex-row', d.months),
    month: join('flex w-full flex-col gap-4', d.month),
    nav: join('absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1', d.nav),
    button_previous: join(NAV_BUTTON, d.button_previous),
    button_next: join(NAV_BUTTON, d.button_next),
    month_caption: join(
      'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
      d.month_caption
    ),
    caption_label: join('text-sm font-medium select-none', d.caption_label),
    month_grid: join('w-full border-collapse', d.month_grid),
    weekdays: join('flex', d.weekdays),
    weekday: join(
      'flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal text-muted-foreground select-none',
      d.weekday
    ),
    week: join('mt-2 flex w-full', d.week),
    week_number_header: join('w-(--cell-size) select-none', d.week_number_header),
    week_number: join('text-[0.8rem] text-muted-foreground select-none', d.week_number),
    day: join(
      'group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none',
      '[&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)',
      showWeekNumber === true
        ? '[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)'
        : '[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)',
      d.day
    ),
    range_start: join(
      'relative isolate z-0 rounded-l-(--cell-radius) bg-muted',
      'after:absolute after:inset-y-0 after:right-0 after:w-4 after:bg-muted',
      d.range_start
    ),
    range_middle: join('rounded-none', d.range_middle),
    range_end: join(
      'relative isolate z-0 rounded-r-(--cell-radius) bg-muted',
      'after:absolute after:inset-y-0 after:left-0 after:w-4 after:bg-muted',
      d.range_end
    ),
    today: join(
      'rounded-(--cell-radius) bg-muted text-foreground data-[selected=true]:rounded-none',
      d.today
    ),
    outside: join('text-muted-foreground aria-selected:text-muted-foreground', d.outside),
    disabled: join('text-muted-foreground opacity-50', d.disabled),
    hidden: join('invisible', d.hidden),
  }
}

const ROOT_CLASSES = [
  'group/calendar bg-background p-2 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(7)]',
  'in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent',
].join(' ')

/**
 * The calendar: react-day-picker with shadcn's classes and parts. Every
 * react-day-picker prop passes through; a `classNames` or `components` entry
 * overrides the default for its slot.
 */
const DEFAULT_COMPONENTS: CalendarProps['components'] = {
  Root: CalendarRoot,
  Chevron: CalendarChevron,
  DayButton: CalendarDayButton,
}

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: CalendarProps): ReactElement {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={join(ROOT_CLASSES, className)}
      classNames={useMemo(
        () => ({ ...slotClassNames(props.showWeekNumber), ...classNames }),
        [props.showWeekNumber, classNames]
      )}
      components={useMemo(() => ({ ...DEFAULT_COMPONENTS, ...components }), [components])}
      {...props}
    />
  )
}
